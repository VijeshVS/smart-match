import type { ISODateString, UUID } from './common.js';

export const SWIPE_DECISIONS = ['APPROVE', 'REJECT', 'DEFER'] as const;
export type SwipeDecision = (typeof SWIPE_DECISIONS)[number];

export interface SwipeInteraction {
  id: UUID;
  recruiterId: UUID;
  talentId: UUID;
  decision: SwipeDecision;
  createdAt: ISODateString;
}

export interface CreateSwipeRequest {
  recruiterId?: UUID;
  talentId: UUID;
  decision: SwipeDecision;
}

export interface CandidateReview {
  id: UUID;
  swipeId?: UUID;
  recruiterId: UUID;
  talentId: UUID;
  decision: SwipeDecision;
  rating?: number;
  feedbackText?: string;
  actionableAdvice?: string;
  hasActionableFeedback: boolean;
  createdAt: ISODateString;
}

export interface CreateReviewRequest {
  recruiterId?: UUID;
  talentId: UUID;
  decision: SwipeDecision;
  rating?: number;
  feedbackText?: string;
  actionableAdvice?: string;
}

export interface TalentEngagementSummary {
  talentId: UUID;
  rightSwipes: number;
  leftSwipes: number;
  deferredSwipes: number;
  totalReviews: number;
  reviews: CandidateReview[];
}

export interface RecruiterEngagementHistory {
  recruiterId: UUID;
  swipes: SwipeInteraction[];
  reviews: CandidateReview[];
}

/**
 * Candidate ids a recruiter should no longer see in the Talent Swipe deck:
 * anyone they reviewed or gave a terminal approve/reject decision. Deferred
 * candidates without feedback stay eligible for a later review.
 */
export interface RecruiterQueueExclusions {
  recruiterId: UUID;
  talentIds: UUID[];
}

/**
 * A candidate a recruiter explicitly bookmarked from TalentLens. Interests form
 * the recruiter's engaged pipeline alongside candidates unlocked with credits.
 */
export interface RecruiterTalentInterest {
  id: UUID;
  recruiterId: UUID;
  talentId: UUID;
  createdAt: ISODateString;
}

export interface SwipeRecordedPayload {
  swipeId: UUID;
  recruiterId: UUID;
  talentId: UUID;
  decision: SwipeDecision;
  timestamp: ISODateString;
}

export interface ReviewSubmittedPayload {
  reviewId: UUID;
  swipeId?: UUID;
  recruiterId: UUID;
  talentId: UUID;
  decision: SwipeDecision;
  feedbackText?: string;
  hasActionableFeedback: boolean;
  timestamp: ISODateString;
}
