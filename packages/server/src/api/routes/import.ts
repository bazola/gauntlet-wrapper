import { Router } from 'express';
import type { ImportApplyRequest } from '@gauntlet-wrapper/shared';
import { getProject } from '../../registry/registry.js';
import { scanForImportCandidates } from '../../projects/importScanner.js';
import { applyImport } from '../../projects/importApply.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/import -- mergeParams for req.params.id.
export const importRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

importRouter.get(
  '/scan',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(await scanForImportCandidates(project.path));
  }),
);

importRouter.post(
  '/apply',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const body = req.body ?? {};
    const request: ImportApplyRequest = {
      photoSourcePaths: Array.isArray(body.photoSourcePaths) ? body.photoSourcePaths.filter((p: unknown) => typeof p === 'string') : [],
      videoSourcePaths: Array.isArray(body.videoSourcePaths) ? body.videoSourcePaths.filter((p: unknown) => typeof p === 'string') : [],
      importGoal: body.importGoal === true,
      importGeneration: body.importGeneration === true,
    };

    res.json(await applyImport(project.path, request));
  }),
);
