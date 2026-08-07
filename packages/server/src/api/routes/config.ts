import { Router } from 'express';
import { getProject } from '../../registry/registry.js';
import { readConfig, setReviewerModel, setGoalSummary, setProjectDocs } from '../../projects/configStore.js';
import { readGoal, writeGoal } from '../../projects/goal.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id -- mergeParams so req.params.id is visible.
export const configRouter = Router({ mergeParams: true });

function projectIdParam(req: { params: unknown }): string {
  return (req.params as { id: string }).id;
}

configRouter.get(
  '/config',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(await readConfig(project.path));
  }),
);

configRouter.put(
  '/config',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const { reviewerModel } = req.body ?? {};
    if (typeof reviewerModel !== 'string' || reviewerModel.trim().length === 0) {
      res.status(400).json({ error: 'reviewerModel is required' });
      return;
    }
    res.json(await setReviewerModel(project.path, reviewerModel.trim()));
  }),
);

configRouter.put(
  '/project-docs',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const { projectDocs } = req.body ?? {};
    if (!Array.isArray(projectDocs) || !projectDocs.every((f: unknown) => typeof f === 'string')) {
      res.status(400).json({ error: 'projectDocs must be an array of strings' });
      return;
    }
    res.json(await setProjectDocs(project.path, projectDocs));
  }),
);

configRouter.get(
  '/goal',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(await readGoal(project.path));
  }),
);

configRouter.put(
  '/goal',
  asyncHandler(async (req, res) => {
    const project = await getProject(projectIdParam(req));
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const { text } = req.body ?? {};
    if (typeof text !== 'string') {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const result = await writeGoal(project.path, text);
    const summary =
      text
        .split('\n')
        .map((line) => line.replace(/^#+\s*/, '').trim())
        .find((line) => line.length > 0)
        ?.slice(0, 140) ?? '';
    await setGoalSummary(project.path, summary);
    res.json(result);
  }),
);
