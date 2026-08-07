import type { ProgressSnapshot } from '../schemas/progress.schema.js';
import type { PendingNotification } from './notification.js';

export type WsChannel = 'terminal' | 'progress' | 'notifications';

export type WsClientEnvelope =
  | { channel: 'terminal'; project: string; type: 'subscribe' }
  | { channel: 'terminal'; project: string; type: 'unsubscribe' }
  | { channel: 'terminal'; project: string; type: 'input'; payload: string }
  | { channel: 'terminal'; project: string; type: 'resize'; cols: number; rows: number }
  | { channel: 'progress'; project: string; type: 'subscribe' }
  | { channel: 'progress'; project: string; type: 'unsubscribe' }
  | { channel: 'notifications'; project: string; type: 'subscribe' }
  | { channel: 'notifications'; project: string; type: 'unsubscribe' };

export type WsServerEnvelope =
  | { channel: 'system'; type: 'hello' }
  | { channel: 'terminal'; project: string; type: 'scrollback'; payload: string }
  | { channel: 'terminal'; project: string; type: 'data'; payload: string }
  | { channel: 'terminal'; project: string; type: 'exit'; payload: string }
  | { channel: 'terminal'; project: string; type: 'error'; payload: string }
  | { channel: 'progress'; project: string; type: 'snapshot'; payload: ProgressSnapshot }
  | { channel: 'progress'; project: string; type: 'error'; payload: string }
  | { channel: 'notifications'; project: string; type: 'pending'; payload: PendingNotification | null };
