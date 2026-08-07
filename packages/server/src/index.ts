import express from 'express';
import { createServer } from 'node:http';
import { projectsRouter } from './api/routes/projects.js';
import { configRouter } from './api/routes/config.js';
import { settingsRouter } from './api/routes/settings.js';
import { notificationsAckRouter } from './api/routes/notifications.js';
import { filesystemRouter } from './api/routes/filesystem.js';
import { importRouter } from './api/routes/import.js';
import { referencesRouter } from './references/uploadRoutes.js';
import { notificationHookRouter } from './hooks/notificationRoute.js';
import { ensureHookScriptInstalled } from './hooks/installHookScript.js';
import { attachWsServer } from './ws/wsServer.js';
import { killAllSessions } from './pty/ptyRegistry.js';
import { closeAllProgressWatchers } from './progress/progressWatcherRegistry.js';
import { SERVER_PORT } from './config/serverPort.js';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gauntlet-wrapper-server' });
});

app.use('/api/settings', settingsRouter);
app.use('/api/filesystem', filesystemRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:id', configRouter);
app.use('/api/projects/:id/references', referencesRouter);
app.use('/api/projects/:id/notifications', notificationsAckRouter);
app.use('/api/projects/:id/import', importRouter);
app.use('/api/hooks/notification', notificationHookRouter);

// Last middleware: every route handler is wrapped with asyncHandler (see
// api/asyncHandler.ts) so a rejected promise ends up here instead of
// crashing the process -- this is the actual response side of that.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[gauntlet-wrapper] unhandled route error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal server error' });
  }
});

const httpServer = createServer(app);
attachWsServer(httpServer);

await ensureHookScriptInstalled();

httpServer.listen(SERVER_PORT, () => {
  console.log(`gauntlet-wrapper server listening on http://127.0.0.1:${SERVER_PORT}`);
});

function shutdown(): void {
  killAllSessions();
  closeAllProgressWatchers();
  httpServer.close(() => process.exit(0));
  // Force-exit if something is still holding the event loop open.
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
