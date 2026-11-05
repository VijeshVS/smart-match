import { z } from 'zod';

export const walletQuerySchema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
});

export const unlockTier3Schema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
  talentId: z.string().uuid('talentId must be a UUID'),
});

/**
 * Runtime guard for the `review.submitted` event consumed from RabbitMQ.
 * Only the fields needed to credit the reviewer are required.
 */
export const reviewSubmittedPayloadSchema = z.object({
  reviewId: z.string().uuid('reviewId must be a UUID'),
  recruiterId: z.string().uuid('recruiterId must be a UUID'),
  talentId: z.string().uuid('talentId must be a UUID'),
  hasActionableFeedback: z.boolean(),
  feedbackText: z.string().optional(),
});

export type WalletQueryInput = z.infer<typeof walletQuerySchema>;
export type UnlockTier3Input = z.infer<typeof unlockTier3Schema>;
export type ReviewSubmittedPayloadInput = z.infer<typeof reviewSubmittedPayloadSchema>;
