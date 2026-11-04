import type { ISODateString, PaginatedResult, UUID } from './common.js';

export const NOTIFICATION_TYPES = [
  'REVIEW_RECEIVED',
  'COINS_AWARDED',
  'TIER3_UNLOCKED',
  'MATCH_FOUND',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED', 'READ'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  deliveryStatus: DeliveryStatus;
  createdAt: ISODateString;
}

export type NotificationListResponse = PaginatedResult<Notification>;

export interface MarkNotificationReadRequest {
  read: boolean;
}

export interface NotificationSentPayload {
  notificationId: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  channel: 'IN_APP' | 'EMAIL';
  timestamp: ISODateString;
}
