import type { PendingNotification } from '@gauntlet-wrapper/shared';

type Listener = (pending: PendingNotification | null) => void;

// In-memory only -- a pending notification is ephemeral wrapper-UI state, not
// project data, so it doesn't belong under .gauntlet/.
const pending = new Map<string, PendingNotification>();
const listeners = new Map<string, Set<Listener>>();

function broadcast(projectId: string): void {
  const set = listeners.get(projectId);
  if (!set) return;
  const current = pending.get(projectId) ?? null;
  for (const listener of set) listener(current);
}

export function recordNotification(projectId: string, notification: PendingNotification): void {
  pending.set(projectId, notification);
  broadcast(projectId);
}

// Cleared either by an explicit banner dismissal or by the user sending any
// keystroke to that project's terminal (see wsServer.ts's 'input' handler) --
// both mean "the human is looking at it now."
export function clearNotification(projectId: string): void {
  if (pending.delete(projectId)) broadcast(projectId);
}

export function getPendingNotification(projectId: string): PendingNotification | null {
  return pending.get(projectId) ?? null;
}

export function subscribeNotifications(projectId: string, listener: Listener): () => void {
  let set = listeners.get(projectId);
  if (!set) {
    set = new Set();
    listeners.set(projectId, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(projectId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(projectId);
  };
}
