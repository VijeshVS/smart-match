import { z } from 'zod';
import { SWIPE_DECISIONS, type SwipeDecision } from '@talent-ai/shared-types';

export const swipeDecisionSchema = z.enum([...SWIPE_DECISIONS] as [
  SwipeDecision,
  ...SwipeDecision[],
]);

function optionalText(max: number, label: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max, `${label} is too long`).optional(),
  );
}

export const createSwipeSchema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
  talentId: z.string().uuid('talentId must be a UUID'),
  decision: swipeDecisionSchema,
});

export const createRecruiterInterestSchema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
  talentId: z.string().uuid('talentId must be a UUID'),
});

export const createReviewSchema = z
  .object({
    recruiterId: z.string().uuid('recruiterId must be a UUID').optional(),
    talentId: z.string().uuid('talentId must be a UUID'),
    swipeId: z.string().uuid('swipeId must be a UUID').optional(),
    decision: swipeDecisionSchema,
    rating: z.coerce.number().int().min(1).max(5).optional(),
    feedbackText: optionalText(2_000, 'Feedback text'),
    actionableAdvice: optionalText(2_000, 'Actionable advice'),
  })
  .refine(
    (value) =>
      value.rating !== undefined ||
      value.feedbackText !== undefined ||
      value.actionableAdvice !== undefined,
    { message: 'Provide a rating, feedback text or actionable advice' },
  );

/** Subset of `talent.profile.updated` needed to decide whether to reset. */
export const talentProfileUpdatedSchema = z.object({
  talentId: z.string().min(1).max(120),
  changedFields: z.array(z.string().min(1).max(120)).default([]),
  qualificationsChanged: z.boolean().optional(),
});

export const talentIdParamSchema = z.object({
  talentId: z.string().uuid('talentId must be a UUID'),
});

export const recruiterIdParamSchema = z.object({
  recruiterId: z.string().uuid('recruiterId must be a UUID'),
});

export type CreateSwipeInput = z.infer<typeof createSwipeSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateRecruiterInterestInput = z.infer<typeof createRecruiterInterestSchema>;
