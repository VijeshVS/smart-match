import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  DELIVERY_STATUSES,
  NOTIFICATION_TYPES,
  type DeliveryStatus,
  type Notification,
  type NotificationType,
} from '@talent-ai/shared-types';

export type EmailStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export interface NotificationRecord {
  /** The domain event that produced this notification, used for idempotency. */
  eventId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  deliveryStatus: DeliveryStatus;
  emailStatus: EmailStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationRecord> & {
  _id: Types.ObjectId;
};

const notificationSchema = new Schema<NotificationRecord>(
  {
    eventId: { type: String, required: true, unique: true, maxlength: 120 },
    userId: { type: String, required: true, index: true, maxlength: 120 },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2_000 },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: 'PENDING',
      required: true,
    },
    emailStatus: {
      type: String,
      enum: ['SENT', 'SKIPPED', 'FAILED'],
      default: 'SKIPPED',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const NotificationModel = model<NotificationRecord>('Notification', notificationSchema);

/** Maps a persisted document to the shared API contract. */
export function toNotification(doc: NotificationDocument): Notification {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    ...(doc.data === undefined ? {} : { data: doc.data }),
    read: doc.read,
    deliveryStatus: doc.deliveryStatus,
    createdAt: doc.createdAt.toISOString(),
  };
}
