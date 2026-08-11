import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { WsServerEnvelope } from '@gauntlet-wrapper/shared';
import { wsClient } from '../../api/wsClient';

interface XtermPaneProps {
  projectId: string;
}

type SessionState = 'unknown' | 'not-started' | 'starting' | 'running';

export function XtermPane({ projectId }: XtermPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  // Scrollback can arrive before the terminal-creation effect below has run
  // (session-state change and terminal mount happen on different renders) --
  // stashed here so it's never lost, written in once the terminal exists.
  const pendingScrollbackRef = useRef<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('unknown');
  const [startError, setStartError] = useState<string | null>(null);

  // Subscribed for the component's whole lifetime regardless of session
  // state, so the moment a start succeeds this hears about it without a
  // fresh subscribe -- the server pushes 'not-started' immediately if no PTY
  // exists yet, never creating one on its own.
  useEffect(() => {
    setSessionState('unknown');
    pendingScrollbackRef.current = null;
    wsClient.send({ channel: 'terminal', project: projectId, type: 'subscribe' });

    const off = wsClient.addListener((msg: WsServerEnvelope) => {
      if (msg.channel !== 'terminal' || msg.project !== projectId) return;
      if (msg.type === 'not-started') {
        setSessionState((prev) => (prev === 'starting' ? prev : 'not-started'));
        return;
      }
      if (msg.type === 'scrollback') {
        pendingScrollbackRef.current = msg.payload;
        termRef.current?.write(msg.payload);
        setSessionState('running');
        return;
      }
      if (msg.type === 'data') {
        termRef.current?.write(msg.payload);
        return;
      }
      if (msg.type === 'exit') {
        termRef.current?.write(`\r\n\x1b[31m[session exited, code ${msg.payload}]\x1b[0m\r\n`);
        return;
      }
      if (msg.type === 'error') {
        termRef.current?.write(`\r\n\x1b[31m[error: ${msg.payload}]\x1b[0m\r\n`);
      }
    });

    return () => {
      off();
      wsClient.send({ channel: 'terminal', project: projectId, type: 'unsubscribe' });
    };
  }, [projectId]);

  // Only creates the actual xterm.js instance once a session is confirmed
  // running -- never eagerly, so "open the Session tab" alone can't spawn
  // anything.
  useEffect(() => {
    if (sessionState !== 'running') return;
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      convertEol: true,
      fontSize: 14,
      theme: { background: '#14161a', foreground: '#e8e8e8' },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();
    termRef.current = term;

    if (pendingScrollbackRef.current) {
      term.write(pendingScrollbackRef.current);
      pendingScrollbackRef.current = null;
    }

    const sendResize = () => {
      fitAddon.fit();
      if (term.cols > 0 && term.rows > 0) {
        wsClient.send({ channel: 'terminal', project: projectId, type: 'resize', cols: term.cols, rows: term.rows });
      }
    };
    sendResize();

    const dataDisposable = term.onData((data) => {
      wsClient.send({ channel: 'terminal', project: projectId, type: 'input', payload: data });
    });

    const resizeObserver = new ResizeObserver(() => sendResize());
    resizeObserver.observe(container);

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionState, projectId]);

  const start = async () => {
    setSessionState('starting');
    setStartError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/terminal/start`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      // The already-open subscription got 'not-started' and wired nothing up
      // server-side -- re-subscribe now that a session actually exists so
      // the server attaches for real and sends fresh scrollback.
      wsClient.send({ channel: 'terminal', project: projectId, type: 'subscribe' });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
      setSessionState('not-started');
    }
  };

  if (sessionState === 'unknown') {
    return <p style={{ color: '#888' }}>Checking session status...</p>;
  }

  if (sessionState === 'not-started' || sessionState === 'starting') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
        <p style={{ color: '#aaa', margin: 0 }}>This project's Claude Code session hasn't been started yet.</p>
        <button onClick={start} disabled={sessionState === 'starting'} style={{ padding: '0.5rem 1.2rem' }}>
          {sessionState === 'starting' ? 'Starting...' : 'Start Claude Code session'}
        </button>
        {startError && <span style={{ color: '#e88' }}>{startError}</span>}
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
