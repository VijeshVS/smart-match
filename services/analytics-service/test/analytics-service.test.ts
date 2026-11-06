import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsPrincipal } from '../src/middleware/auth.js';

const prismaMock = vi.hoisted(() => ({
  candidateMetric: { findUnique: vi.fn() },
  recruiterMetric: { findUnique: vi.fn() },
  recruiterSkillDemand: { findMany: vi.fn() },
  skillMetric: { findMany: vi.fn() },
  funnelAggregate: { findMany: vi.fn() },
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { getCandidateAnalytics, getRecruiterDashboard } =
  await import('../src/services/analytics.service.js');

const candidatePrincipal: AnalyticsPrincipal = {
  userId: 'user-1',
  email: 'candidate@example.com',
  role: 'CANDIDATE',
  permissions: [],
};

const recruiterPrincipal: AnalyticsPrincipal = {
  userId: 'recruiter-user-1',
  email: 'recruiter@example.com',
  role: 'RECRUITER',
  permissions: [],
};

const adminPrincipal: AnalyticsPrincipal = {
  ...recruiterPrincipal,
  userId: 'admin-user-1',
  role: 'ADMIN',
};

const metric = {
  talentId: 'talent-1',
  userId: 'user-1',
  rightSwipes: 3,
  leftSwipes: 1,
  totalReviews: 2,
  profileCreatedAt: null,
  firstApprovedAt: null,
  updatedAt: new Date('2026-11-06T10:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCandidateAnalytics', () => {
  it('throws 404 when the candidate has no projections yet', async () => {
    prismaMock.candidateMetric.findUnique.mockResolvedValue(null);

    await expect(getCandidateAnalytics('talent-1', recruiterPrincipal)).rejects.toMatchObject({
      status: 404,
      code: 'CANDIDATE_ANALYTICS_NOT_FOUND',
    });
  });

  it('forbids a candidate reading another candidate', async () => {
    prismaMock.candidateMetric.findUnique.mockResolvedValue(metric);

    await expect(
      getCandidateAnalytics('talent-1', { ...candidatePrincipal, userId: 'other-user' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns the acceptance ratio and updates for the owning candidate', async () => {
    prismaMock.candidateMetric.findUnique.mockResolvedValue(metric);

    const analytics = await getCandidateAnalytics('talent-1', candidatePrincipal);

    expect(analytics).toEqual({
      talentId: 'talent-1',
      rightSwipes: 3,
      leftSwipes: 1,
      acceptanceRatio: 0.75,
      totalReviews: 2,
      updatedAt: '2026-11-06T10:00:00.000Z',
    });
  });

  it('lets recruiters read any candidate', async () => {
    prismaMock.candidateMetric.findUnique.mockResolvedValue(metric);

    await expect(getCandidateAnalytics('talent-1', recruiterPrincipal)).resolves.toMatchObject({
      acceptanceRatio: 0.75,
    });
  });
});

describe('getRecruiterDashboard', () => {
  it('rejects candidates', async () => {
    await expect(getRecruiterDashboard(undefined, candidatePrincipal)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('forbids a recruiter reading another recruiter', async () => {
    await expect(getRecruiterDashboard('someone-else', recruiterPrincipal)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('returns a zero-filled dashboard before any events are projected', async () => {
    prismaMock.recruiterMetric.findUnique.mockResolvedValue(null);
    prismaMock.recruiterSkillDemand.findMany.mockResolvedValue([]);

    const dashboard = await getRecruiterDashboard(undefined, recruiterPrincipal);

    expect(dashboard).toMatchObject({
      recruiterId: 'recruiter-user-1',
      openJobs: 0,
      candidatesReviewed: 0,
      approvals: 0,
      rejections: 0,
      creditsEarned: 0,
      topSkills: [],
    });
    expect(dashboard.averageTimeToMatchHours).toBeUndefined();
  });

  it('maps credited metrics, average time to match and top skills', async () => {
    prismaMock.recruiterMetric.findUnique.mockResolvedValue({
      recruiterId: 'recruiter-user-1',
      organizationId: 'org-1',
      openJobs: 2,
      reviewsSubmitted: 4,
      actionableFeedbackCount: 3,
      creditsEarned: 15,
      approvals: 5,
      rejections: 1,
      matchCount: 2,
      matchDelayMsSum: 7_200_000,
      updatedAt: new Date('2026-11-06T10:00:00.000Z'),
    });
    prismaMock.recruiterSkillDemand.findMany.mockResolvedValue([
      { skill: 'typescript' },
      { skill: 'react' },
    ]);
    prismaMock.skillMetric.findMany.mockResolvedValue([
      {
        skill: 'typescript',
        demandCount: 4,
        supplyCount: 10,
        experienceSum: 30,
        experienceCount: 10,
      },
      {
        skill: 'react',
        demandCount: 3,
        supplyCount: 8,
        experienceSum: 16,
        experienceCount: 8,
      },
    ]);

    const dashboard = await getRecruiterDashboard(undefined, recruiterPrincipal);

    expect(dashboard).toMatchObject({
      recruiterId: 'recruiter-user-1',
      organizationId: 'org-1',
      openJobs: 2,
      candidatesReviewed: 4,
      approvals: 5,
      rejections: 1,
      creditsEarned: 15,
      averageTimeToMatchHours: 1,
      topSkills: [
        { skill: 'typescript', demandCount: 4, supplyCount: 10, averageExperienceYears: 3 },
        { skill: 'react', demandCount: 3, supplyCount: 8, averageExperienceYears: 2 },
      ],
    });
  });

  it('lets admins read another recruiter dashboard', async () => {
    prismaMock.recruiterMetric.findUnique.mockResolvedValue(null);
    prismaMock.recruiterSkillDemand.findMany.mockResolvedValue([]);

    const dashboard = await getRecruiterDashboard('recruiter-user-9', adminPrincipal);
    expect(dashboard.recruiterId).toBe('recruiter-user-9');
  });
});
