import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from '../services/notification.service.js';
import {
  markReadSchema,
  notificationListQuerySchema,
  notificationParamsSchema,
} from '../validation/notification.schemas.js';

export const notificationsRouter: Router = Router();

// Every notification route is scoped to the authenticated identity.
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = notificationListQuerySchema.parse(req.query);
    const result = await listNotifications(req.auth!.userId, query);
    res.status(200).json(result);
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await getUnreadCount(req.auth!.userId);
    res.status(200).json({ data: { count } });
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const input = markReadSchema.parse(req.body);
    const { id } = notificationParamsSchema.parse(req.params);
    const notification = await markNotificationRead(req.auth!.userId, id, input.read);
    res.status(200).json({ data: notification });
  }),
);
