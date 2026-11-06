import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .preprocess((value) => {
      if (value === undefined || value === '') return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      }
      return value;
    }, z.boolean())
    .default(false),
});

export const markReadSchema = z.object({
  read: z.boolean(),
});

export const notificationParamsSchema = z.object({
  id: z.string().min(1).max(120),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
