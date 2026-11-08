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
