import {
  PERMISSIONS,
  type CandidateReview,
  type Permission,
  type RecruiterEngagementHistory,
  type RecruiterQueueExclusions,
  type RecruiterTalentInterest,
  type SwipeDecision,
  type SwipeInteraction,
  type TalentEngagementSummary,
  type UserRole,
} from '@talent-ai/shared-types';
import type {
  RecruiterInterest as RecruiterInterestRow,
  Review as ReviewRow,
  Swipe as SwipeRow,
} from '../generated/prisma/client.js';
import type { EngagementPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

/**
 * Authoritative role → permission grants. Mirrors the auth-service table so a
 * directly verified bearer token carries the same capabilities as one that
 * passed through the gateway.
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  CANDIDATE: ['talent:read', 'talent:write'],
  RECRUITER: [
    'talent:read',
    'talent:unlock',
    'recruiter:read',
    'recruiter:write',
    'engagement:swipe',
    'engagement:review',
    'rewards:read',
    'rewards:spend',
    'analytics:read',
  ],
  ADMIN: [...PERMISSIONS],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Resolves the recruiter a swipe or review belongs to. Recruiters may only act
 * as themselves; administrators may act on behalf of another recruiter when
 * they explicitly supply the id.
 */
export function resolveRecruiterId(
  requestedRecruiterId: string | undefined,
  principal: EngagementPrincipal,
): string {
  if (!requestedRecruiterId) return principal.userId;
  if (requestedRecruiterId === principal.userId) return requestedRecruiterId;
  if (principal.role === 'ADMIN') return requestedRecruiterId;

  throw new AppError(
    403,
    'RECRUITER_ID_MISMATCH',
    'You may only record engagement for your own recruiter identity',
  );
}

/** Guards recruiter-scoped reads to the owner or an administrator. */
export function assertRecruiterAccess(principal: EngagementPrincipal, recruiterId: string): void {
  if (principal.role === 'ADMIN') return;
  if (principal.userId === recruiterId) return;

  throw new AppError(403, 'FORBIDDEN', 'You do not have access to this recruiter history');
}

/** Trims optional free text and collapses empty strings to `undefined`. */
export function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** A review carries actionable feedback when it has non-blank advice. */
export function hasActionableFeedback(actionableAdvice: string | undefined): boolean {
  return normalizeOptionalText(actionableAdvice) !== undefined;
}

export function toSwipe(row: SwipeRow): SwipeInteraction {
  return {
    id: row.id,
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    decision: row.decision as SwipeDecision,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRecruiterInterest(row: RecruiterInterestRow): RecruiterTalentInterest {
  return {
    id: row.id,
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReview(row: ReviewRow): CandidateReview {
  return {
    id: row.id,
    ...(row.swipeId ? { swipeId: row.swipeId } : {}),
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    decision: row.decision as SwipeDecision,
    ...(row.rating === null ? {} : { rating: row.rating }),
    ...(row.feedbackText ? { feedbackText: row.feedbackText } : {}),
    ...(row.actionableAdvice ? { actionableAdvice: row.actionableAdvice } : {}),
    hasActionableFeedback: row.hasActionableFeedback,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Aggregates a candidate's swipe counts and latest reviews. */
export function buildTalentSummary(
  talentId: string,
  swipes: readonly SwipeRow[],
  reviews: readonly ReviewRow[],
): TalentEngagementSummary {
  let rightSwipes = 0;
  let leftSwipes = 0;
  let deferredSwipes = 0;

  for (const swipe of swipes) {
    if (swipe.decision === 'APPROVE') rightSwipes += 1;
    else if (swipe.decision === 'REJECT') leftSwipes += 1;
    else if (swipe.decision === 'DEFER') deferredSwipes += 1;
  }

  return {
    talentId,
    rightSwipes,
    leftSwipes,
    deferredSwipes,
    totalReviews: reviews.length,
    reviews: reviews.map(toReview),
  };
}

export function buildRecruiterHistory(
  recruiterId: string,
  swipes: readonly SwipeRow[],
  reviews: readonly ReviewRow[],
): RecruiterEngagementHistory {
  return {
    recruiterId,
    swipes: swipes.map(toSwipe),
    reviews: reviews.map(toReview),
  };
}

/**
 * Builds the candidate ids that must be hidden from a recruiter's Talent Swipe
 * deck. A review always counts as screened. A swipe only counts once it is a
 * terminal approve/reject decision: deferring intentionally keeps the candidate
 * in the pool for a later review.
 */
export function buildRecruiterQueueExclusions(
  recruiterId: string,
  swipes: readonly Pick<SwipeRow, 'talentId' | 'decision'>[],
  reviews: readonly Pick<ReviewRow, 'talentId'>[],
): RecruiterQueueExclusions {
  const talentIds = new Set<string>();

  for (const review of reviews) {
    talentIds.add(review.talentId);
  }

  for (const swipe of swipes) {
    if (swipe.decision === 'APPROVE' || swipe.decision === 'REJECT') {
      talentIds.add(swipe.talentId);
    }
  }

  return {
    recruiterId,
    talentIds: [...talentIds].sort(),
  };
}
