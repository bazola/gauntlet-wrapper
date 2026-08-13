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

// Every session the wrapper launches runs unattended and is meant to keep
// looping without a human sitting at the keyboard approving each tool call --
// per explicit user instruction, permission prompts are always skipped. This
// is the one place that decision lives; there is deliberately no per-project
// or UI toggle for it.
//
// The command itself is configurable (GAUNTLET_WRAPPER_CLAUDE_COMMAND) for
// setups where `claude` isn't the right thing to type -- e.g. it's shadowed
// by a wrapper script, or the real CLI is installed under a different name.
const CLAUDE_LAUNCH_COMMAND = `${process.env.GAUNTLET_WRAPPER_CLAUDE_COMMAND ?? 'claude --dangerously-skip-permissions'}\r`;

// GAUNTLET_WRAPPER_CLAUDE_ENV: comma-separated KEY=VALUE pairs applied to the
// launched shell's environment on top of whatever the wrapper server itself
// inherited. An empty VALUE deletes the variable instead of setting it.
//
// This exists because `claude` often isn't configured purely by its own
// install -- environment variables like ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY
// can be set globally (e.g. by a local API router/proxy such as
// claude-code-router) to redirect *every* `claude` invocation on the machine
// through something other than the real Anthropic API. If the wrapper server
// process inherits those, every session it launches silently goes through
// that redirect too, which can break gauntlet runs in ways that look like
// "claude is broken" but are really "claude is pointed somewhere unexpected".
//
// Use this to strip or override just for wrapper-launched sessions, without
// touching your normal shell setup. Example, to force the real Anthropic API
// regardless of a locally configured router, and use a separate config dir
// so it doesn't share credentials/state with your routed setup:
//   GAUNTLET_WRAPPER_CLAUDE_ENV=ANTHROPIC_API_KEY=,ANTHROPIC_AUTH_TOKEN=,ANTHROPIC_BASE_URL=,CLAUDE_CONFIG_DIR=C:\Users\me\.claude-real
function parseClaudeEnvOverrides(raw: string | undefined): Array<[string, string | undefined]> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) return [pair, undefined] as [string, string | undefined];
      const value = pair.slice(eq + 1);
      return [pair.slice(0, eq).trim(), value.length > 0 ? value : undefined] as [
        string,
        string | undefined,
      ];
    });
}

function resolveClaudeEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) };
  for (const [key, value] of parseClaudeEnvOverrides(process.env.GAUNTLET_WRAPPER_CLAUDE_ENV)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

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
      env: resolveClaudeEnv(),
      useConpty: process.platform === 'win32',
    });

    this.ptyProcess.onData((data) => {
      this.appendScrollback(data);
      for (const listener of this.dataListeners) listener(data);
      if (!this.claudeLaunched) {
        this.claudeLaunched = true;
        // Fire on the first output chunk (the shell's banner/prompt), which is
        // proof the pty is actually ready to receive input.
        this.ptyProcess.write(CLAUDE_LAUNCH_COMMAND);
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
