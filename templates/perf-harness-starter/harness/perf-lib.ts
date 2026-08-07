// Reusable performance-measurement primitives -- generalized from a real,
// battle-tested Playwright perf harness (gauntlet-zelda's harness/checks/perf-lib.ts).
// What's here is the part that has zero dependency on any particular game or
// app's internals: frame-time statistics, CDP heap/GC helpers, the launch-arg
// recipe that gets honest (non-vsync-paced) frame timing out of Chromium, and
// a generic requestAnimationFrame-based frame sampler that works against ANY
// page without the target app needing to expose any special hooks.
//
// What's NOT here, on purpose: gauntlet-zelda's own harness also has a bespoke
// stress-scene/spawner-driven measurement built on that game's own internal
// `window.__perf`/`window.__stress` API. That's real, hand-built instrumentation
// specific to that game's mechanics -- there is no honest way to generalize it,
// and pretending otherwise would produce a harness that silently measures
// nothing meaningful. If this project needs a specific in-app stress scenario
// (dense particle count, deterministic scripted input, etc.), build that
// on top of the primitives below the same way FS-1001/FS-1002 do there.

import { chromium, type Browser, type CDPSession, type Page } from 'playwright';

// --- Browser launch (honest, non-vsync-paced frame timing) ---------------------

/**
 * Without these flags Chrome paces requestAnimationFrame to the display's
 * vsync, every frame delta pins near ~16.67 ms, and the measurement becomes
 * "what's my monitor's refresh rate" instead of "how long did this build take
 * to produce a frame." The backgrounding flags keep numbers honest if the
 * harness window isn't focused/visible while it runs.
 */
export const PERF_LAUNCH_ARGS: readonly string[] = [
  '--disable-gpu-vsync',
  '--disable-frame-rate-limit',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

export async function launchPerfBrowser(): Promise<Browser> {
  return chromium.launch({
    channel: 'chrome',
    ignoreDefaultArgs: ['--disable-gpu'],
    args: ['--enable-unsafe-webgpu', ...PERF_LAUNCH_ARGS],
  });
}

// --- Generic frame-time sampling ------------------------------------------------

/**
 * Injects a requestAnimationFrame sampler into the page and returns the
 * frame-to-frame deltas (ms) collected over `durationMs` of real wall-clock
 * time. Works against any page that's actually rendering -- rAF fires
 * whenever the browser paints, regardless of what's drawn or how the app is
 * built, so this needs zero cooperation from the target app's own code.
 */
export async function sampleFrameTimes(page: Page, durationMs: number): Promise<number[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __gauntletPerfSamples: number[]; __gauntletPerfRunning: boolean };
    w.__gauntletPerfSamples = [];
    w.__gauntletPerfRunning = true;
    let last = performance.now();
    const tick = () => {
      if (!w.__gauntletPerfRunning) return;
      const now = performance.now();
      w.__gauntletPerfSamples.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  return page.evaluate(() => {
    const w = window as unknown as { __gauntletPerfSamples: number[]; __gauntletPerfRunning: boolean };
    w.__gauntletPerfRunning = false;
    return w.__gauntletPerfSamples;
  });
}

// --- Frame-time statistics (pure functions, zero app dependency) ---------------

export interface FrameStats {
  count: number;
  spanSec: number;
  meanFps: number;
  min: number;
  p50: number;
  p90: number;
  p99: number;
  p999: number;
  max: number;
  maxIndex: number;
}

/** Max of a sample array. A spread would blow the stack at tens of thousands of frames. */
export function maxOf(values: readonly number[]): number {
  let max = 0;
  for (let i = 0; i < values.length; i++) if (values[i]! > max) max = values[i]!;
  return max;
}

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx]!;
}

export function frameStats(dt: number[]): FrameStats {
  if (dt.length === 0) {
    return { count: 0, spanSec: 0, meanFps: 0, min: NaN, p50: NaN, p90: NaN, p99: NaN, p999: NaN, max: NaN, maxIndex: -1 };
  }
  const sorted = dt.slice().sort((a, b) => a - b);
  let total = 0;
  let max = -Infinity;
  let maxIndex = -1;
  for (let i = 0; i < dt.length; i++) {
    total += dt[i]!;
    if (dt[i]! > max) {
      max = dt[i]!;
      maxIndex = i;
    }
  }
  return {
    count: dt.length,
    spanSec: total / 1000,
    meanFps: dt.length / (total / 1000),
    min: sorted[0]!,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    p999: percentile(sorted, 0.999),
    max,
    maxIndex,
  };
}

/** 0-100 ms in 0.5 ms buckets, plus an overflow bucket. */
export function histogram(dt: number[], bucketMs = 0.5, buckets = 200): { bucketMs: number; counts: number[]; overflow: number } {
  const counts = new Array<number>(buckets).fill(0);
  let overflow = 0;
  for (const v of dt) {
    const i = Math.floor(v / bucketMs);
    if (i < 0) continue;
    if (i >= buckets) overflow += 1;
    else counts[i]! += 1;
  }
  return { bucketMs, counts, overflow };
}

// --- CDP heap / GC helpers (generic -- any Chromium page) ----------------------

export interface GcEvent {
  name: string;
  durMs: number;
  tsMs: number;
  /** 'major' = mark-compact, 'minor' = scavenge. */
  kind: 'major' | 'minor';
}

/**
 * Top-level GC events only. V8 emits a large tree of GC spans per collection;
 * summing or maxing over that tree double-counts a single pause. These four
 * names are the whole collections -- everything else is a sub-phase or
 * background-thread span, counted separately, never folded into a pause number.
 */
const GC_TOP_LEVEL: Readonly<Record<string, 'major' | 'minor'>> = {
  MajorGC: 'major',
  'V8.GC_MARK_COMPACTOR': 'major',
  MinorGC: 'minor',
  'V8.GC_SCAVENGER': 'minor',
};

const CDP_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} did not return within ${ms} ms`)), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function openCdp(page: Page): Promise<CDPSession> {
  const client = await withTimeout(page.context().newCDPSession(page), CDP_TIMEOUT_MS, 'newCDPSession');
  await withTimeout(client.send('Performance.enable'), CDP_TIMEOUT_MS, 'Performance.enable');
  await withTimeout(client.send('HeapProfiler.enable'), CDP_TIMEOUT_MS, 'HeapProfiler.enable');
  await withTimeout(client.send('Runtime.enable'), CDP_TIMEOUT_MS, 'Runtime.enable');
  return client;
}

export async function heapUsage(client: CDPSession): Promise<{ usedSize: number; totalSize: number }> {
  const r = (await withTimeout(client.send('Runtime.getHeapUsage'), CDP_TIMEOUT_MS, 'Runtime.getHeapUsage')) as {
    usedSize: number;
    totalSize: number;
  };
  return { usedSize: r.usedSize, totalSize: r.totalSize };
}

export async function collectGarbage(client: CDPSession): Promise<void> {
  await withTimeout(client.send('HeapProfiler.collectGarbage'), CDP_TIMEOUT_MS, 'HeapProfiler.collectGarbage');
}

const TRACE_CATEGORIES = ['-*', 'devtools.timeline', 'disabled-by-default-v8.gc'].join(',');

export async function startTrace(client: CDPSession): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  client.on('Tracing.dataCollected', (payload) => {
    const value = (payload as { value?: Array<Record<string, unknown>> }).value;
    if (value) for (const e of value) events.push(e);
  });
  await withTimeout(
    client.send('Tracing.start', {
      categories: TRACE_CATEGORIES,
      transferMode: 'ReportEvents',
      bufferUsageReportingInterval: 1000,
    } as never),
    CDP_TIMEOUT_MS,
    'Tracing.start',
  );
  return events;
}

export interface TraceCapture {
  events: Array<Record<string, unknown>>;
  gc: GcEvent[];
  gcSubPhases: number;
}

export async function stopTrace(client: CDPSession, events: Array<Record<string, unknown>>): Promise<TraceCapture> {
  const done = new Promise<void>((resolve) => {
    client.once('Tracing.tracingComplete', () => resolve());
  });
  await withTimeout(client.send('Tracing.end'), CDP_TIMEOUT_MS, 'Tracing.end');
  await Promise.race([done, new Promise((r) => setTimeout(r, 30_000))]);
  const { pauses, subPhaseCount } = extractGcEvents(events);
  return { events, gc: pauses, gcSubPhases: subPhaseCount };
}

export function extractGcEvents(events: Array<Record<string, unknown>>): { pauses: GcEvent[]; subPhaseCount: number } {
  const pauses: GcEvent[] = [];
  let subPhaseCount = 0;
  for (const e of events) {
    const name = typeof e.name === 'string' ? e.name : '';
    if (!name) continue;
    if (!(name.startsWith('V8.GC') || name === 'MajorGC' || name === 'MinorGC')) continue;
    const kind = GC_TOP_LEVEL[name];
    if (kind === undefined) {
      subPhaseCount++;
      continue;
    }
    if (e.ph !== 'X') continue;
    const dur = typeof e.dur === 'number' ? e.dur : 0;
    const ts = typeof e.ts === 'number' ? e.ts : 0;
    pauses.push({ name, durMs: dur / 1000, tsMs: ts / 1000, kind });
  }
  pauses.sort((a, b) => a.tsMs - b.tsMs);
  return { pauses, subPhaseCount };
}
