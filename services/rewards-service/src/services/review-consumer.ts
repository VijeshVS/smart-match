import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type { DomainEvent, ReviewSubmittedPayload } from '@talent-ai/shared-types';
import { EVENT_QUEUES } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { reviewSubmittedPayloadSchema } from '../validation/rewards.schemas.js';
import { creditReviewFeedback } from './rewards.service.js';

const { domain } = getServiceMetrics(config.serviceName);

/**
 * Consumes `review.submitted` and credits the reviewer when the review carries
 * actionable feedback.
 *
 * The event bus delivers at least once, so the handler is idempotent: the
 * ledger's unique `(type, referenceId)` constraint keyed on `reviewId` makes a
 * redelivered event a no-op. Handler failures are nacked to the dead-letter
 * queue by the event bus rather than acknowledged silently.
 */
export async function handleReviewSubmitted(
  event: DomainEvent<ReviewSubmittedPayload>,
): Promise<void> {
  const parsed = reviewSubmittedPayloadSchema.safeParse(event.data);

  if (!parsed.success) {
    throw new Error(
      `review.submitted payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  if (!parsed.data.hasActionableFeedback) {
    domain.rewardsSaga.inc({ saga: 'review_credit', outcome: 'skipped' });
    logger.debug(
      { eventId: event.eventId, reviewId: parsed.data.reviewId },
      'review has no actionable feedback; no credit awarded',
    );
    return;
  }

  await creditReviewFeedback({
    reviewId: parsed.data.reviewId,
    recruiterId: parsed.data.recruiterId,
    correlationId: event.correlationId,
  });
}

/** Registers the durable review-incentive consumer. */
export async function startReviewConsumer(): Promise<void> {
  await eventBus.subscribe<ReviewSubmittedPayload>({
    queue: EVENT_QUEUES.rewardsReviewConsumer,
    routingKeys: ['review.submitted'],
    handler: (event) => handleReviewSubmitted(event),
  });

  logger.info(
    { queue: EVENT_QUEUES.rewardsReviewConsumer, routingKey: 'review.submitted' },
    'review consumer registered',
  );
}
