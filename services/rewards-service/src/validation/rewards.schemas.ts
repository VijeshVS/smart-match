import { z } from 'zod';
import { SWIPE_DECISIONS, type SwipeDecision } from '@talent-ai/shared-types';

export const walletQuerySchema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
});

export const unlockTier3Schema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
  talentId: z.string().uuid('talentId must be a UUID'),
});

/**
 * `queryId` is the client-generated idempotency key for one TalentLens search.
 * A retried request reuses the same key so the wallet is debited at most once.
 */
export const talentLensQuerySchema = z.object({
  queryId: z.string().uuid('queryId must be a UUID'),
});

const swipeDecisionSchema = z.enum([...SWIPE_DECISIONS] as [SwipeDecision, ...SwipeDecision[]]);

/**
 * Runtime guard for the `swipe.recorded` event consumed from RabbitMQ. Only
 * the fields needed to credit the recruiter are required.
 */
export const swipeRecordedPayloadSchema = z.object({
  swipeId: z.string().uuid('swipeId must be a UUID'),
  recruiterId: z.string().uuid('recruiterId must be a UUID'),
  talentId: z.string().uuid('talentId must be a UUID'),
  decision: swipeDecisionSchema,
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
export type TalentLensQueryInput = z.infer<typeof talentLensQuerySchema>;
export type ReviewSubmittedPayloadInput = z.infer<typeof reviewSubmittedPayloadSchema>;
export type SwipeRecordedPayloadInput = z.infer<typeof swipeRecordedPayloadSchema>;
