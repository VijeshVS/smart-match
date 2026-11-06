import type {
  CandidateAnalytics,
  FunnelAggregate,
  RecruiterDashboard,
  RecruiterLeaderboardEntry,
  SkillAnalytics,
} from '@talent-ai/shared-types';
import {
  acceptanceRatio,
  averageExperienceYears,
  averageTimeToMatchHours,
  rankLeaderboard,
  utcDay,
} from '../domain/analytics.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { AnalyticsPrincipal } from '../middleware/auth.js';

function toSkillAnalytics(row: {
  skill: string;
  demandCount: number;
  supplyCount: number;
  experienceSum: number;
  experienceCount: number;
}): SkillAnalytics {
  return {
    skill: row.skill,
    demandCount: row.demandCount,
    supplyCount: row.supplyCount,
    averageExperienceYears: averageExperienceYears(row.experienceSum, row.experienceCount),
  };
}

/**
 * Returns a candidate's swipe funnel. Candidates may only read their own
 * analytics; recruiters and admins may read any candidate.
 */
export async function getCandidateAnalytics(
  talentId: string,
  principal: AnalyticsPrincipal,
): Promise<CandidateAnalytics> {
  const row = await prisma.candidateMetric.findUnique({ where: { talentId } });

  if (!row) {
    throw new AppError(
      404,
      'CANDIDATE_ANALYTICS_NOT_FOUND',
      'No analytics are available for this candidate yet',
    );
  }

  if (principal.role === 'CANDIDATE' && row.userId !== principal.userId) {
    throw new AppError(403, 'FORBIDDEN', 'You may only read analytics for your own profile');
  }

  return {
    talentId: row.talentId,
    rightSwipes: row.rightSwipes,
    leftSwipes: row.leftSwipes,
    acceptanceRatio: acceptanceRatio(row.rightSwipes, row.leftSwipes),
    totalReviews: row.totalReviews,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function recruiterSkills(recruiterId: string, limit: number): Promise<SkillAnalytics[]> {
  const demands = await prisma.recruiterSkillDemand.findMany({
    where: { recruiterId },
    orderBy: [{ jobCount: 'desc' }, { skill: 'asc' }],
    take: limit,
  });

  if (demands.length === 0) return [];

  const metrics = await prisma.skillMetric.findMany({
    where: { skill: { in: demands.map((demand) => demand.skill) } },
  });
  const bySkill = new Map(metrics.map((metric) => [metric.skill, metric]));

  return demands.flatMap((demand) => {
    const metric = bySkill.get(demand.skill);
    if (!metric) return [];
    return [toSkillAnalytics(metric)];
  });
}

/**
 * Returns a recruiter's engagement dashboard. `recruiterId` is the canonical
 * user id used by engagement and reward events; it defaults to the caller.
 */
export async function getRecruiterDashboard(
  requestedRecruiterId: string | undefined,
  principal: AnalyticsPrincipal,
  topSkillLimit = 5,
): Promise<RecruiterDashboard> {
  if (principal.role === 'CANDIDATE') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only recruiters and administrators can read recruiter analytics',
    );
  }

  const recruiterId = requestedRecruiterId ?? principal.userId;

  if (principal.role !== 'ADMIN' && recruiterId !== principal.userId) {
    throw new AppError(403, 'FORBIDDEN', 'You may only read your own dashboard');
  }

  const [metric, topSkills] = await Promise.all([
    prisma.recruiterMetric.findUnique({ where: { recruiterId } }),
    recruiterSkills(recruiterId, topSkillLimit),
  ]);

  // A recruiter who has not generated any events yet still gets a valid,
  // zero-filled dashboard instead of a 404.
  if (!metric) {
    return {
      recruiterId,
      openJobs: 0,
      candidatesReviewed: 0,
      approvals: 0,
      rejections: 0,
      creditsEarned: 0,
      topSkills,
      updatedAt: new Date().toISOString(),
    };
  }

  const averageTimeToMatch = averageTimeToMatchHours(metric.matchCount, metric.matchDelayMsSum);

  return {
    recruiterId,
    ...(metric.organizationId === null ? {} : { organizationId: metric.organizationId }),
    openJobs: metric.openJobs,
    candidatesReviewed: metric.reviewsSubmitted,
    approvals: metric.approvals,
    rejections: metric.rejections,
    creditsEarned: metric.creditsEarned,
    ...(averageTimeToMatch === undefined ? {} : { averageTimeToMatchHours: averageTimeToMatch }),
    topSkills,
    updatedAt: metric.updatedAt.toISOString(),
  };
}

/** Top skills by job-posting demand, with candidate supply and experience. */
export async function getTopSkills(limit: number): Promise<SkillAnalytics[]> {
  const rows = await prisma.skillMetric.findMany({
    orderBy: [{ demandCount: 'desc' }, { supplyCount: 'desc' }, { skill: 'asc' }],
    take: limit,
  });

  return rows.map((row) => toSkillAnalytics(row));
}

/** Recruiter engagement leaderboard, ranked by actionable feedback. */
export async function getRecruiterLeaderboard(limit: number): Promise<RecruiterLeaderboardEntry[]> {
  const rows = await prisma.recruiterMetric.findMany({
    orderBy: [
      { actionableFeedbackCount: 'desc' },
      { creditsEarned: 'desc' },
      { reviewsSubmitted: 'desc' },
      { recruiterId: 'asc' },
    ],
    take: limit,
  });

  return rankLeaderboard(rows);
}

/** Aggregated funnel counters over the trailing `days` UTC days. */
export async function getFunnelSummary(days: number): Promise<FunnelAggregate> {
  const periodEnd = new Date();
  const periodStart = utcDay(new Date(periodEnd.getTime() - (days - 1) * 86_400_000));

  const rows = await prisma.funnelAggregate.findMany({
    where: { day: { gte: periodStart } },
  });

  const totals = rows.reduce(
    (accumulator, row) => ({
      profilesCreated: accumulator.profilesCreated + row.profilesCreated,
      swipesRecorded: accumulator.swipesRecorded + row.swipesRecorded,
      reviewsSubmitted: accumulator.reviewsSubmitted + row.reviewsSubmitted,
      tier3Unlocks: accumulator.tier3Unlocks + row.tier3Unlocks,
      approvals: accumulator.approvals + row.approvals,
    }),
    {
      profilesCreated: 0,
      swipesRecorded: 0,
      reviewsSubmitted: 0,
      tier3Unlocks: 0,
      approvals: 0,
    },
  );

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    profilesCreated: totals.profilesCreated,
    swipesRecorded: totals.swipesRecorded,
    reviewsSubmitted: totals.reviewsSubmitted,
    tier3Unlocks: totals.tier3Unlocks,
    approvalRate: acceptanceRatio(totals.approvals, totals.swipesRecorded - totals.approvals),
  };
}
