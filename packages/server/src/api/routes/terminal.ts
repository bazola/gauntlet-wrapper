import { Router } from 'express';
import { getProject } from '../../registry/registry.js';
import { getOrCreateSession, getSession } from '../../pty/ptyRegistry.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/terminal -- mergeParams for req.params.id.
export const terminalRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

terminalRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ started: getSession(project.id)?.isAlive() ?? false });
  }),
);

// The one explicit, human-triggered entry point that's allowed to spawn a
// PTY / start delivering the kickoff-or-resume prompt -- see
// pty/ptyRegistry.ts's getOrCreateSession for why nothing else does.
terminalRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    getOrCreateSession(project.id, project.path);
    res.status(202).json({ started: true });
  }),
);
