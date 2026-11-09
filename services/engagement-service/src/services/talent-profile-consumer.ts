import {
  EVENT_QUEUES,
  hasTalentQualificationChanges,
  type DomainEvent,
  type TalentProfileUpdatedPayload,
} from '@talent-ai/shared-types';
import type { Review as ReviewRow, Swipe as SwipeRow } from '../generated/prisma/client.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { talentProfileUpdatedSchema } from '../validation/engagement.schemas.js';

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

/** JSON-safe snapshot of a swipe row for the immutable reset archive. */
function toArchivedSwipe(row: SwipeRow) {
  return {
    id: row.id,
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    decision: row.decision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** JSON-safe snapshot of a review row for the immutable reset archive. */
function toArchivedReview(row: ReviewRow) {
  return {
    id: row.id,
    swipeId: row.swipeId,
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    decision: row.decision,
    rating: row.rating,
    feedbackText: row.feedbackText,
    actionableAdvice: row.actionableAdvice,
    hasActionableFeedback: row.hasActionableFeedback,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Consumes `talent.profile.updated` and clears the candidate's active swipe and
 * review history when their qualifications changed.
 *
 * The previous rows are copied into `profile_reset_archives` before deletion,
 * so the audit trail survives while recruiters get a clean slate and the blind
 * Talent Swipe queue can surface the refreshed profile again.
 *
 * Idempotency: the archive's unique `eventId` stops a redelivered event before
 * any delete runs. An event older than the latest recorded reset is ignored so
 * out-of-order delivery cannot wipe a newer, already-reset evaluation.
 */
export async function handleTalentProfileUpdated(event: DomainEvent<unknown>): Promise<void> {
  const parsed = talentProfileUpdatedSchema.safeParse(event.data);

  if (!parsed.success) {
    throw new Error(
      `talent.profile.updated payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  const { talentId, changedFields } = parsed.data;
  const qualificationsChanged =
    parsed.data.qualificationsChanged ?? hasTalentQualificationChanges(changedFields);

  if (!qualificationsChanged) {
    logger.debug(
      { eventId: event.eventId, talentId, changedFields },
      'profile update did not change qualifications; engagement retained',
    );
    return;
  }

  const parsedResetAt = new Date(event.timestamp);
  const resetAt = Number.isNaN(parsedResetAt.getTime()) ? new Date() : parsedResetAt;

  try {
    await prisma.$transaction(async (tx) => {
      const latestReset = await tx.profileResetArchive.findFirst({
        where: { talentId },
        orderBy: { resetAt: 'desc' },
        select: { resetAt: true },
      });

      if (latestReset && latestReset.resetAt >= resetAt) {
        logger.debug(
          { eventId: event.eventId, talentId, resetAt, latestResetAt: latestReset.resetAt },
          'profile reset event is older than the latest reset; skipping',
        );
        return;
      }

      const [swipes, reviews] = await Promise.all([
        tx.swipe.findMany({ where: { talentId }, orderBy: { createdAt: 'asc' } }),
        tx.review.findMany({ where: { talentId }, orderBy: { createdAt: 'asc' } }),
      ]);

      await tx.profileResetArchive.create({
        data: {
          eventId: event.eventId,
          talentId,
          resetAt,
          swipes: swipes.map(toArchivedSwipe),
          reviews: reviews.map(toArchivedReview),
        },
      });

      // Reviews reference swipes, so remove them first.
      await tx.review.deleteMany({ where: { talentId } });
      await tx.swipe.deleteMany({ where: { talentId } });

      logger.info(
        {
          eventId: event.eventId,
          talentId,
          changedFields,
          archivedSwipes: swipes.length,
          archivedReviews: reviews.length,
        },
        'candidate engagement reset after qualification update',
      );
    });
  } catch (error) {
    // A concurrent delivery of the same event lost the unique `eventId` race.
    if (isPrismaError(error, 'P2002')) {
      logger.debug(
        { eventId: event.eventId, talentId },
        'profile reset already applied; skipping duplicate',
      );
      return;
    }

    throw error;
  }
}

/** Registers the durable profile-update consumer. */
export async function startTalentProfileConsumer(): Promise<void> {
  await eventBus.subscribe<TalentProfileUpdatedPayload>({
    queue: EVENT_QUEUES.engagementTalentProfileConsumer,
    routingKeys: ['talent.profile.updated'],
    prefetch: 10,
    handler: (event) => handleTalentProfileUpdated(event),
  });

  logger.info(
    { queue: EVENT_QUEUES.engagementTalentProfileConsumer, routingKey: 'talent.profile.updated' },
    'talent profile consumer registered',
  );
}
