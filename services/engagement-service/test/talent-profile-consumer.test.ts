import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@talent-ai/shared-types';

const tx = vi.hoisted(() => ({
  profileResetArchive: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  swipe: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  review: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/lib/event-bus.js', () => ({ eventBus: { subscribe: vi.fn() } }));

const { handleTalentProfileUpdated } = await import('../src/services/talent-profile-consumer.js');

const talentId = '99999999-9999-4999-8999-999999999999';

function profileUpdatedEvent(
  data: Record<string, unknown>,
  timestamp = '2026-11-09T10:00:00.000Z',
): DomainEvent<unknown> {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'talent.profile.updated',
    aggregateId: talentId,
    timestamp,
    correlationId: 'correlation-1',
    version: '1.0',
    data: {
      talentId,
      userId: '22222222-2222-4222-8222-222222222222',
      name: 'Ada Lovelace',
      field: 'Engineering',
      skills: ['TypeScript'],
      experienceYears: 6,
      level: 'LEVEL_2_MID',
      ...data,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );
  tx.profileResetArchive.findFirst.mockResolvedValue(null);
  tx.profileResetArchive.create.mockResolvedValue({});
  tx.swipe.findMany.mockResolvedValue([]);
  tx.review.findMany.mockResolvedValue([]);
  tx.swipe.deleteMany.mockResolvedValue({ count: 0 });
  tx.review.deleteMany.mockResolvedValue({ count: 0 });
});

describe('handleTalentProfileUpdated', () => {
  it('does not touch engagement when only identity or contact fields change', async () => {
    await handleTalentProfileUpdated(
      profileUpdatedEvent({ changedFields: ['name', 'email'], qualificationsChanged: false }),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('archives the previous rows and clears the active engagement on a qualification update', async () => {
    const swipe = {
      id: '33333333-3333-4333-8333-333333333333',
      recruiterId: '44444444-4444-4444-8444-444444444444',
      talentId,
      decision: 'APPROVE',
      createdAt: new Date('2026-11-08T09:00:00.000Z'),
      updatedAt: new Date('2026-11-08T09:00:00.000Z'),
    };
    const review = {
      id: '55555555-5555-4555-8555-555555555555',
      swipeId: swipe.id,
      recruiterId: swipe.recruiterId,
      talentId,
      decision: 'APPROVE',
      rating: 5,
      feedbackText: 'Strong systems thinking.',
      actionableAdvice: null,
      hasActionableFeedback: false,
      createdAt: new Date('2026-11-08T09:05:00.000Z'),
      updatedAt: new Date('2026-11-08T09:05:00.000Z'),
    };
    tx.swipe.findMany.mockResolvedValue([swipe]);
    tx.review.findMany.mockResolvedValue([review]);

    await handleTalentProfileUpdated(
      profileUpdatedEvent({ changedFields: ['skills'], qualificationsChanged: true }),
    );

    expect(tx.profileResetArchive.create).toHaveBeenCalledWith({
      data: {
        eventId: '11111111-1111-4111-8111-111111111111',
        talentId,
        resetAt: new Date('2026-11-09T10:00:00.000Z'),
        swipes: [
          {
            ...swipe,
            createdAt: swipe.createdAt.toISOString(),
            updatedAt: swipe.updatedAt.toISOString(),
          },
        ],
        reviews: [
          {
            ...review,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString(),
          },
        ],
      },
    });
    expect(tx.review.deleteMany).toHaveBeenCalledWith({ where: { talentId } });
    expect(tx.swipe.deleteMany).toHaveBeenCalledWith({ where: { talentId } });
  });

  it('falls back to changedFields when a legacy event has no flag', async () => {
    await handleTalentProfileUpdated(
      profileUpdatedEvent({
        changedFields: ['previousExperience'],
        qualificationsChanged: undefined,
      }),
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.swipe.deleteMany).toHaveBeenCalledWith({ where: { talentId } });
  });

  it('treats duplicate delivery as a no-op', async () => {
    tx.profileResetArchive.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      handleTalentProfileUpdated(
        profileUpdatedEvent({ changedFields: ['education'], qualificationsChanged: true }),
      ),
    ).resolves.toBeUndefined();

    expect(tx.review.deleteMany).not.toHaveBeenCalled();
    expect(tx.swipe.deleteMany).not.toHaveBeenCalled();
  });

  it('ignores an event older than the latest applied reset', async () => {
    tx.profileResetArchive.findFirst.mockResolvedValue({
      resetAt: new Date('2026-11-09T11:00:00.000Z'),
    });

    await handleTalentProfileUpdated(
      profileUpdatedEvent({ changedFields: ['skills'], qualificationsChanged: true }),
    );

    expect(tx.profileResetArchive.create).not.toHaveBeenCalled();
    expect(tx.review.deleteMany).not.toHaveBeenCalled();
    expect(tx.swipe.deleteMany).not.toHaveBeenCalled();
  });
});
