import { Router } from 'express';
import { readSettings, writeSettings } from '../../config/settings.js';
import { asyncHandler } from '../asyncHandler.js';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await readSettings());
  }),
);

settingsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { defaultReviewerModel } = req.body ?? {};
    if (typeof defaultReviewerModel !== 'string' || defaultReviewerModel.trim().length === 0) {
      res.status(400).json({ error: 'defaultReviewerModel is required' });
      return;
    }
    res.json(await writeSettings({ defaultReviewerModel: defaultReviewerModel.trim() }));
  }),
);
