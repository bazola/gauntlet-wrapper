import { Router } from 'express';
import { getProject } from '../../registry/registry.js';
import { readRequirementsFile } from '../../progress/progressReader.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/requirements -- mergeParams for req.params.id.
// Read-only: the standing requirement set is Claude's to write (see the
// KICKOFF template's S4/S7), the wrapper only ever displays it -- e.g. so the
// References tab can show a gameplay reference what it's actually being
// tested against, cross-referenced by derivedRequirementIds.
export const requirementsRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

requirementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const file = await readRequirementsFile(project.path);
    res.json(file ?? { schemaVersion: 1, requirements: [] });
  }),
);
