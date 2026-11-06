/** Pure helpers shared by the analytics consumers and read models. */

import type { RecruiterLeaderboardEntry } from '@talent-ai/shared-types';

export type FunnelField =
  'profilesCreated' | 'swipesRecorded' | 'reviewsSubmitted' | 'tier3Unlocks' | 'approvals';

/** Normalises a skill for aggregation without losing its display casing. */
export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Deduplicates and normalises a raw skill list. */
export function uniqueSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of skills) {
    const skill = normalizeSkill(raw);
    if (skill.length > 0) seen.add(skill);
  }
  return [...seen];
}

/** Truncates an instant to its UTC calendar day, used as the funnel key. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Approval / (approval + rejection), rounded to four decimals. */
export function acceptanceRatio(rightSwipes: number, leftSwipes: number): number {
  const total = rightSwipes + leftSwipes;
  if (total <= 0) return 0;
  return Number((rightSwipes / total).toFixed(4));
}

/** Average hours from profile creation (or first swipe) to first approval. */
export function averageTimeToMatchHours(
  matchCount: number,
  delayMsSum: number,
): number | undefined {
  if (matchCount <= 0) return undefined;
  return Number((delayMsSum / matchCount / 3_600_000).toFixed(2));
}

/** Mean experience for a skill's supplying candidates. */
export function averageExperienceYears(sum: number, count: number): number {
  if (count <= 0) return 0;
  return Number((sum / count).toFixed(2));
}

/**
 * Delay between a candidate's profile appearing and the first approval.
 * Falls back to the swipe time when the original creation event was missed.
 */
export function matchDelayMs(
  approvedAt: Date,
  profileCreatedAt: Date | null | undefined,
  fallbackStartedAt: Date,
): number {
  const startedAt = profileCreatedAt ?? fallbackStartedAt;
  return Math.max(0, approvedAt.getTime() - startedAt.getTime());
}

export interface LeaderboardCandidate {
  recruiterId: string;
  reviewsSubmitted: number;
  actionableFeedbackCount: number;
  creditsEarned: number;
}

/**
 * Applies the engagement leaderboard ordering and assigns sequential ranks.
 * Actionable feedback is weighted first because it is the behaviour the
 * rewards programme is designed to encourage.
 */
export function rankLeaderboard(
  rows: readonly LeaderboardCandidate[],
): RecruiterLeaderboardEntry[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.actionableFeedbackCount - a.actionableFeedbackCount ||
        b.creditsEarned - a.creditsEarned ||
        b.reviewsSubmitted - a.reviewsSubmitted ||
        a.recruiterId.localeCompare(b.recruiterId),
    )
    .map((row, index) => ({
      recruiterId: row.recruiterId,
      reviewsSubmitted: row.reviewsSubmitted,
      actionableFeedbackCount: row.actionableFeedbackCount,
      creditsEarned: row.creditsEarned,
      rank: index + 1,
    }));
}
