import { Router } from 'express';
import { access } from 'node:fs/promises';
import { addProject, listProjects, getProject, removeProject } from '../../registry/registry.js';
import { onboardProject } from '../../projects/onboarding.js';
import { readSettings } from '../../config/settings.js';
import { asyncHandler } from '../asyncHandler.js';

export const projectsRouter = Router();

projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listProjects());
  }),
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { path, displayName } = req.body ?? {};
    if (typeof path !== 'string' || path.trim().length === 0) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    try {
      await access(path);
    } catch {
      res.status(400).json({ error: `path does not exist or is not accessible: ${path}` });
      return;
    }

    const project = await addProject(path, displayName);
    const settings = await readSettings();
    const { freshlyOnboarded } = await onboardProject(
      project.id,
      project.path,
      project.displayName,
      settings.defaultReviewerModel,
    );
    res.status(201).json({ project, freshlyOnboarded });
  }),
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(project);
  }),
);

projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const removed = await removeProject(req.params.id);
    res.status(removed ? 204 : 404).end();
  }),
);
