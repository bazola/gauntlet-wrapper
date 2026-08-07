import { useEffect, useRef, useState } from 'react';
import type { ProjectRegistryEntry, PendingNotification, WsServerEnvelope } from '@gauntlet-wrapper/shared';
import { wsClient } from '../../api/wsClient';

interface NotificationBannerProps {
  projects: ProjectRegistryEntry[];
  onOpenProject: (projectId: string) => void;
}

export function NotificationBanner({ projects, onOpenProject }: NotificationBannerProps) {
  const [pending, setPending] = useState<Record<string, PendingNotification>>({});
  // Web Notification API dedupe: only fire a native notification the moment a
  // project transitions into "pending", not on every re-render.
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    for (const p of projects) {
      wsClient.send({ channel: 'notifications', project: p.id, type: 'subscribe' });
    }
    return () => {
      for (const p of projects) {
        wsClient.send({ channel: 'notifications', project: p.id, type: 'unsubscribe' });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map((p) => p.id).join(',')]);

  useEffect(() => {
    const off = wsClient.addListener((msg: WsServerEnvelope) => {
      if (msg.channel !== 'notifications' || msg.type !== 'pending') return;

      setPending((prev) => {
        const next = { ...prev };
        if (msg.payload) {
          next[msg.project] = msg.payload;
          if (!notifiedRef.current.has(msg.project) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const project = projects.find((p) => p.id === msg.project);
            new Notification(`${project?.displayName ?? 'gauntlet-wrapper'} is waiting for you`, {
              body: msg.payload.message || 'Claude needs your input.',
            });
          }
          notifiedRef.current.add(msg.project);
        } else {
          delete next[msg.project];
          notifiedRef.current.delete(msg.project);
        }
        return next;
      });
    });
    return off;
  }, [projects]);

  const ack = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/notifications/ack`, { method: 'POST' });
    } catch {
      // best-effort -- the next snapshot push will resync if this fails
    }
    setPending((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    notifiedRef.current.delete(projectId);
  };

  const entries = Object.entries(pending);
  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {entries.map(([projectId, notif]) => {
        const project = projects.find((p) => p.id === projectId);
        return (
          <div
            key={projectId}
            onClick={() => onOpenProject(projectId)}
            style={{
              background: '#2d6cdf',
              color: '#fff',
              padding: '0.6rem 0.9rem',
              borderRadius: '6px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
              maxWidth: '320px',
              cursor: 'pointer',
            }}
          >
            <strong>{project?.displayName ?? projectId} is waiting for you</strong>
            <p style={{ fontSize: '0.8rem', margin: '0.3rem 0 0' }}>{notif.message || 'Claude needs your input.'}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                ack(projectId);
              }}
              style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
}
