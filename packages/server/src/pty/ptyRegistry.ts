import { PtySession } from './ptySession.js';
import { readConfig, markSeedPromptDelivered } from '../projects/configStore.js';
import { readCurrentGeneration } from '../progress/currentGeneration.js';
import { buildKickoffPrompt, buildResumeNote } from '../seedPrompt/buildSeedPrompt.js';

// Map<projectId, PtySession> -- at most one claude PTY per project. Reattaches
// rather than duplicating if a session is already running for that project,
// which is also the seam Phase 6 generalizes into full multi-project
// concurrency (this already IS that map, just driven by one browser tab today).
const sessions = new Map<string, PtySession>();

// Only ever called from POST /api/projects/:id/terminal/start (see
// api/routes/terminal.ts) -- an explicit human action, never implicitly from
// a websocket subscribe. Merely viewing the Session tab must not spawn a PTY
// or start delivering the kickoff/resume prompt; the user gets to look
// around and edit things first.
export function getOrCreateSession(projectId: string, cwd: string): PtySession {
  const existing = sessions.get(projectId);
  if (existing && existing.isAlive()) return existing;

  const session = new PtySession(projectId, cwd);
  sessions.set(projectId, session);
  session.onExit(() => {
    if (sessions.get(projectId) === session) sessions.delete(projectId);
  });

  // Fire-and-forget: only ever runs for a session we just created above, never
  // a reattach, so the kickoff/resume prompt is queued exactly once per PTY.
  deliverBootPrompt(session, cwd).catch((err) => {
    console.error(`[gauntlet-wrapper] failed to prepare boot prompt for project ${projectId}:`, err);
  });

  return session;
}

async function deliverBootPrompt(session: PtySession, projectPath: string): Promise<void> {
  const config = await readConfig(projectPath);

  if (!config.onboarding.seedPromptDelivered) {
    const text = await buildKickoffPrompt(projectPath, config);
    session.deliverBootPrompt(text);
    // Marked delivered as soon as it's queued, not after a confirmed read --
    // there's no way to confirm an interactive TUI actually consumed pasted
    // input. Acceptable: worst case a crash mid-delivery means a resume note
    // plays next time instead of a repeat kickoff, which is a harmless miss.
    await markSeedPromptDelivered(projectPath);
    return;
  }

  const currentGeneration = (await readCurrentGeneration(projectPath)) ?? 0;
  const text = await buildResumeNote(projectPath, config, currentGeneration);
  session.deliverBootPrompt(text);
}

export function getSession(projectId: string): PtySession | undefined {
  return sessions.get(projectId);
}

export function killAllSessions(): void {
  for (const session of sessions.values()) session.kill();
  sessions.clear();
}
