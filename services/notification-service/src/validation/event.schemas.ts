import { z } from 'zod';

const id = z.string().min(1).max(120);

export const talentProfileEventSchema = z.object({
  talentId: id,
  userId: id,
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254).optional(),
  field: z.string().min(1).max(120),
  skills: z.array(z.string().max(80)).max(40).optional(),
  experienceYears: z.number().min(0).max(60),
  level: z.string().min(1).max(40),
});

export const recruiterRegisteredSchema = z.object({
  recruiterId: id,
  userId: id,
  organizationId: id,
  email: z.string().email().max(254),
  organizationName: z.string().min(1).max(200),
});

export const reviewSubmittedSchema = z.object({
  reviewId: id,
  swipeId: id.optional(),
  recruiterId: id,
  talentId: id,
  decision: z.enum(['APPROVE', 'REJECT', 'DEFER']),
  feedbackText: z.string().max(2_000).optional(),
  hasActionableFeedback: z.boolean(),
  timestamp: z.string().min(1),
});

export const coinsAwardedSchema = z.object({
  walletId: id,
  recruiterId: id,
  amount: z.number().int(),
  type: z.string().min(1).max(60),
  referenceId: id.optional(),
  balanceAfter: z.number().int(),
  timestamp: z.string().min(1),
});

export const tier3UnlockedSchema = z.object({
  grantId: id,
  recruiterId: id,
  talentId: id,
  chargedCredits: z.number().int(),
  expiresAt: z.string().optional(),
  timestamp: z.string().min(1),
});

export const aiEvaluationCompletedSchema = z.object({
  evaluationId: id,
  recruiterId: id,
  talentId: id,
  jobId: id.optional(),
  score: z.number().min(0).max(1),
  summary: z.string().min(1).max(2_000),
  timestamp: z.string().min(1),
});
