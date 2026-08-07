import { Router } from 'express';
import { clearNotification } from '../../hooks/notificationState.js';
import { asyncHandler } from '../asyncHandler.js';

// Mounted at /api/projects/:id/notifications -- mergeParams for req.params.id.
export const notificationsAckRouter = Router({ mergeParams: true });

notificationsAckRouter.post(
  '/ack',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    clearNotification(projectId);
    res.status(204).end();
  }),
);
