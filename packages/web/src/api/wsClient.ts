import type { WsClientEnvelope, WsServerEnvelope } from '@gauntlet-wrapper/shared';

type Listener = (msg: WsServerEnvelope) => void;

function subscriptionKey(msg: { channel: string; project: string }): string {
  return `${msg.channel}:${msg.project}`;
}

// One websocket per browser tab, multiplexing every project+channel through
// the envelope protocol (see packages/shared/src/types/ws.ts). Consumers just
// filter incoming messages by project/channel.
class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: WsClientEnvelope[] = [];
  // Every currently-active 'subscribe' envelope, keyed by channel+project.
  // Replayed on every (re)connect -- without this, a tab left open across a
  // backend restart (or any dropped connection) silently stops receiving
  // live updates for whatever it had subscribed to, since the server's
  // in-memory subscription state died with the old connection and no
  // component re-sends 'subscribe' on its own (it only does that once, on
  // mount).
  private activeSubscriptions = new Map<string, WsClientEnvelope>();

  private ensureConnected(): WebSocket {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return this.socket;
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.addEventListener('open', () => {
      for (const sub of this.activeSubscriptions.values()) socket.send(JSON.stringify(sub));
      for (const msg of this.queue.splice(0)) socket.send(JSON.stringify(msg));
    });
    socket.addEventListener('message', (event) => {
      let msg: WsServerEnvelope;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const listener of this.listeners) listener(msg);
    });
    socket.addEventListener('close', () => {
      setTimeout(() => this.ensureConnected(), 1000);
    });

    this.socket = socket;
    return socket;
  }

  send(msg: WsClientEnvelope): void {
    if (msg.type === 'subscribe') {
      this.activeSubscriptions.set(subscriptionKey(msg), msg);
    } else if (msg.type === 'unsubscribe') {
      this.activeSubscriptions.delete(subscriptionKey(msg));
    }

    const socket = this.ensureConnected();
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  addListener(listener: Listener): () => void {
    this.ensureConnected();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const wsClient = new WsClient();
