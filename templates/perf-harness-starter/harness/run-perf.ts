// CLI entry point: node harness/run-perf.ts [path/to/perf.config.json]
//
// Runs the GPU gate first and voids the whole run if it fails (no browser
// measurement is even attempted on a software renderer -- consistent with the
// evidence-or-void discipline: a number from the wrong hardware isn't a
// number). Otherwise measures frame timing and heap growth against a running
// page and writes a report matching the .gauntlet/ performanceGate shape
// (see PERF_CONTRACT_SCHEMA.md), so its output can be cited directly as
// evidence in a generation record.
//
// This measures whatever's rendering on the configured URL via a generic
// requestAnimationFrame sampler -- it does not know anything about this
// project's own scenes, stress tests, or content. Extend it (or add sibling
// scripts alongside it) for a specific, repeatable in-app scenario the same
// way a project-specific stress scene would be built on top of these
// primitives.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launchPerfBrowser,
  sampleFrameTimes,
  frameStats,
  histogram,
  openCdp,
  heapUsage,
  collectGarbage,
} from './perf-lib.ts';
import { runGpuGate } from './gpu-gate.ts';

interface PerfConfig {
  url: string;
  warmupMs: number;
  durationMs: number;
  heapSoakMs: number;
  budgets: {
    p50Ms?: number;
    p99Ms: number;
    maxMs: number;
    heapGrowthMbPerMin: number;
  };
}

const DEFAULT_CONFIG: PerfConfig = {
  url: 'http://127.0.0.1:4173/',
  warmupMs: 3000,
  durationMs: 15000,
  heapSoakMs: 30000,
  budgets: { p99Ms: 16.6, maxMs: 50, heapGrowthMbPerMin: 1 },
};

const HERE = dirname(fileURLToPath(import.meta.url));

function loadConfig(): PerfConfig {
  const configPath = resolve(process.argv[2] ?? join(HERE, 'perf.config.json'));
  if (!existsSync(configPath)) {
    console.warn(`[perf] no config at ${configPath}, using defaults (edit harness/perf.config.json for this project's real URL/budgets)`);
    return DEFAULT_CONFIG;
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return { ...DEFAULT_CONFIG, ...raw, budgets: { ...DEFAULT_CONFIG.budgets, ...raw.budgets } };
}

function round(v: number, digits = 3): number {
  const k = Math.pow(10, digits);
  return Math.round(v * k) / k;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const outDir = join(HERE, 'perf-out');
  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, `report-${Date.now()}.json`);

  console.log('[perf] running GPU hardware gate ...');
  const gate = await runGpuGate();
  console.log(`[perf] gate: ${gate.pass ? 'PASS' : 'FAIL'} -- ${gate.reason}`);

  if (!gate.pass) {
    const report = {
      performanceGate: { evaluated: true, pass: false, evidence: [reportPath], reason: `GPU gate failed: ${gate.reason}` },
      gate,
      environment: { platform: process.platform, arch: process.arch, nodeVersion: process.version },
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.error(`[perf] VOID -- see ${reportPath}`);
    process.exit(1);
  }

  const browser = await launchPerfBrowser();
  try {
    const page = await browser.newPage();
    console.log(`[perf] navigating to ${config.url} ...`);
    await page.goto(config.url);

    console.log(`[perf] warming up ${config.warmupMs} ms ...`);
    await new Promise((r) => setTimeout(r, config.warmupMs));

    console.log(`[perf] sampling frame times for ${config.durationMs} ms ...`);
    const dt = await sampleFrameTimes(page, config.durationMs);
    const stats = frameStats(dt);
    const hist = histogram(dt);

    console.log(`[perf] measuring heap growth over a ${config.heapSoakMs} ms soak ...`);
    const client = await openCdp(page);
    await collectGarbage(client);
    const before = await heapUsage(client);
    await new Promise((r) => setTimeout(r, config.heapSoakMs));
    await collectGarbage(client);
    const after = await heapUsage(client);
    const heapGrowthBytesPerMin = ((after.usedSize - before.usedSize) / config.heapSoakMs) * 60_000;
    const heapGrowthMbPerMin = heapGrowthBytesPerMin / (1024 * 1024);

    const budgetChecks = {
      p99: stats.p99 <= config.budgets.p99Ms,
      max: stats.max <= config.budgets.maxMs,
      heapGrowth: heapGrowthMbPerMin <= config.budgets.heapGrowthMbPerMin,
    };
    const pass = Object.values(budgetChecks).every(Boolean) && stats.count > 0;
    const failReasons: string[] = [];
    if (!budgetChecks.p99) failReasons.push(`p99 ${round(stats.p99)}ms > budget ${config.budgets.p99Ms}ms`);
    if (!budgetChecks.max) failReasons.push(`max ${round(stats.max)}ms > budget ${config.budgets.maxMs}ms`);
    if (!budgetChecks.heapGrowth) failReasons.push(`heap growth ${round(heapGrowthMbPerMin, 4)}MB/min > budget ${config.budgets.heapGrowthMbPerMin}MB/min`);
    if (stats.count === 0) failReasons.push('zero frames sampled -- page may not be rendering');

    const report = {
      performanceGate: {
        evaluated: true,
        pass,
        evidence: [reportPath],
        ...(pass ? {} : { reason: failReasons.join('; ') }),
      },
      gate,
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        url: config.url,
        capturedAt: new Date().toISOString(),
      },
      config,
      measured: {
        frameTimeMs: { ...stats, p50: round(stats.p50), p90: round(stats.p90), p99: round(stats.p99), p999: round(stats.p999), max: round(stats.max), min: round(stats.min), meanFps: round(stats.meanFps, 1) },
        heapGrowthBytesPerMin: Math.round(heapGrowthBytesPerMin),
        heapGrowthMbPerMin: round(heapGrowthMbPerMin, 4),
        heapUsedBeforeBytes: before.usedSize,
        heapUsedAfterBytes: after.usedSize,
      },
      budgets: config.budgets,
      budgetChecks,
      histogram: hist,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`[perf] ${pass ? 'PASS' : 'FAIL'} -- p99 ${round(stats.p99)}ms, max ${round(stats.max)}ms, heap growth ${round(heapGrowthMbPerMin, 4)}MB/min`);
    console.log(`[perf] report: ${reportPath}`);
    if (!pass) console.error(`[perf] over budget: ${failReasons.join('; ')}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[perf] run failed:', err);
  process.exit(1);
});
