import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@talent-ai/shared-types';

const tx = vi.hoisted(() => ({
  processedEvent: { create: vi.fn() },
  candidateMetric: { upsert: vi.fn(), findUnique: vi.fn() },
  recruiterIdentity: { findFirst: vi.fn() },
  recruiterMetric: { upsert: vi.fn() },
  funnelAggregate: { upsert: vi.fn() },
  candidateSkill: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  skillMetric: { upsert: vi.fn(), update: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  processedEvent: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/lib/event-bus.js', () => ({
  eventBus: { subscribe: vi.fn() },
}));

const { handleAnalyticsEvent } = await import('../src/services/event-consumer.js');

const talentId = '99999999-9999-4999-8999-999999999999';
const resetAt = new Date('2026-11-09T11:00:00.000Z');

function domainEvent(
  eventType: DomainEvent['eventType'],
  data: Record<string, unknown>,
  timestamp = '2026-11-09T12:00:00.000Z',
): DomainEvent<unknown> {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType,
    aggregateId: talentId,
    timestamp,
    correlationId: 'correlation-1',
    version: '1.0',
    data,
  };
}

function profileData(changedFields: string[], qualificationsChanged?: boolean) {
  return {
    talentId,
    userId: '22222222-2222-4222-8222-222222222222',
    name: 'Ada Lovelace',
    field: 'Engineering',
    skills: [],
    experienceYears: 6,
    level: 'LEVEL_2_MID',
    changedFields,
    ...(qualificationsChanged === undefined ? {} : { qualificationsChanged }),
  };
}

function swipeData(timestamp: string) {
  return {
    swipeId: '33333333-3333-4333-8333-333333333333',
    recruiterId: '44444444-4444-4444-8444-444444444444',
    talentId,
    decision: 'APPROVE',
    timestamp,
  };
}

function reviewData(timestamp: string) {
  return {
    reviewId: '55555555-5555-4555-8555-555555555555',
    recruiterId: '44444444-4444-4444-8444-444444444444',
    talentId,
    decision: 'APPROVE',
    hasActionableFeedback: true,
    timestamp,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.processedEvent.findUnique.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );
  tx.processedEvent.create.mockResolvedValue({});
  tx.candidateMetric.upsert.mockResolvedValue({});
  tx.candidateMetric.findUnique.mockResolvedValue(null);
  tx.recruiterIdentity.findFirst.mockResolvedValue(null);
  tx.recruiterMetric.upsert.mockResolvedValue({});
  tx.funnelAggregate.upsert.mockResolvedValue({});
  tx.candidateSkill.findMany.mockResolvedValue([]);
  tx.candidateSkill.create.mockResolvedValue({});
  tx.skillMetric.upsert.mockResolvedValue({});
  tx.skillMetric.update.mockResolvedValue({});
});

describe('talent.profile.updated projection', () => {
  it('resets candidate engagement counters on a qualification change', async () => {
    await handleAnalyticsEvent(
      domainEvent('talent.profile.updated', profileData(['skills'], true)),
    );

    expect(tx.candidateMetric.upsert).toHaveBeenCalledWith({
      where: { talentId },
      create: expect.objectContaining({
        talentId,
        qualificationsUpdatedAt: new Date('2026-11-09T12:00:00.000Z'),
      }),
      update: expect.objectContaining({
        rightSwipes: 0,
        leftSwipes: 0,
        totalReviews: 0,
        firstApprovedAt: null,
        qualificationsUpdatedAt: new Date('2026-11-09T12:00:00.000Z'),
      }),
    });
  });

  it('keeps engagement counters when only contact fields change', async () => {
    await handleAnalyticsEvent(
      domainEvent('talent.profile.updated', profileData(['name', 'email'], false)),
    );

    const update = tx.candidateMetric.upsert.mock.calls[0]?.[0]?.update;
    expect(update).not.toHaveProperty('rightSwipes');
    expect(update).not.toHaveProperty('qualificationsUpdatedAt');
  });

  it('falls back to changedFields for legacy producers', async () => {
    await handleAnalyticsEvent(domainEvent('talent.profile.updated', profileData(['education'])));

    expect(tx.candidateMetric.upsert.mock.calls[0]?.[0]?.update).toMatchObject({
      rightSwipes: 0,
      leftSwipes: 0,
      totalReviews: 0,
    });
  });
});

describe('stale engagement events', () => {
  it('does not re-count a swipe that predates the latest reset', async () => {
    tx.candidateMetric.findUnique.mockResolvedValue({ qualificationsUpdatedAt: resetAt });

    await handleAnalyticsEvent(
      domainEvent('swipe.recorded', swipeData('2026-11-09T10:00:00.000Z')),
    );

    expect(tx.candidateMetric.upsert).not.toHaveBeenCalled();
    expect(tx.recruiterMetric.upsert).not.toHaveBeenCalled();
    // The historical funnel still reflects that the swipe happened.
    expect(tx.funnelAggregate.upsert).toHaveBeenCalled();
  });

  it('counts a swipe recorded after the latest reset', async () => {
    tx.candidateMetric.findUnique.mockResolvedValue({ qualificationsUpdatedAt: resetAt });

    await handleAnalyticsEvent(
      domainEvent('swipe.recorded', swipeData('2026-11-09T11:30:00.000Z')),
    );

    expect(tx.candidateMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ rightSwipes: { increment: 1 } }),
      }),
    );
  });

  it('does not re-count a stale review but keeps recruiter history', async () => {
    tx.candidateMetric.findUnique.mockResolvedValue({ qualificationsUpdatedAt: resetAt });

    await handleAnalyticsEvent(
      domainEvent('review.submitted', reviewData('2026-11-09T10:00:00.000Z')),
    );

    expect(tx.candidateMetric.upsert).not.toHaveBeenCalled();
    expect(tx.recruiterMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ reviewsSubmitted: { increment: 1 } }),
      }),
    );
    expect(tx.funnelAggregate.upsert).toHaveBeenCalled();
  });
});
