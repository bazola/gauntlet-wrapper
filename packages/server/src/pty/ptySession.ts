import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

// Keep enough scrollback that a reconnecting browser tab can rehydrate a
// reasonable window of history without unbounded memory growth per session.
const SCROLLBACK_MAX_CHARS = 200_000;

// How long the pty has to go quiet before we treat it as "settled" and safe
// to act on -- there is no true readiness signal available yet (that arrives
// with the Phase 5 Notification hook), so this is a heuristic: real terminal
// apps stop repainting once they're sitting at a stable prompt.
const IDLE_MS = 1200;

// Wrapping pasted text in bracketed-paste markers makes the terminal app
// treat embedded newlines as literal content instead of each one acting as a
// premature Enter/submit -- this is exactly what a real terminal emulator
// does when you paste multi-line text, we just have to emit it ourselves
// since we're writing synthetic input.
const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';

export type PtyDataListener = (data: string) => void;
export type PtyExitListener = (info: { exitCode: number; signal?: number }) => void;

function resolveShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.COMSPEC || 'cmd.exe', args: [] };
  }
  return { file: process.env.SHELL || '/bin/bash', args: [] };
}

// One PTY = one platform shell, with `claude` typed into it once the shell has
// printed its first prompt. Spawning `claude` (an npm-installed .cmd shim on
// Windows) directly through ConPTY fails PATH/PATHEXT resolution; going
// through a real interactive shell sidesteps that and is cross-platform, and
// it's also what the Phase 3 seed-prompt delivery needs (typing text into an
// already-running PTY) -- so this is the one mechanism for both.
export class PtySession {
  readonly projectId: string;
  private ptyProcess: IPty;
  private scrollback = '';
  private dataListeners = new Set<PtyDataListener>();
  private exitListeners = new Set<PtyExitListener>();
  private exited = false;
  private claudeLaunched = false;
  private bootQueue: Array<() => void> = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(projectId: string, cwd: string) {
    this.projectId = projectId;
    const shell = resolveShell();

    this.ptyProcess = pty.spawn(shell.file, shell.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
      useConpty: process.platform === 'win32',
    });

    this.ptyProcess.onData((data) => {
      this.appendScrollback(data);
      for (const listener of this.dataListeners) listener(data);
      if (!this.claudeLaunched) {
        this.claudeLaunched = true;
        // Fire on the first output chunk (the shell's banner/prompt), which is
        // proof the pty is actually ready to receive input.
        this.ptyProcess.write('claude\r');
      }
      this.armIdleWatch();
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.exited = true;
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.bootQueue = [];
      for (const listener of this.exitListeners) listener({ exitCode, signal });
    });
  }

  private armIdleWatch(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.bootQueue.length === 0) return;
    this.idleTimer = setTimeout(() => {
      const step = this.bootQueue.shift();
      step?.();
      this.armIdleWatch();
    }, IDLE_MS);
  }

  // Queues delivery of the kickoff/resume prompt: wait for the pty to go
  // quiet, send a bare Enter (accepts a possible trust-folder prompt's
  // default option; a harmless no-op on an already-empty input box if claude
  // is already past it), wait for quiet again, then paste the prompt text as
  // one bracketed-paste block and submit it. Heuristic, not exact -- see
  // IDLE_MS above. Safe to call only once per session; ptyRegistry enforces
  // that (only fires for a freshly-created session, never a reattach).
  deliverBootPrompt(text: string): void {
    this.bootQueue.push(
      () => this.write('\r'),
      () => this.write(`${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}\r`),
    );
    this.armIdleWatch();
  }

  private appendScrollback(data: string): void {
    this.scrollback += data;
    if (this.scrollback.length > SCROLLBACK_MAX_CHARS) {
      this.scrollback = this.scrollback.slice(this.scrollback.length - SCROLLBACK_MAX_CHARS);
    }
  }

  getScrollback(): string {
    return this.scrollback;
  }

  isAlive(): boolean {
    return !this.exited;
  }

  write(data: string): void {
    if (!this.exited) this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.exited && cols > 0 && rows > 0) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  onData(listener: PtyDataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onExit(listener: PtyExitListener): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  kill(): void {
    if (!this.exited) {
      try {
        this.ptyProcess.kill();
      } catch {
        // already dead
      }
    }
  }
}
