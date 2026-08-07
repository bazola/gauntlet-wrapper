import { Router } from 'express';
import { getProject } from '../registry/registry.js';
import { recordNotification } from './notificationState.js';
import { asyncHandler } from '../api/asyncHandler.js';

// Mounted at /api/hooks/notification -- the single shared endpoint every
// project's installed notify.mjs command POSTs to, disambiguated purely by
// the projectId baked into that project's own hook command (see
// hookInstaller.ts). No per-project ports.
export const notificationHookRouter = Router();

notificationHookRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, sessionId, cwd, message } = req.body ?? {};
    if (typeof projectId !== 'string' || projectId.length === 0) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    const project = await getProject(projectId);
    if (!project) {
      // Stale hook command left over after the project was unregistered --
      // not fatal, notify.mjs treats any non-throw response as success.
      res.status(404).json({ error: 'unknown project' });
      return;
    }

    recordNotification(projectId, {
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      cwd: typeof cwd === 'string' ? cwd : null,
      message: typeof message === 'string' ? message : '',
      receivedAt: new Date().toISOString(),
    });

    res.status(204).end();
  }),
);
