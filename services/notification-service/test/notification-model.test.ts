import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { NotificationDocument } from '../src/models/notification.model.js';
import { toNotification } from '../src/models/notification.model.js';

describe('toNotification', () => {
  it('maps a document to the shared API contract', () => {
    const id = new Types.ObjectId();
    const createdAt = new Date('2026-11-06T10:00:00.000Z');

    const doc = {
      _id: id,
      userId: 'user-1',
      type: 'COINS_AWARDED',
      title: 'You earned TalentCredits',
      body: 'You earned 5 TalentCredits for your candidate review!',
      data: { amount: 5 },
      read: false,
      deliveryStatus: 'SENT',
      createdAt,
      updatedAt: createdAt,
    } as unknown as NotificationDocument;

    const notification = toNotification(doc);

    expect(notification).toEqual({
      id: id.toString(),
      userId: 'user-1',
      type: 'COINS_AWARDED',
      title: 'You earned TalentCredits',
      body: 'You earned 5 TalentCredits for your candidate review!',
      data: { amount: 5 },
      read: false,
      deliveryStatus: 'SENT',
      createdAt: createdAt.toISOString(),
    });
  });

  it('omits absent optional data', () => {
    const doc = {
      _id: new Types.ObjectId(),
      userId: 'user-2',
      type: 'SYSTEM',
      title: 'Heads up',
      body: 'A platform update is available.',
      read: true,
      deliveryStatus: 'READ',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as NotificationDocument;

    expect(toNotification(doc)).not.toHaveProperty('data');
  });
});
