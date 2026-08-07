import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { WsClientEnvelope, WsServerEnvelope } from '@gauntlet-wrapper/shared';
import { getProject } from '../registry/registry.js';
import { getOrCreateSession, getSession } from '../pty/ptyRegistry.js';
import { subscribeProgress, getProgressSnapshot } from '../progress/progressWatcherRegistry.js';
import { subscribeNotifications, getPendingNotification, clearNotification } from '../hooks/notificationState.js';

function send(socket: WebSocket, envelope: WsServerEnvelope): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }
}

export function attachWsServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    // One unsubscribe callback per (project, channel) this socket is subscribed to.
    const unsubscribers = new Map<string, () => void>();

    send(socket, { channel: 'system', type: 'hello' });

    // socket.on's listener isn't awaited by EventEmitter either -- an async
    // listener that throws becomes the same kind of unhandled rejection that
    // crashed the whole process once already (see asyncHandler.ts), so this
    // is wrapped the same way rather than passed to socket.on directly.
    const handleMessage = async (raw: RawData): Promise<void> => {
      let msg: WsClientEnvelope;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames
      }

      const key = `${msg.project}:${msg.channel}`;

      if (msg.channel === 'terminal') {
        if (msg.type === 'subscribe') {
          const project = await getProject(msg.project);
          if (!project) {
            send(socket, { channel: 'terminal', project: msg.project, type: 'error', payload: 'unknown project' });
            return;
          }
          unsubscribers.get(key)?.(); // idempotent re-subscribe

          const session = getOrCreateSession(project.id, project.path);
          send(socket, { channel: 'terminal', project: project.id, type: 'scrollback', payload: session.getScrollback() });

          const offData = session.onData((data) => {
            send(socket, { channel: 'terminal', project: project.id, type: 'data', payload: data });
          });
          const offExit = session.onExit(({ exitCode }) => {
            send(socket, { channel: 'terminal', project: project.id, type: 'exit', payload: String(exitCode) });
          });
          unsubscribers.set(key, () => {
            offData();
            offExit();
          });
          return;
        }

        if (msg.type === 'unsubscribe') {
          unsubscribers.get(key)?.();
          unsubscribers.delete(key);
          return;
        }

        if (msg.type === 'input') {
          // Input only makes sense after a subscribe already created the session
          // (which is the only place we need a fs lookup for the project path).
          getSession(msg.project)?.write(msg.payload);
          // Any keystroke into this project's terminal means the human is
          // looking at it right now -- clears a pending "waiting for you" alert.
          clearNotification(msg.project);
          return;
        }

        if (msg.type === 'resize') {
          getSession(msg.project)?.resize(msg.cols, msg.rows);
          return;
        }
      }

      if (msg.channel === 'progress') {
        if (msg.type === 'subscribe') {
          const project = await getProject(msg.project);
          if (!project) {
            send(socket, { channel: 'progress', project: msg.project, type: 'error', payload: 'unknown project' });
            return;
          }
          unsubscribers.get(key)?.(); // idempotent re-subscribe

          // Send what's on disk right now, then keep pushing on every change --
          // a subscriber shouldn't have to wait for a file write to see the
          // current state.
          const initial = await getProgressSnapshot(project.path);
          send(socket, { channel: 'progress', project: project.id, type: 'snapshot', payload: initial });

          const off = subscribeProgress(project.id, project.path, (snapshot) => {
            send(socket, { channel: 'progress', project: project.id, type: 'snapshot', payload: snapshot });
          });
          unsubscribers.set(key, off);
          return;
        }

        if (msg.type === 'unsubscribe') {
          unsubscribers.get(key)?.();
          unsubscribers.delete(key);
          return;
        }
      }

      if (msg.channel === 'notifications') {
        if (msg.type === 'subscribe') {
          const project = await getProject(msg.project);
          if (!project) return; // no error frame here -- this channel is subscribed to speculatively for every registered project

          unsubscribers.get(key)?.(); // idempotent re-subscribe

          send(socket, { channel: 'notifications', project: project.id, type: 'pending', payload: getPendingNotification(project.id) });

          const off = subscribeNotifications(project.id, (pending) => {
            send(socket, { channel: 'notifications', project: project.id, type: 'pending', payload: pending });
          });
          unsubscribers.set(key, off);
          return;
        }

        if (msg.type === 'unsubscribe') {
          unsubscribers.get(key)?.();
          unsubscribers.delete(key);
          return;
        }
      }
    };

    socket.on('message', (raw) => {
      handleMessage(raw).catch((err) => {
        console.error('[gauntlet-wrapper] ws message handler error:', err);
      });
    });

    socket.on('close', () => {
      for (const off of unsubscribers.values()) off();
      unsubscribers.clear();
    });
  });

  return wss;
}
