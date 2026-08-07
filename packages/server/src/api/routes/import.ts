import { Router } from 'express';
import type { ImportApplyRequest, ImportApplyMediaSelection } from '@gauntlet-wrapper/shared';
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
    const parseSelections = (value: unknown): ImportApplyMediaSelection[] => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((v): v is Record<string, unknown> => v !== null && typeof v === 'object')
        .filter((v) => typeof v.sourcePath === 'string')
        .map((v) => ({ sourcePath: v.sourcePath as string, note: typeof v.note === 'string' ? v.note : '' }));
    };

    const request: ImportApplyRequest = {
      photos: parseSelections(body.photos),
      videos: parseSelections(body.videos),
      importGoal: body.importGoal === true,
      importGeneration: body.importGeneration === true,
    };

    res.json(await applyImport(project.path, request));
  }),
);
