import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '@talent-ai/logger';
import type {
  CandidateReview,
  RecruiterEngagementHistory,
  ReviewSubmittedPayload,
  SwipeInteraction,
  SwipeRecordedPayload,
  TalentEngagementSummary,
} from '@talent-ai/shared-types';
import {
  assertRecruiterAccess,
  buildRecruiterHistory,
  buildTalentSummary,
  hasActionableFeedback,
  normalizeOptionalText,
  resolveRecruiterId,
  toReview,
  toSwipe,
} from '../domain/engagement.js';
import type { EngagementPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import { prisma } from '../lib/prisma.js';
import type { CreateReviewInput, CreateSwipeInput } from '../validation/engagement.schemas.js';

/** Number of reviews returned per talent/recruiter read. */
const READ_PAGE_SIZE = 100;

function correlationId(): string {
  return getCorrelationId() ?? randomUUID();
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

export interface RecordSwipeResult {
  swipe: SwipeInteraction;
  created: boolean;
  decisionChanged: boolean;
}

/**
 * Records a swipe. The unique `(recruiterId, talentId)` constraint makes the
 * endpoint idempotent: repeating the same decision returns the existing row
 * without emitting a duplicate event, while changing the decision updates the
 * row and publishes `swipe.recorded` again.
 */
export async function recordSwipe(
  input: CreateSwipeInput,
  principal: EngagementPrincipal,
  attempt = 0,
): Promise<RecordSwipeResult> {
  const recruiterId = resolveRecruiterId(input.recruiterId, principal);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.swipe.findUnique({
        where: {
          recruiterId_talentId: { recruiterId, talentId: input.talentId },
        },
      });

      if (existing && existing.decision === input.decision) {
        return {
          row: existing,
          created: false,
          decisionChanged: false,
        };
      }

      const row = existing
        ? await tx.swipe.update({
            where: { id: existing.id },
            data: { decision: input.decision },
          })
        : await tx.swipe.create({
            data: {
              recruiterId,
              talentId: input.talentId,
              decision: input.decision,
            },
          });

      const payload: SwipeRecordedPayload = {
        swipeId: row.id,
        recruiterId: row.recruiterId,
        talentId: row.talentId,
        decision: row.decision,
        timestamp: row.updatedAt.toISOString(),
      };

      await enqueueOutbox(tx, {
        eventType: 'swipe.recorded',
        aggregateId: row.id,
        correlationId: correlationId(),
        payload: { ...payload },
      });

      return { row, created: !existing, decisionChanged: Boolean(existing) };
    });

    logger.info(
      {
        swipeId: result.row.id,
        recruiterId,
        talentId: input.talentId,
        decision: input.decision,
        created: result.created,
        decisionChanged: result.decisionChanged,
      },
      result.created ? 'swipe recorded' : 'swipe updated',
    );

    return {
      swipe: toSwipe(result.row),
      created: result.created,
      decisionChanged: result.decisionChanged,
    };
  } catch (error) {
    // Concurrent first swipes race on the unique key; retry once so the caller
    // observes the idempotent update path instead of a 409.
    if (attempt === 0 && isPrismaError(error, 'P2002')) {
      return recordSwipe(input, principal, 1);
    }
    throw error;
  }
}

/**
 * Submits a recruiter review. When `swipeId` is supplied the swipe must belong
 * to the same recruiter and candidate, and a swipe can have at most one review.
 */
export async function submitReview(
  input: CreateReviewInput,
  principal: EngagementPrincipal,
): Promise<CandidateReview> {
  const recruiterId = resolveRecruiterId(input.recruiterId, principal);
  const feedbackText = normalizeOptionalText(input.feedbackText);
  const actionableAdvice = normalizeOptionalText(input.actionableAdvice);

  const review = await prisma.$transaction(async (tx) => {
    if (input.swipeId) {
      const swipe = await tx.swipe.findUnique({ where: { id: input.swipeId } });

      if (!swipe) {
        throw new AppError(404, 'SWIPE_NOT_FOUND', 'The referenced swipe was not found');
      }
      if (swipe.recruiterId !== recruiterId) {
        throw new AppError(
          403,
          'SWIPE_OWNERSHIP_MISMATCH',
          'The referenced swipe belongs to another recruiter',
        );
      }
      if (swipe.talentId !== input.talentId) {
        throw new AppError(
          400,
          'SWIPE_TALENT_MISMATCH',
          'The referenced swipe belongs to a different candidate',
        );
      }
      if (swipe.decision !== input.decision) {
        throw new AppError(
          400,
          'DECISION_MISMATCH',
          'The review decision must match the referenced swipe',
        );
      }

      const existing = await tx.review.findUnique({ where: { swipeId: input.swipeId } });
      if (existing) {
        throw new AppError(409, 'REVIEW_EXISTS', 'A review already exists for this swipe');
      }
    }

    const created = await tx.review.create({
      data: {
        ...(input.swipeId ? { swipeId: input.swipeId } : {}),
        recruiterId,
        talentId: input.talentId,
        decision: input.decision,
        ...(input.rating === undefined ? {} : { rating: input.rating }),
        ...(feedbackText ? { feedbackText } : {}),
        ...(actionableAdvice ? { actionableAdvice } : {}),
        hasActionableFeedback: hasActionableFeedback(actionableAdvice),
      },
    });

    const payload: ReviewSubmittedPayload = {
      reviewId: created.id,
      ...(created.swipeId ? { swipeId: created.swipeId } : {}),
      recruiterId: created.recruiterId,
      talentId: created.talentId,
      decision: created.decision,
      ...(created.feedbackText ? { feedbackText: created.feedbackText } : {}),
      hasActionableFeedback: created.hasActionableFeedback,
      timestamp: created.createdAt.toISOString(),
    };

    await enqueueOutbox(tx, {
      eventType: 'review.submitted',
      aggregateId: created.id,
      correlationId: correlationId(),
      payload: { ...payload },
    });

    return created;
  });

  logger.info(
    {
      reviewId: review.id,
      recruiterId,
      talentId: review.talentId,
      decision: review.decision,
      hasActionableFeedback: review.hasActionableFeedback,
    },
    'review submitted',
  );

  return toReview(review);
}

/** Candidate dashboard aggregate: swipe counts plus recent review feedback. */
export async function getTalentEngagementSummary(
  talentId: string,
): Promise<TalentEngagementSummary> {
  const [swipes, reviews] = await Promise.all([
    prisma.swipe.findMany({ where: { talentId }, orderBy: { createdAt: 'desc' } }),
    prisma.review.findMany({
      where: { talentId },
      orderBy: { createdAt: 'desc' },
      take: READ_PAGE_SIZE,
    }),
  ]);

  return buildTalentSummary(talentId, swipes, reviews);
}

/** Recruiter's own swipe and review history. */
export async function getRecruiterEngagementHistory(
  recruiterId: string,
  principal: EngagementPrincipal,
): Promise<RecruiterEngagementHistory> {
  assertRecruiterAccess(principal, recruiterId);

  const [swipes, reviews] = await Promise.all([
    prisma.swipe.findMany({
      where: { recruiterId },
      orderBy: { createdAt: 'desc' },
      take: READ_PAGE_SIZE,
    }),
    prisma.review.findMany({
      where: { recruiterId },
      orderBy: { createdAt: 'desc' },
      take: READ_PAGE_SIZE,
    }),
  ]);

  return buildRecruiterHistory(recruiterId, swipes, reviews);
}
