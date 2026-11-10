import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '@talent-ai/logger';
import type {
  CandidateReview,
  RecruiterEngagementHistory,
  RecruiterQueueExclusions,
  RecruiterTalentInterest,
  ReviewSubmittedPayload,
  SwipeInteraction,
  SwipeRecordedPayload,
  TalentEngagementSummary,
} from '@talent-ai/shared-types';
import {
  assertRecruiterAccess,
  buildRecruiterHistory,
  buildRecruiterQueueExclusions,
  buildTalentSummary,
  hasActionableFeedback,
  normalizeOptionalText,
  resolveRecruiterId,
  toRecruiterInterest,
  toReview,
  toSwipe,
} from '../domain/engagement.js';
import type { EngagementPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma, Review as ReviewRow } from '../generated/prisma/client.js';
import type {
  CreateRecruiterInterestInput,
  CreateReviewInput,
  CreateSwipeInput,
} from '../validation/engagement.schemas.js';

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

export interface SubmitReviewResult {
  review: CandidateReview;
  created: boolean;
  updated: boolean;
}

/** Publishes `review.submitted` inside the caller's transaction. */
async function enqueueReviewEvent(tx: Prisma.TransactionClient, review: ReviewRow): Promise<void> {
  const payload: ReviewSubmittedPayload = {
    reviewId: review.id,
    ...(review.swipeId ? { swipeId: review.swipeId } : {}),
    recruiterId: review.recruiterId,
    talentId: review.talentId,
    decision: review.decision,
    ...(review.feedbackText ? { feedbackText: review.feedbackText } : {}),
    hasActionableFeedback: review.hasActionableFeedback,
    timestamp: review.createdAt.toISOString(),
  };

  await enqueueOutbox(tx, {
    eventType: 'review.submitted',
    aggregateId: review.id,
    correlationId: correlationId(),
    payload: { ...payload },
  });
}

/**
 * Submits a recruiter review. When `swipeId` is supplied the swipe must belong
 * to the same recruiter and candidate. A recruiter can review a candidate at
 * most once: retrying (or updating) the same submission updates the existing
 * row and reuses its review id, so downstream credit consumers never
 * double-award. This holds even when the retry omits `swipeId`.
 */
export async function submitReview(
  input: CreateReviewInput,
  principal: EngagementPrincipal,
  attempt = 0,
): Promise<SubmitReviewResult> {
  const recruiterId = resolveRecruiterId(input.recruiterId, principal);
  const feedbackText = normalizeOptionalText(input.feedbackText);
  const actionableAdvice = normalizeOptionalText(input.actionableAdvice);

  try {
    const result = await prisma.$transaction(async (tx) => {
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
      }

      const existing =
        (input.swipeId
          ? await tx.review.findUnique({ where: { swipeId: input.swipeId } })
          : null) ??
        (await tx.review.findUnique({
          where: {
            recruiterId_talentId: { recruiterId, talentId: input.talentId },
          },
        }));

      if (existing) {
        // Retry/update path: keep the review id stable so the rewards ledger's
        // `(type, referenceId)` idempotency key absorbs the repeated event.
        const nextSwipeId = existing.swipeId ?? input.swipeId ?? null;
        const nextRating = input.rating === undefined ? existing.rating : input.rating;
        const nextFeedback =
          input.feedbackText === undefined ? existing.feedbackText : (feedbackText ?? null);
        const nextAdvice =
          input.actionableAdvice === undefined
            ? existing.actionableAdvice
            : (actionableAdvice ?? null);
        const nextHasActionable =
          input.actionableAdvice === undefined
            ? existing.hasActionableFeedback
            : hasActionableFeedback(actionableAdvice);

        const changed =
          nextSwipeId !== existing.swipeId ||
          input.decision !== existing.decision ||
          nextRating !== existing.rating ||
          nextFeedback !== existing.feedbackText ||
          nextAdvice !== existing.actionableAdvice ||
          nextHasActionable !== existing.hasActionableFeedback;

        if (!changed) {
          return { row: existing, created: false, updated: false };
        }

        const updated = await tx.review.update({
          where: { id: existing.id },
          data: {
            swipeId: nextSwipeId,
            decision: input.decision,
            rating: nextRating,
            feedbackText: nextFeedback,
            actionableAdvice: nextAdvice,
            hasActionableFeedback: nextHasActionable,
          },
        });

        await enqueueReviewEvent(tx, updated);

        return { row: updated, created: false, updated: true };
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

      await enqueueReviewEvent(tx, created);

      return { row: created, created: true, updated: false };
    });
    const review = result.row;

    logger.info(
      {
        reviewId: review.id,
        recruiterId,
        talentId: review.talentId,
        decision: review.decision,
        hasActionableFeedback: review.hasActionableFeedback,
        created: result.created,
        updated: result.updated,
      },
      result.created ? 'review submitted' : result.updated ? 'review updated' : 'review unchanged',
    );

    return {
      review: toReview(review),
      created: result.created,
      updated: result.updated,
    };
  } catch (error) {
    // Concurrent first reviews race on the `(recruiterId, talentId)` unique
    // key; retry once so the caller observes the idempotent update path.
    if (attempt === 0 && isPrismaError(error, 'P2002')) {
      return submitReview(input, principal, 1);
    }
    throw error;
  }
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

/**
 * Candidate ids that should be removed from the recruiter's Talent Swipe deck.
 * Reads every matching row (unlike the paged history endpoint) so the blind
 * queue filter never lets an old review resurface.
 */
export async function getRecruiterQueueExclusions(
  recruiterId: string,
  principal: EngagementPrincipal,
): Promise<RecruiterQueueExclusions> {
  assertRecruiterAccess(principal, recruiterId);

  const [swipes, reviews] = await Promise.all([
    prisma.swipe.findMany({
      where: {
        recruiterId,
        decision: { in: ['APPROVE', 'REJECT'] },
      },
      select: { talentId: true, decision: true },
    }),
    prisma.review.findMany({
      where: { recruiterId },
      select: { talentId: true },
    }),
  ]);

  return buildRecruiterQueueExclusions(recruiterId, swipes, reviews);
}

export interface MarkRecruiterInterestResult {
  interest: RecruiterTalentInterest;
  created: boolean;
}

/**
 * Marks a candidate as interested for the recruiter. The unique
 * `(recruiterId, talentId)` key makes this idempotent: repeat clicks return the
 * existing row instead of creating duplicate pipeline entries.
 */
export async function markRecruiterInterest(
  input: CreateRecruiterInterestInput,
  principal: EngagementPrincipal,
  attempt = 0,
): Promise<MarkRecruiterInterestResult> {
  const recruiterId = resolveRecruiterId(input.recruiterId, principal);

  try {
    const existing = await prisma.recruiterInterest.findUnique({
      where: { recruiterId_talentId: { recruiterId, talentId: input.talentId } },
    });

    if (existing) {
      return { interest: toRecruiterInterest(existing), created: false };
    }

    const row = await prisma.recruiterInterest.create({
      data: { recruiterId, talentId: input.talentId },
    });

    logger.info(
      { interestId: row.id, recruiterId, talentId: row.talentId },
      'recruiter marked candidate interested',
    );

    return { interest: toRecruiterInterest(row), created: true };
  } catch (error) {
    // Concurrent first clicks race on the unique key; retry once so the caller
    // observes the idempotent existing row instead of a 409.
    if (attempt === 0 && isPrismaError(error, 'P2002')) {
      return markRecruiterInterest(input, principal, 1);
    }
    throw error;
  }
}

/** Removes a candidate from the caller's interested pipeline. */
export async function removeRecruiterInterest(
  talentId: string,
  principal: EngagementPrincipal,
): Promise<{ removed: boolean }> {
  const recruiterId = resolveRecruiterId(undefined, principal);

  const result = await prisma.recruiterInterest.deleteMany({
    where: { recruiterId, talentId },
  });

  if (result.count > 0) {
    logger.info({ recruiterId, talentId }, 'recruiter removed candidate interest');
  }

  return { removed: result.count > 0 };
}

/** Lists every candidate the recruiter has explicitly marked as interested. */
export async function listRecruiterInterests(
  recruiterId: string,
  principal: EngagementPrincipal,
): Promise<RecruiterTalentInterest[]> {
  assertRecruiterAccess(principal, recruiterId);

  const rows = await prisma.recruiterInterest.findMany({
    where: { recruiterId },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toRecruiterInterest);
}
