import { describe, expect, it } from 'vitest';
import {
  acceptanceRatio,
  averageExperienceYears,
  averageTimeToMatchHours,
  matchDelayMs,
  normalizeSkill,
  rankLeaderboard,
  uniqueSkills,
  utcDay,
} from '../src/domain/analytics.js';

describe('skill helpers', () => {
  it('normalises casing and whitespace', () => {
    expect(normalizeSkill('  React   Native ')).toBe('react native');
  });

  it('deduplicates normalised skills', () => {
    expect(uniqueSkills(['React', 'react ', ' Node.js ', ''])).toEqual(['react', 'node.js']);
  });
});

describe('funnel math', () => {
  it('computes the acceptance ratio to four decimals', () => {
    expect(acceptanceRatio(1, 2)).toBe(0.3333);
    expect(acceptanceRatio(0, 0)).toBe(0);
  });

  it('returns undefined when there are no matches', () => {
    expect(averageTimeToMatchHours(0, 0)).toBeUndefined();
    expect(averageTimeToMatchHours(2, 7_200_000)).toBe(1);
  });

  it('averages experience and guards against empty skills', () => {
    expect(averageExperienceYears(10, 4)).toBe(2.5);
    expect(averageExperienceYears(5, 0)).toBe(0);
  });

  it('truncates to the UTC calendar day', () => {
    expect(utcDay(new Date('2026-11-06T23:42:11.000Z')).toISOString()).toBe(
      '2026-11-06T00:00:00.000Z',
    );
  });
});

describe('matchDelayMs', () => {
  const approvedAt = new Date('2026-11-06T12:00:00.000Z');

  it('measures from profile creation when known', () => {
    expect(matchDelayMs(approvedAt, new Date('2026-11-06T10:00:00.000Z'), approvedAt)).toBe(
      7_200_000,
    );
  });

  it('falls back to the swipe time and never goes negative', () => {
    expect(matchDelayMs(approvedAt, null, new Date('2026-11-06T13:00:00.000Z'))).toBe(0);
  });
});

describe('rankLeaderboard', () => {
  it('orders by actionable feedback, then credits, and assigns ranks', () => {
    const ranked = rankLeaderboard([
      { recruiterId: 'b', reviewsSubmitted: 4, actionableFeedbackCount: 1, creditsEarned: 20 },
      { recruiterId: 'a', reviewsSubmitted: 2, actionableFeedbackCount: 3, creditsEarned: 5 },
      { recruiterId: 'c', reviewsSubmitted: 1, actionableFeedbackCount: 1, creditsEarned: 40 },
    ]);

    expect(ranked.map((entry) => entry.recruiterId)).toEqual(['a', 'c', 'b']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });
});
