import { describe, expect, it } from 'vitest';
import {
  profileSummaryRequestSchema,
  profileSuggestionsRequestSchema,
  talentLensRequestSchema,
  talentProfileEventSchema,
} from '../src/validation/ai.schemas.js';

describe('AI request schemas', () => {
  it('applies the default TalentLens limit', () => {
    const parsed = talentLensRequestSchema.parse({ query: 'senior React engineer' });
    expect(parsed.limit).toBe(10);
  });

  it('rejects a too-short TalentLens query and an out-of-range limit', () => {
    expect(talentLensRequestSchema.safeParse({ query: 'ai' }).success).toBe(false);
    expect(
      talentLensRequestSchema.safeParse({ query: 'senior React engineer', limit: 0 }).success,
    ).toBe(false);
  });

  it('rejects inverted experience filters', () => {
    const result = talentLensRequestSchema.safeParse({
      query: 'senior engineer',
      filters: { minExperienceYears: 8, maxExperienceYears: 3 },
    });
    expect(result.success).toBe(false);
  });

  it('requires a talentId or an inline profile', () => {
    expect(profileSummaryRequestSchema.safeParse({}).success).toBe(false);
    expect(
      profileSummaryRequestSchema.safeParse({ talentId: '507f1f77bcf86cd799439011' }).success,
    ).toBe(true);
  });

  it('accepts reviews for the suggestions endpoint', () => {
    const result = profileSuggestionsRequestSchema.safeParse({
      talentId: '507f1f77bcf86cd799439011',
      reviews: ['Improve measurable impact'],
    });
    expect(result.success).toBe(true);
  });
});

describe('talent profile event schema', () => {
  it('parses a minimal created payload with defaults', () => {
    const parsed = talentProfileEventSchema.parse({
      talentId: '507f1f77bcf86cd799439011',
      userId: 'user-1',
      name: 'Ada Lovelace',
      experienceYears: 6,
      level: 'LEVEL_2_MID',
      field: 'Software Engineering',
    });

    expect(parsed.skills).toEqual([]);
  });

  it('rejects an unknown level', () => {
    const result = talentProfileEventSchema.safeParse({
      talentId: '507f1f77bcf86cd799439011',
      userId: 'user-1',
      name: 'Ada Lovelace',
      experienceYears: 6,
      level: 'LEVEL_9',
      field: 'Software Engineering',
    });
    expect(result.success).toBe(false);
  });
});
