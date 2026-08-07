import type { WsClientEnvelope, WsServerEnvelope } from '@gauntlet-wrapper/shared';

type Listener = (msg: WsServerEnvelope) => void;

// One websocket per browser tab, multiplexing every project+channel through
// the envelope protocol (see packages/shared/src/types/ws.ts). Phase 1 only
// ever has one active subscription, but the shape already generalizes to
// Phase 6 without rework -- consumers just filter by `project`/`channel`.
class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: WsClientEnvelope[] = [];

  private ensureConnected(): WebSocket {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return this.socket;
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${window.location.host}/ws`);

    socket.addEventListener('open', () => {
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
