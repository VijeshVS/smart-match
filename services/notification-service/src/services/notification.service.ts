import { Types } from 'mongoose';
import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type {
  Notification,
  NotificationListResponse,
  NotificationType,
  PaginationMeta,
} from '@talent-ai/shared-types';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import {
  NotificationModel,
  toNotification,
  type NotificationDocument,
} from '../models/notification.model.js';
import type { NotificationListQuery } from '../validation/notification.schemas.js';
import { sendNotificationEmail } from './email.js';
import { broadcastNotification } from './websocket.js';

const { domain } = getServiceMetrics(config.serviceName);

export interface CreateNotificationInput {
  /** Domain event id; makes at-least-once delivery idempotent. */
  eventId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Optional contact address for the email channel. */
  email?: string;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function publishNotificationSent(notification: Notification): void {
  void eventBus
    .publish('notification.sent', notification.userId, {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      channel: 'IN_APP',
      timestamp: new Date().toISOString(),
    })
    .catch((error: unknown) => {
      logger.warn(
        { err: error, notificationId: notification.id },
        'failed to publish notification.sent',
      );
    });
}

/**
 * Persists a notification, pushes it to any live sockets and best-effort sends
 * the branded email. Returns `null` when the event was already processed.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  let doc: NotificationDocument;

  try {
    doc = await NotificationModel.create({
      eventId: input.eventId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.data === undefined ? {} : { data: input.data }),
      read: false,
      deliveryStatus: 'PENDING',
      emailStatus: 'SKIPPED',
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logger.debug(
        { eventId: input.eventId, userId: input.userId },
        'notification already exists for event; skipping duplicate delivery',
      );
      return null;
    }
    throw error;
  }

  const notification = toNotification(doc);

  // In-app delivery is complete once the document is persisted.
  doc.deliveryStatus = 'SENT';
  await doc.save();
  domain.notificationsCreated.inc({
    type: notification.type,
    delivery_status: 'SENT',
  });

  await broadcastNotification(notification.userId, notification);
  publishNotificationSent(notification);

  if (input.email) {
    const emailStatus = await sendNotificationEmail({
      to: input.email,
      type: input.type,
      title: input.title,
      body: input.body,
    });

    doc.emailStatus = emailStatus;
    await doc.save();
  }

  return toNotification(doc);
}

function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export async function listNotifications(
  userId: string,
  query: NotificationListQuery,
): Promise<NotificationListResponse> {
  const filter = {
    userId,
    ...(query.unreadOnly ? { read: false } : {}),
  };

  const [total, docs] = await Promise.all([
    NotificationModel.countDocuments(filter),
    NotificationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ]);

  return {
    data: docs.map((doc) => toNotification(doc)),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ userId, read: false });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  read: boolean,
): Promise<Notification> {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found');
  }

  const doc = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, userId },
    { read },
    { new: true },
  );

  if (!doc) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found');
  }

  return toNotification(doc);
}
