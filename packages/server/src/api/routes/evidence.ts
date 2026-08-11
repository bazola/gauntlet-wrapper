import { Router } from 'express';
import { resolve, sep } from 'node:path';
import { getProject } from '../../registry/registry.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/evidence -- mergeParams for req.params.id.
// Serves an arbitrary evidence file cited in a generation record's
// `lanes[].evidence[]` (captures/, telemetry-out/, .scratch/, wherever the
// project's own harness writes -- these paths are relative to the project
// root, not under .gauntlet/, since evidence is real build output the
// wrapper has no opinion about). `path` is untrusted (it's a string a
// generation record happened to contain), so the resolved path is verified
// to stay inside the project root before anything is served, same guard
// pattern as references/uploadRoutes.ts's file endpoint.
export const evidenceRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

evidenceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const requested = req.query.path;
    if (typeof requested !== 'string' || requested.length === 0) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const baseDir = resolve(project.path);
    const target = resolve(baseDir, requested);
    if (target !== baseDir && !target.startsWith(baseDir + sep)) {
      res.status(400).json({ error: 'invalid path' });
      return;
    }

    res.sendFile(target, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'file not found' });
    });
  }),
);
