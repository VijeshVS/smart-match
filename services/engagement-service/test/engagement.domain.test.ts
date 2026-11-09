import { describe, expect, it } from 'vitest';
import {
  assertRecruiterAccess,
  buildRecruiterHistory,
  buildRecruiterQueueExclusions,
  buildTalentSummary,
  hasActionableFeedback,
  normalizeOptionalText,
  permissionsForRole,
  resolveRecruiterId,
  toReview,
  toSwipe,
} from '../src/domain/engagement.js';
import type { EngagementPrincipal } from '../src/middleware/auth.js';

const recruiter: EngagementPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'riley@acme.com',
  role: 'RECRUITER',
  permissions: [],
};

const otherRecruiter: EngagementPrincipal = {
  ...recruiter,
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'sam@acme.com',
};

const admin: EngagementPrincipal = {
  ...recruiter,
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'admin@talent.ai',
  role: 'ADMIN',
};

describe('engagement domain', () => {
  it('grants swipe and review permissions by role', () => {
    expect(permissionsForRole('RECRUITER')).toContain('engagement:swipe');
    expect(permissionsForRole('RECRUITER')).toContain('engagement:review');
    expect(permissionsForRole('CANDIDATE')).toEqual(['talent:read', 'talent:write']);
    expect(permissionsForRole('ADMIN')).toContain('analytics:read');
  });

  it('defaults the recruiter id to the caller and blocks impersonation', () => {
    expect(resolveRecruiterId(undefined, recruiter)).toBe(recruiter.userId);
    expect(resolveRecruiterId(recruiter.userId, recruiter)).toBe(recruiter.userId);
    expect(resolveRecruiterId(otherRecruiter.userId, admin)).toBe(otherRecruiter.userId);

    expect(() => resolveRecruiterId(otherRecruiter.userId, recruiter)).toThrow(
      /own recruiter identity/,
    );
  });

  it('guards recruiter history to the owner or an admin', () => {
    expect(() => assertRecruiterAccess(recruiter, recruiter.userId)).not.toThrow();
    expect(() => assertRecruiterAccess(admin, otherRecruiter.userId)).not.toThrow();
    expect(() => assertRecruiterAccess(otherRecruiter, recruiter.userId)).toThrow(
      /access to this recruiter history/,
    );
  });

  it('normalizes optional feedback and derives actionable feedback', () => {
    expect(normalizeOptionalText('  Better examples  ')).toBe('Better examples');
    expect(normalizeOptionalText('   ')).toBeUndefined();
    expect(normalizeOptionalText(undefined)).toBeUndefined();

    expect(hasActionableFeedback('Add metrics to your answers')).toBe(true);
    expect(hasActionableFeedback('  ')).toBe(false);
    expect(hasActionableFeedback(undefined)).toBe(false);
  });

  it('aggregates swipe counts and review totals for a candidate', () => {
    const now = new Date('2026-11-05T00:00:00.000Z');
    const swipes = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        recruiterId: recruiter.userId,
        talentId: 'talent-1',
        decision: 'APPROVE' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        recruiterId: otherRecruiter.userId,
        talentId: 'talent-1',
        decision: 'APPROVE' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        recruiterId: admin.userId,
        talentId: 'talent-1',
        decision: 'REJECT' as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        recruiterId: admin.userId,
        talentId: 'talent-1',
        decision: 'DEFER' as const,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const reviews = [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        swipeId: swipes[0]!.id,
        recruiterId: recruiter.userId,
        talentId: 'talent-1',
        decision: 'APPROVE' as const,
        rating: 5,
        feedbackText: 'Strong systems thinking.',
        actionableAdvice: null,
        hasActionableFeedback: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const summary = buildTalentSummary('talent-1', swipes, reviews);

    expect(summary).toMatchObject({
      talentId: 'talent-1',
      rightSwipes: 2,
      leftSwipes: 1,
      deferredSwipes: 1,
      totalReviews: 1,
    });
    expect(summary.reviews[0]).toMatchObject({
      id: reviews[0]!.id,
      rating: 5,
      hasActionableFeedback: false,
    });
    expect(summary.reviews[0]?.actionableAdvice).toBeUndefined();
  });

  it('maps recruiter history rows to the shared contract', () => {
    const now = new Date('2026-11-05T00:00:00.000Z');
    const swipe = toSwipe({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recruiterId: recruiter.userId,
      talentId: '99999999-9999-4999-8999-999999999999',
      decision: 'REJECT',
      createdAt: now,
      updatedAt: now,
    });
    const review = toReview({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      swipeId: swipe.id,
      recruiterId: recruiter.userId,
      talentId: swipe.talentId,
      decision: 'REJECT',
      rating: null,
      feedbackText: null,
      actionableAdvice: 'Practice system design fundamentals.',
      hasActionableFeedback: true,
      createdAt: now,
      updatedAt: now,
    });

    const history = buildRecruiterHistory(recruiter.userId, [swipeRow(swipe)], [reviewRow(review)]);

    expect(history.recruiterId).toBe(recruiter.userId);
    expect(history.swipes).toHaveLength(1);
    expect(history.reviews).toHaveLength(1);
    expect(history.reviews[0]?.actionableAdvice).toBe('Practice system design fundamentals.');
    expect(history.reviews[0]?.rating).toBeUndefined();
    expect(history.reviews[0]?.feedbackText).toBeUndefined();
  });

  it('excludes reviewed candidates and terminal swipes but keeps pure deferrals', () => {
    const exclusions = buildRecruiterQueueExclusions(
      recruiter.userId,
      [
        { talentId: 'talent-approved', decision: 'APPROVE' as const },
        { talentId: 'talent-rejected', decision: 'REJECT' as const },
        { talentId: 'talent-deferred', decision: 'DEFER' as const },
      ],
      [{ talentId: 'talent-reviewed' }, { talentId: 'talent-deferred' }],
    );

    expect(exclusions.recruiterId).toBe(recruiter.userId);
    expect(exclusions.talentIds).toEqual([
      'talent-approved',
      'talent-deferred',
      'talent-rejected',
      'talent-reviewed',
    ]);
  });

  it('returns no exclusions for a fresh recruiter', () => {
    expect(buildRecruiterQueueExclusions(recruiter.userId, [], [])).toEqual({
      recruiterId: recruiter.userId,
      talentIds: [],
    });
  });
});

// Rebuild Prisma-shaped rows from mapped contracts so the test does not depend
// on the generated client at type level.
function swipeRow(swipe: ReturnType<typeof toSwipe>) {
  return {
    id: swipe.id,
    recruiterId: swipe.recruiterId,
    talentId: swipe.talentId,
    decision: swipe.decision,
    createdAt: new Date(swipe.createdAt),
    updatedAt: new Date(swipe.createdAt),
  };
}

function reviewRow(review: ReturnType<typeof toReview>) {
  return {
    id: review.id,
    swipeId: review.swipeId ?? null,
    recruiterId: review.recruiterId,
    talentId: review.talentId,
    decision: review.decision,
    rating: review.rating ?? null,
    feedbackText: review.feedbackText ?? null,
    actionableAdvice: review.actionableAdvice ?? null,
    hasActionableFeedback: review.hasActionableFeedback,
    createdAt: new Date(review.createdAt),
    updatedAt: new Date(review.createdAt),
  };
}
