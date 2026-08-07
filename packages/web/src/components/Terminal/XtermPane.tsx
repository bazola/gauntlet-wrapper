import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { WsServerEnvelope } from '@gauntlet-wrapper/shared';
import { wsClient } from '../../api/wsClient';

interface XtermPaneProps {
  projectId: string;
}

export function XtermPane({ projectId }: XtermPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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

    const sendResize = () => {
      fitAddon.fit();
      if (term.cols > 0 && term.rows > 0) {
        wsClient.send({ channel: 'terminal', project: projectId, type: 'resize', cols: term.cols, rows: term.rows });
      }
    };

    wsClient.send({ channel: 'terminal', project: projectId, type: 'subscribe' });
    sendResize();

    const offMessage = wsClient.addListener((msg: WsServerEnvelope) => {
      if (msg.channel !== 'terminal' || msg.project !== projectId) return;
      if (msg.type === 'scrollback' || msg.type === 'data') {
        term.write(msg.payload);
      } else if (msg.type === 'exit') {
        term.write(`\r\n\x1b[31m[session exited, code ${msg.payload}]\x1b[0m\r\n`);
      } else if (msg.type === 'error') {
        term.write(`\r\n\x1b[31m[error: ${msg.payload}]\x1b[0m\r\n`);
      }
    });

    const dataDisposable = term.onData((data) => {
      wsClient.send({ channel: 'terminal', project: projectId, type: 'input', payload: data });
    });

    const resizeObserver = new ResizeObserver(() => sendResize());
    resizeObserver.observe(container);

    return () => {
      offMessage();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      wsClient.send({ channel: 'terminal', project: projectId, type: 'unsubscribe' });
      term.dispose();
    };
  }, [projectId]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
