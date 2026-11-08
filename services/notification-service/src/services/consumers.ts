import type { DomainEvent } from '@talent-ai/shared-types';
import { EVENT_QUEUES } from '@talent-ai/shared-types';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { RecruiterContactModel, TalentContactModel } from '../models/contact.model.js';
import {
  aiEvaluationCompletedSchema,
  coinsAwardedSchema,
  recruiterRegisteredSchema,
  reviewSubmittedSchema,
  talentProfileEventSchema,
  tier3UnlockedSchema,
} from '../validation/event.schemas.js';
import { createNotification } from './notification.service.js';

function parseOrThrow<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
  },
  data: unknown,
  eventType: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `${eventType} payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }
  return parsed.data;
}

/** Keeps the candidate contact projection current for future notifications. */
export async function handleTalentProfileEvent(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(talentProfileEventSchema, event.data, event.eventType);

  await TalentContactModel.updateOne(
    { talentId: payload.talentId },
    {
      $set: {
        talentId: payload.talentId,
        userId: payload.userId,
        name: payload.name,
        ...(payload.email === undefined ? {} : { email: payload.email }),
      },
    },
    { upsert: true },
  );

  logger.debug(
    { eventId: event.eventId, talentId: payload.talentId },
    'talent contact projection updated',
  );
}

/** Keeps the recruiter contact projection current for future notifications. */
export async function handleRecruiterRegistered(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(recruiterRegisteredSchema, event.data, event.eventType);

  await RecruiterContactModel.updateOne(
    { userId: payload.userId },
    {
      $set: {
        recruiterId: payload.recruiterId,
        userId: payload.userId,
        organizationId: payload.organizationId,
        email: payload.email,
      },
    },
    { upsert: true },
  );

  logger.debug(
    { eventId: event.eventId, recruiterId: payload.recruiterId },
    'recruiter contact projection updated',
  );
}

export async function handleReviewSubmitted(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(reviewSubmittedSchema, event.data, event.eventType);
  const contact = await TalentContactModel.findOne({ talentId: payload.talentId });

  if (!contact) {
    logger.warn(
      { eventId: event.eventId, talentId: payload.talentId },
      'candidate contact not indexed yet; notification skipped',
    );
    return;
  }

  const feedback = payload.feedbackText?.trim();
  const body =
    payload.hasActionableFeedback && feedback
      ? `A recruiter reviewed your profile and left feedback: "${feedback}"`
      : 'A recruiter reviewed your profile and left feedback!';

  await createNotification({
    eventId: event.eventId,
    userId: contact.userId,
    type: 'REVIEW_RECEIVED',
    title: 'A recruiter reviewed your profile',
    body,
    data: {
      reviewId: payload.reviewId,
      talentId: payload.talentId,
      recruiterId: payload.recruiterId,
      decision: payload.decision,
    },
    ...(contact.email === undefined ? {} : { email: contact.email }),
  });
}

export async function handleCoinsAwarded(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(coinsAwardedSchema, event.data, event.eventType);

  // In this platform a recruiter's engagement identity is their user id, so the
  // event can be addressed even before `recruiter.registered` is projected.
  const contact = await RecruiterContactModel.findOne({ userId: payload.recruiterId });
  const body =
    payload.type === 'CREDIT_WELCOME_BONUS'
      ? `Welcome bonus: ${payload.amount} TalentCredits added to your wallet.`
      : payload.type === 'CREDIT_PURCHASE'
        ? `${payload.amount} TalentCredits added to your wallet.`
        : `You earned ${payload.amount} TalentCredits for your candidate review!`;

  await createNotification({
    eventId: event.eventId,
    userId: contact?.userId ?? payload.recruiterId,
    type: 'COINS_AWARDED',
    title: 'You earned TalentCredits',
    body,
    data: {
      walletId: payload.walletId,
      amount: payload.amount,
      balanceAfter: payload.balanceAfter,
      ...(payload.referenceId === undefined ? {} : { referenceId: payload.referenceId }),
    },
    ...(contact?.email === undefined ? {} : { email: contact.email }),
  });
}

export async function handleTier3Unlocked(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(tier3UnlockedSchema, event.data, event.eventType);
  const contact = await TalentContactModel.findOne({ talentId: payload.talentId });

  if (!contact) {
    logger.warn(
      { eventId: event.eventId, talentId: payload.talentId },
      'candidate contact not indexed yet; tier-3 notification skipped',
    );
    return;
  }

  await createNotification({
    eventId: event.eventId,
    userId: contact.userId,
    type: 'TIER3_UNLOCKED',
    title: 'An employer unlocked your full profile',
    body: 'An employer unlocked your full profile. Your complete profile is now visible to their team.',
    data: {
      grantId: payload.grantId,
      recruiterId: payload.recruiterId,
      chargedCredits: payload.chargedCredits,
    },
    ...(contact.email === undefined ? {} : { email: contact.email }),
  });
}

export async function handleAiEvaluationCompleted(event: DomainEvent<unknown>): Promise<void> {
  const payload = parseOrThrow(aiEvaluationCompletedSchema, event.data, event.eventType);
  const contact = await RecruiterContactModel.findOne({ userId: payload.recruiterId });

  await createNotification({
    eventId: event.eventId,
    userId: contact?.userId ?? payload.recruiterId,
    type: 'MATCH_FOUND',
    title: 'New high-affinity candidate match',
    body: payload.summary,
    data: {
      evaluationId: payload.evaluationId,
      talentId: payload.talentId,
      score: payload.score,
      ...(payload.jobId === undefined ? {} : { jobId: payload.jobId }),
    },
    ...(contact?.email === undefined ? {} : { email: contact.email }),
  });
}

/** Registers every durable notification consumer. */
export async function startNotificationConsumers(): Promise<void> {
  await eventBus.subscribe({
    queue: EVENT_QUEUES.notificationTalentConsumer,
    routingKeys: ['talent.profile.created', 'talent.profile.updated'],
    prefetch: 10,
    handler: (event) => handleTalentProfileEvent(event),
  });

  await eventBus.subscribe({
    queue: EVENT_QUEUES.notificationRegistrationConsumer,
    routingKeys: ['recruiter.registered'],
    handler: (event) => handleRecruiterRegistered(event),
  });

  await eventBus.subscribe({
    queue: EVENT_QUEUES.notificationReviewConsumer,
    routingKeys: ['review.submitted'],
    handler: (event) => handleReviewSubmitted(event),
  });

  await eventBus.subscribe({
    queue: EVENT_QUEUES.notificationRewardsConsumer,
    routingKeys: ['rewards.coins_awarded', 'rewards.tier3_unlocked'],
    handler: async (event) => {
      if (event.eventType === 'rewards.coins_awarded') {
        await handleCoinsAwarded(event);
        return;
      }
      await handleTier3Unlocked(event);
    },
  });

  await eventBus.subscribe({
    queue: EVENT_QUEUES.notificationMatchConsumer,
    routingKeys: ['ai.evaluation.completed'],
    handler: (event) => handleAiEvaluationCompleted(event),
  });

  logger.info(
    {
      queues: [
        EVENT_QUEUES.notificationTalentConsumer,
        EVENT_QUEUES.notificationRegistrationConsumer,
        EVENT_QUEUES.notificationReviewConsumer,
        EVENT_QUEUES.notificationRewardsConsumer,
        EVENT_QUEUES.notificationMatchConsumer,
      ],
    },
    'notification consumers registered',
  );
}
