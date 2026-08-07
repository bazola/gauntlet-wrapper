import chokidar, { type FSWatcher } from 'chokidar';
import { join } from 'node:path';
import type { ProgressSnapshot } from '@gauntlet-wrapper/shared';
import { readProgressSnapshot } from './progressReader.js';

type Listener = (snapshot: ProgressSnapshot) => void;

interface Entry {
  watcher: FSWatcher;
  listeners: Set<Listener>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  projectPath: string;
}

// One chokidar watcher per project, shared across however many browser tabs
// are subscribed to its progress channel -- not one per subscriber. Lazily
// created on first subscribe and torn down once the last listener leaves;
// Phase 6 flips this to "every registered project, watched from boot" so a
// backgrounded project's progress keeps updating even with no tab open on it.
const entries = new Map<string, Entry>();

function scheduleBroadcast(projectId: string): void {
  const entry = entries.get(projectId);
  if (!entry) return;
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => {
    readProgressSnapshot(entry.projectPath)
      .then((snapshot) => {
        for (const listener of entry.listeners) listener(snapshot);
      })
      .catch((err) => {
        console.error(`[gauntlet-wrapper] failed to read progress snapshot for ${projectId}:`, err);
      });
  }, 300);
}

export function subscribeProgress(projectId: string, projectPath: string, listener: Listener): () => void {
  let entry = entries.get(projectId);
  if (!entry) {
    const progressDir = join(projectPath, '.gauntlet', 'progress');
    // usePolling, not native fs.watch: chokidar's native watcher hits a fatal
    // libuv assertion (fs-event.c, _wcsnicmp dir-prefix check) on Windows when
    // any path segment has an 8.3 short-name alias (e.g. a username that
    // collapses to BAZOLA~1) -- confirmed by reproducing it directly. That's
    // not a rare edge case on Windows and the crash takes down the whole
    // server process, not just this watcher, so polling is the safe default
    // here rather than an optimization to reach for later.
    const watcher = chokidar.watch(progressDir, {
      ignoreInitial: true,
      usePolling: true,
      interval: 500,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    entry = { watcher, listeners: new Set(), debounceTimer: null, projectPath };
    entries.set(projectId, entry);
    watcher.on('all', () => scheduleBroadcast(projectId));
    watcher.on('error', (err) => {
      console.error(`[gauntlet-wrapper] progress watcher error for ${projectId}:`, err);
    });
  }

  entry.listeners.add(listener);

  return () => {
    const current = entries.get(projectId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      if (current.debounceTimer) clearTimeout(current.debounceTimer);
      current.watcher.close().catch(() => {});
      entries.delete(projectId);
    }
  };
}

export function getProgressSnapshot(projectPath: string): Promise<ProgressSnapshot> {
  return readProgressSnapshot(projectPath);
}

export function closeAllProgressWatchers(): void {
  for (const entry of entries.values()) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.watcher.close().catch(() => {});
  }
  entries.clear();
}
