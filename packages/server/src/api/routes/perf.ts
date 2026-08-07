import { Router } from 'express';
import { getProject } from '../../registry/registry.js';
import { scaffoldPerfHarness } from '../../perfTemplate/scaffold.js';
import { markPerfHarnessScaffolded } from '../../projects/configStore.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/perf -- mergeParams for req.params.id.
export const perfRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

perfRouter.post(
  '/scaffold',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const result = await scaffoldPerfHarness(project.path);
    await markPerfHarnessScaffolded(project.path);
    res.json(result);
  }),
);
