import { describe, expect, it } from 'vitest';
import {
  markReadSchema,
  notificationListQuerySchema,
} from '../src/validation/notification.schemas.js';

describe('notification query schemas', () => {
  it('applies pagination defaults', () => {
    const parsed = notificationListQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, limit: 20, unreadOnly: false });
  });

  it('coerces query strings and caps the page size', () => {
    const parsed = notificationListQuerySchema.parse({
      page: '2',
      limit: '50',
      unreadOnly: 'true',
    });
    expect(parsed).toEqual({ page: 2, limit: 50, unreadOnly: true });
    expect(notificationListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(notificationListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('mark read schema', () => {
  it('requires a boolean read flag', () => {
    expect(markReadSchema.parse({ read: true })).toEqual({ read: true });
    expect(markReadSchema.safeParse({ read: 'yes' }).success).toBe(false);
    expect(markReadSchema.safeParse({}).success).toBe(false);
  });
});
