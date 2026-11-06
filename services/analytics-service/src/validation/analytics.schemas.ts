import { z } from 'zod';

const id = z.string().min(1).max(120);

export const talentProfileEventSchema = z.object({
  talentId: id,
  userId: id,
  name: z.string().trim().min(1).max(120),
  field: z.string().min(1).max(120),
  skills: z.array(z.string().max(80)).max(40).default([]),
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

export const recruiterJobPostedSchema = z.object({
  jobId: id,
  recruiterId: id,
  organizationId: id,
  title: z.string().min(1).max(200),
  requiredSkills: z.array(z.string().max(80)).max(50).default([]),
  employmentType: z.string().min(1).max(60),
});

export const swipeRecordedSchema = z.object({
  swipeId: id,
  recruiterId: id,
  talentId: id,
  decision: z.enum(['APPROVE', 'REJECT']),
  timestamp: z.string().min(1),
});

export const reviewSubmittedSchema = z.object({
  reviewId: id,
  swipeId: id.optional(),
  recruiterId: id,
  talentId: id,
  decision: z.enum(['APPROVE', 'REJECT']),
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

export const candidateParamsSchema = z.object({
  id: id,
});

export const recruiterDashboardQuerySchema = z.object({
  recruiterId: z.string().min(1).max(120).optional(),
});

export const topSkillsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const funnelQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type RecruiterDashboardQuery = z.infer<typeof recruiterDashboardQuerySchema>;
export type TopSkillsQuery = z.infer<typeof topSkillsQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type FunnelQuery = z.infer<typeof funnelQuerySchema>;
