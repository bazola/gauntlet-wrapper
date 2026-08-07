// What notify.mjs POSTs to /api/hooks/notification, augmented with a server
// timestamp; held in-memory per project until acked or cleared by terminal input.
export interface PendingNotification {
  sessionId: string | null;
  cwd: string | null;
  message: string;
  receivedAt: string;
}
