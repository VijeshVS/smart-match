import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type { DomainEvent } from '@talent-ai/shared-types';
import { EVENT_QUEUES, EVENT_ROUTING_KEYS } from '@talent-ai/shared-types';
import { config } from '../config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { matchDelayMs, uniqueSkills, utcDay, type FunnelField } from '../domain/analytics.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import {
  aiEvaluationCompletedSchema,
  coinsAwardedSchema,
  recruiterJobPostedSchema,
  recruiterRegisteredSchema,
  reviewSubmittedSchema,
  swipeRecordedSchema,
  talentProfileEventSchema,
  tier3UnlockedSchema,
} from '../validation/analytics.schemas.js';

type Tx = Prisma.TransactionClient;

const { domain } = getServiceMetrics(config.serviceName);

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Resolves the two recruiter identifiers used across bounded contexts onto the
 * canonical user id: recruiter-service events carry the profile id, while
 * engagement, rewards and AI events carry the owning user id.
 */
async function resolveRecruiterId(tx: Tx, recruiterId: string): Promise<string> {
  const identity = await tx.recruiterIdentity.findFirst({
    where: { OR: [{ profileId: recruiterId }, { userId: recruiterId }] },
  });

  return identity?.userId ?? recruiterId;
}

async function bumpFunnel(tx: Tx, date: Date, field: FunnelField, by = 1): Promise<void> {
  const day = utcDay(date);

  await tx.funnelAggregate.upsert({
    where: { day },
    create: { day, [field]: by } as Prisma.FunnelAggregateUncheckedCreateInput,
    update: { [field]: { increment: by } } as Prisma.FunnelAggregateUpdateInput,
  });
}

/**
 * Recomputes a candidate's skill supply contribution. Existing skills are
 * diffed so profile updates adjust counts instead of double counting.
 */
async function applySkillSupply(
  tx: Tx,
  talentId: string,
  rawSkills: readonly string[],
  experienceYears: number,
): Promise<void> {
  const desired = new Map<string, number>();
  for (const skill of uniqueSkills(rawSkills)) {
    desired.set(skill, experienceYears);
  }

  const existing = await tx.candidateSkill.findMany({ where: { talentId } });
  const existingBySkill = new Map(existing.map((row) => [row.skill, row.experienceYears]));

  for (const row of existing) {
    if (desired.has(row.skill)) continue;

    await tx.skillMetric.upsert({
      where: { skill: row.skill },
      create: { skill: row.skill },
      update: {
        supplyCount: { decrement: 1 },
        experienceSum: { decrement: row.experienceYears },
        experienceCount: { decrement: 1 },
      },
    });
    await tx.candidateSkill.delete({
      where: { talentId_skill: { talentId, skill: row.skill } },
    });
  }

  for (const [skill, years] of desired) {
    const previousYears = existingBySkill.get(skill);

    if (previousYears === undefined) {
      await tx.skillMetric.upsert({
        where: { skill },
        create: {
          skill,
          supplyCount: 1,
          experienceSum: years,
          experienceCount: 1,
        },
        update: {
          supplyCount: { increment: 1 },
          experienceSum: { increment: years },
          experienceCount: { increment: 1 },
        },
      });
      await tx.candidateSkill.create({
        data: { talentId, skill, experienceYears: years },
      });
      continue;
    }

    if (previousYears !== years) {
      await tx.skillMetric.update({
        where: { skill },
        data: { experienceSum: { increment: years - previousYears } },
      });
      await tx.candidateSkill.update({
        where: { talentId_skill: { talentId, skill } },
        data: { experienceYears: years },
      });
    }
  }
}

async function applyTalentProfile(
  tx: Tx,
  event: DomainEvent<unknown>,
  occurredAt: Date,
): Promise<void> {
  const payload = talentProfileEventSchema.parse(event.data);

  await tx.candidateMetric.upsert({
    where: { talentId: payload.talentId },
    create: {
      talentId: payload.talentId,
      userId: payload.userId,
      profileCreatedAt: occurredAt,
    },
    update: {
      userId: payload.userId,
      ...(event.eventType === 'talent.profile.created' ? { profileCreatedAt: occurredAt } : {}),
    },
  });

  await applySkillSupply(tx, payload.talentId, payload.skills, payload.experienceYears);

  if (event.eventType === 'talent.profile.created') {
    await bumpFunnel(tx, occurredAt, 'profilesCreated');
  }
}

async function applyRecruiterRegistered(tx: Tx, event: DomainEvent<unknown>): Promise<void> {
  const payload = recruiterRegisteredSchema.parse(event.data);

  await tx.recruiterIdentity.upsert({
    where: { profileId: payload.recruiterId },
    create: {
      profileId: payload.recruiterId,
      userId: payload.userId,
      organizationId: payload.organizationId,
    },
    update: {
      userId: payload.userId,
      organizationId: payload.organizationId,
    },
  });

  // Metrics are keyed by the owning user id so recruiter-service events and
  // engagement/reward events converge on one row.
  await tx.recruiterMetric.upsert({
    where: { recruiterId: payload.userId },
    create: {
      recruiterId: payload.userId,
      organizationId: payload.organizationId,
    },
    update: { organizationId: payload.organizationId },
  });
}

async function applyJobPosted(tx: Tx, event: DomainEvent<unknown>): Promise<void> {
  const payload = recruiterJobPostedSchema.parse(event.data);
  const recruiterId = await resolveRecruiterId(tx, payload.recruiterId);

  await tx.recruiterMetric.upsert({
    where: { recruiterId },
    create: {
      recruiterId,
      organizationId: payload.organizationId,
      openJobs: 1,
    },
    update: {
      organizationId: payload.organizationId,
      openJobs: { increment: 1 },
    },
  });

  for (const skill of uniqueSkills(payload.requiredSkills)) {
    await tx.skillMetric.upsert({
      where: { skill },
      create: { skill, demandCount: 1 },
      update: { demandCount: { increment: 1 } },
    });

    await tx.recruiterSkillDemand.upsert({
      where: { recruiterId_skill: { recruiterId, skill } },
      create: { recruiterId, skill },
      update: { jobCount: { increment: 1 } },
    });
  }
}

async function applySwipe(tx: Tx, event: DomainEvent<unknown>, occurredAt: Date): Promise<void> {
  const payload = swipeRecordedSchema.parse(event.data);
  const recruiterId = await resolveRecruiterId(tx, payload.recruiterId);
  const approve = payload.decision === 'APPROVE';
  const defer = payload.decision === 'DEFER';

  await bumpFunnel(tx, occurredAt, 'swipesRecorded');

  // A defer keeps the candidate in the pipeline; it is neither an approval nor
  // a rejection, so it must not move the acceptance ratio or recruiter metrics.
  if (defer) return;

  const existing = await tx.candidateMetric.findUnique({
    where: { talentId: payload.talentId },
  });
  const firstApproval = approve && !existing?.firstApprovedAt;
  const delayMs = firstApproval
    ? matchDelayMs(occurredAt, existing?.profileCreatedAt, occurredAt)
    : 0;

  await tx.candidateMetric.upsert({
    where: { talentId: payload.talentId },
    create: {
      talentId: payload.talentId,
      rightSwipes: approve ? 1 : 0,
      leftSwipes: approve ? 0 : 1,
      ...(firstApproval ? { firstApprovedAt: occurredAt } : {}),
    },
    update: {
      ...(approve ? { rightSwipes: { increment: 1 } } : { leftSwipes: { increment: 1 } }),
      ...(firstApproval ? { firstApprovedAt: occurredAt } : {}),
    },
  });

  await tx.recruiterMetric.upsert({
    where: { recruiterId },
    create: {
      recruiterId,
      approvals: approve ? 1 : 0,
      rejections: approve ? 0 : 1,
      ...(firstApproval ? { matchCount: 1, matchDelayMsSum: delayMs } : {}),
    },
    update: {
      ...(approve ? { approvals: { increment: 1 } } : { rejections: { increment: 1 } }),
      ...(firstApproval
        ? {
            matchCount: { increment: 1 },
            matchDelayMsSum: { increment: delayMs },
          }
        : {}),
    },
  });

  if (approve) await bumpFunnel(tx, occurredAt, 'approvals');
}

async function applyReview(tx: Tx, event: DomainEvent<unknown>, occurredAt: Date): Promise<void> {
  const payload = reviewSubmittedSchema.parse(event.data);
  const recruiterId = await resolveRecruiterId(tx, payload.recruiterId);

  await tx.candidateMetric.upsert({
    where: { talentId: payload.talentId },
    create: { talentId: payload.talentId, totalReviews: 1 },
    update: { totalReviews: { increment: 1 } },
  });

  await tx.recruiterMetric.upsert({
    where: { recruiterId },
    create: {
      recruiterId,
      reviewsSubmitted: 1,
      actionableFeedbackCount: payload.hasActionableFeedback ? 1 : 0,
    },
    update: {
      reviewsSubmitted: { increment: 1 },
      ...(payload.hasActionableFeedback ? { actionableFeedbackCount: { increment: 1 } } : {}),
    },
  });

  await bumpFunnel(tx, occurredAt, 'reviewsSubmitted');
}

async function applyCoinsAwarded(tx: Tx, event: DomainEvent<unknown>): Promise<void> {
  const payload = coinsAwardedSchema.parse(event.data);
  const recruiterId = await resolveRecruiterId(tx, payload.recruiterId);
  const amount = Math.max(0, payload.amount);

  await tx.recruiterMetric.upsert({
    where: { recruiterId },
    create: { recruiterId, creditsEarned: amount },
    update: { creditsEarned: { increment: amount } },
  });
}

async function applyTier3Unlocked(
  tx: Tx,
  event: DomainEvent<unknown>,
  occurredAt: Date,
): Promise<void> {
  tier3UnlockedSchema.parse(event.data);
  await bumpFunnel(tx, occurredAt, 'tier3Unlocks');
}

async function applyEvent(tx: Tx, event: DomainEvent<unknown>, occurredAt: Date): Promise<void> {
  switch (event.eventType) {
    case 'talent.profile.created':
    case 'talent.profile.updated':
      await applyTalentProfile(tx, event, occurredAt);
      return;
    case 'recruiter.registered':
      await applyRecruiterRegistered(tx, event);
      return;
    case 'recruiter.job_posted':
      await applyJobPosted(tx, event);
      return;
    case 'swipe.recorded':
      await applySwipe(tx, event, occurredAt);
      return;
    case 'review.submitted':
      await applyReview(tx, event, occurredAt);
      return;
    case 'rewards.coins_awarded':
      await applyCoinsAwarded(tx, event);
      return;
    case 'rewards.tier3_unlocked':
      await applyTier3Unlocked(tx, event, occurredAt);
      return;
    case 'ai.evaluation.completed':
      // Validate the payload even though approvals already drive match metrics.
      aiEvaluationCompletedSchema.parse(event.data);
      return;
    default:
      // auth.user_registered / notification.sent are recorded for idempotency
      // but do not affect an aggregate yet.
      return;
  }
}

/**
 * Applies one domain event inside a transaction that also records its id, so
 * at-least-once delivery cannot double count. Handler failures roll back and
 * are nacked to the shared dead-letter queue.
 */
export async function handleAnalyticsEvent(event: DomainEvent<unknown>): Promise<void> {
  if (!(EVENT_ROUTING_KEYS as readonly string[]).includes(event.eventType)) {
    throw new Error(`Unsupported analytics event type: ${event.eventType}`);
  }

  const parsedTimestamp = new Date(event.timestamp);
  const occurredAt = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

  const alreadyProcessed = await prisma.processedEvent.findUnique({
    where: { eventId: event.eventId },
  });
  if (alreadyProcessed) {
    logger.debug({ eventId: event.eventId }, 'analytics event already processed; skipping');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: event.eventId, eventType: event.eventType },
      });
      await applyEvent(tx, event, occurredAt);
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      logger.debug(
        { eventId: event.eventId },
        'analytics event applied concurrently; skipping duplicate',
      );
      return;
    }
    throw error;
  }

  domain.analyticsEventsProcessed.inc({ event_type: event.eventType });
  domain.analyticsProjectionLag.observe(
    { event_type: event.eventType },
    Math.max(0, (Date.now() - occurredAt.getTime()) / 1_000),
  );

  logger.debug({ eventId: event.eventId, eventType: event.eventType }, 'analytics event applied');
}

/** Registers the single durable consumer that projects every domain event. */
export async function startAnalyticsConsumer(): Promise<void> {
  await eventBus.subscribe({
    queue: EVENT_QUEUES.analyticsAllEvents,
    routingKeys: EVENT_ROUTING_KEYS,
    prefetch: 20,
    handler: (event) => handleAnalyticsEvent(event),
  });

  logger.info(
    { queue: EVENT_QUEUES.analyticsAllEvents, routingKeys: EVENT_ROUTING_KEYS },
    'analytics consumer registered',
  );
}
