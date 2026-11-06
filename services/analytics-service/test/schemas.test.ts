import { describe, expect, it } from 'vitest';
import {
  candidateParamsSchema,
  funnelQuerySchema,
  leaderboardQuerySchema,
  swipeRecordedSchema,
  talentProfileEventSchema,
  topSkillsQuerySchema,
} from '../src/validation/analytics.schemas.js';

describe('analytics query schemas', () => {
  it('applies list limits and rejects oversized pages', () => {
    expect(topSkillsQuerySchema.parse({})).toEqual({ limit: 10 });
    expect(leaderboardQuerySchema.parse({ limit: '25' })).toEqual({ limit: 25 });
    expect(topSkillsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(leaderboardQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('bounds the funnel window', () => {
    expect(funnelQuerySchema.parse({})).toEqual({ days: 30 });
    expect(funnelQuerySchema.safeParse({ days: '366' }).success).toBe(false);
  });

  it('requires a non-empty candidate id', () => {
    expect(candidateParamsSchema.parse({ id: 'talent-1' })).toEqual({ id: 'talent-1' });
    expect(candidateParamsSchema.safeParse({ id: '' }).success).toBe(false);
  });
});

describe('event schemas', () => {
  it('accepts the talent profile payload with its owning user', () => {
    const parsed = talentProfileEventSchema.parse({
      talentId: 'talent-1',
      userId: 'user-1',
      name: 'Ada Lovelace',
      field: 'Engineering',
      skills: ['TypeScript'],
      experienceYears: 6,
      level: 'LEVEL_2_MID',
    });

    expect(parsed.userId).toBe('user-1');
    expect(parsed.skills).toEqual(['TypeScript']);
  });

  it('defaults missing talent skills to an empty list', () => {
    const parsed = talentProfileEventSchema.parse({
      talentId: 'talent-2',
      userId: 'user-2',
      name: 'Grace Hopper',
      field: 'Engineering',
      experienceYears: 10,
      level: 'LEVEL_3_LEAD',
    });

    expect(parsed.skills).toEqual([]);
  });

  it('rejects an unknown swipe decision', () => {
    expect(
      swipeRecordedSchema.safeParse({
        swipeId: 'swipe-1',
        recruiterId: 'user-1',
        talentId: 'talent-1',
        decision: 'MAYBE',
        timestamp: '2026-11-06T10:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});
