import { describe, expect, it } from 'vitest';
import {
  createRecruiterInterestSchema,
  createReviewSchema,
  createSwipeSchema,
  recruiterIdParamSchema,
  talentIdParamSchema,
} from '../src/validation/engagement.schemas.js';

const talentId = '99999999-9999-4999-8999-999999999999';
const recruiterId = '11111111-1111-4111-8111-111111111111';
const swipeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('engagement validation', () => {
  it('parses a swipe and defaults the recruiter id to absent', () => {
    const parsed = createSwipeSchema.parse({ talentId, decision: 'APPROVE' });

    expect(parsed).toEqual({ talentId, decision: 'APPROVE' });
  });

  it('rejects invalid swipe decisions and identifiers', () => {
    expect(() => createSwipeSchema.parse({ talentId, decision: 'MAYBE' })).toThrow();
    expect(() => createSwipeSchema.parse({ talentId: 'talent-1', decision: 'APPROVE' })).toThrow();
    expect(() =>
      createSwipeSchema.parse({ talentId, decision: 'APPROVE', recruiterId: 'acme' }),
    ).toThrow();
  });

  it('requires at least one review content field', () => {
    expect(() => createReviewSchema.parse({ talentId, decision: 'APPROVE', swipeId })).toThrow(
      /rating, feedback text or actionable advice/,
    );
  });

  it('coerces ratings and trims feedback', () => {
    const parsed = createReviewSchema.parse({
      talentId,
      decision: 'REJECT',
      rating: '4',
      feedbackText: '  Good communication.  ',
      actionableAdvice: '   ',
    });

    expect(parsed.rating).toBe(4);
    expect(parsed.feedbackText).toBe('Good communication.');
    expect(parsed.actionableAdvice).toBeUndefined();
  });

  it('rejects out-of-range ratings', () => {
    expect(() =>
      createReviewSchema.parse({
        talentId,
        decision: 'APPROVE',
        rating: 6,
      }),
    ).toThrow();
    expect(() =>
      createReviewSchema.parse({
        talentId,
        decision: 'APPROVE',
        rating: 0,
      }),
    ).toThrow();
  });

  it('validates recruiter interest payloads', () => {
    expect(createRecruiterInterestSchema.parse({ talentId })).toEqual({ talentId });
    expect(createRecruiterInterestSchema.parse({ talentId, recruiterId })).toEqual({
      talentId,
      recruiterId,
    });
    expect(() => createRecruiterInterestSchema.parse({ talentId: 'nope' })).toThrow();
    expect(() => createRecruiterInterestSchema.parse({ talentId, recruiterId: 'acme' })).toThrow();
  });

  it('validates path identifiers', () => {
    expect(talentIdParamSchema.parse({ talentId })).toEqual({ talentId });
    expect(recruiterIdParamSchema.parse({ recruiterId })).toEqual({ recruiterId });
    expect(() => talentIdParamSchema.parse({ talentId: 'nope' })).toThrow();
    expect(() => recruiterIdParamSchema.parse({ recruiterId: 'nope' })).toThrow();
  });
});
