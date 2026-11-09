import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type { DomainEvent, SwipeRecordedPayload } from '@talent-ai/shared-types';
import { EVENT_QUEUES } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { isRewardingSwipeDecision } from '../domain/rewards.js';
import { swipeRecordedPayloadSchema } from '../validation/rewards.schemas.js';
import { creditSwipeDecision } from './rewards.service.js';

const { domain } = getServiceMetrics(config.serviceName);

/**
 * Consumes `swipe.recorded` and credits the recruiter for a terminal accept or
 * reject decision. Deferrals are intentionally unrewarded.
 *
 * The event bus delivers at least once, so the handler is idempotent: the
 * ledger's unique `(type, referenceId)` constraint keyed on `swipeId` makes a
 * redelivered event — or a decision change on the same swipe — a no-op.
 */
export async function handleSwipeRecorded(event: DomainEvent<SwipeRecordedPayload>): Promise<void> {
  const parsed = swipeRecordedPayloadSchema.safeParse(event.data);

  if (!parsed.success) {
    throw new Error(
      `swipe.recorded payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  if (!isRewardingSwipeDecision(parsed.data.decision)) {
    domain.rewardsSaga.inc({ saga: 'swipe_credit', outcome: 'skipped' });
    logger.debug(
      { eventId: event.eventId, swipeId: parsed.data.swipeId, decision: parsed.data.decision },
      'swipe decision is not rewardable; no credit awarded',
    );
    return;
  }

  await creditSwipeDecision({
    swipeId: parsed.data.swipeId,
    recruiterId: parsed.data.recruiterId,
    correlationId: event.correlationId,
  });
}

/** Registers the durable swipe-incentive consumer. */
export async function startSwipeConsumer(): Promise<void> {
  await eventBus.subscribe<SwipeRecordedPayload>({
    queue: EVENT_QUEUES.rewardsSwipeConsumer,
    routingKeys: ['swipe.recorded'],
    handler: (event) => handleSwipeRecorded(event),
  });

  logger.info(
    { queue: EVENT_QUEUES.rewardsSwipeConsumer, routingKey: 'swipe.recorded' },
    'swipe consumer registered',
  );
}
