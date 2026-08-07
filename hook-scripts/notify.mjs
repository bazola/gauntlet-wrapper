#!/usr/bin/env node
// Installed by gauntlet-wrapper into a target repo's Claude Code hooks (see
// packages/server/src/hooks/hookInstaller.ts) as the command for the
// Notification hook event. Claude Code pipes the event JSON to stdin and
// runs this once per notification; it must never block or error the Claude
// Code session, so every path here ends in a fast process.exit(0).
import http from 'node:http';

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const projectId = getArg('project');
const port = Number(getArg('port') || '4577');

// Safety net first: if stdin never ends (piping issue, host quirk), don't
// hang the Claude Code process waiting on us.
const hardExit = setTimeout(() => process.exit(0), 3000);
hardExit.unref();

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  let event = {};
  try {
    event = JSON.parse(input);
  } catch {
    // malformed/empty stdin -- still worth pinging the wrapper with what we know
  }

  const body = JSON.stringify({
    projectId,
    sessionId: event.session_id ?? null,
    cwd: event.cwd ?? null,
    message: event.message ?? '',
  });

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: '/api/hooks/notification',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 2000,
    },
    (res) => {
      res.resume();
      process.exit(0);
    },
  );
  req.on('error', () => process.exit(0));
  req.on('timeout', () => {
    req.destroy();
    process.exit(0);
  });
  req.write(body);
  req.end();
});
