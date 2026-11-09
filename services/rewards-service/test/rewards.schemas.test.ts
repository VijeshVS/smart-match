import { describe, expect, it } from 'vitest';
import {
  reviewSubmittedPayloadSchema,
  swipeRecordedPayloadSchema,
  talentLensQuerySchema,
  unlockTier3Schema,
  walletQuerySchema,
} from '../src/validation/rewards.schemas.js';

const recruiterId = '11111111-1111-4111-8111-111111111111';
const talentId = '99999999-9999-4999-8999-999999999999';
const reviewId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const swipeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('rewards validation', () => {
  it('parses an unlock request and keeps recruiterId optional', () => {
    expect(unlockTier3Schema.parse({ talentId })).toEqual({ talentId });
    expect(unlockTier3Schema.parse({ talentId, recruiterId })).toEqual({
      talentId,
      recruiterId,
    });
  });

  it('rejects malformed unlock identifiers', () => {
    expect(() => unlockTier3Schema.parse({ talentId: 'talent-1' })).toThrow();
    expect(() => unlockTier3Schema.parse({ talentId, recruiterId: 'acme' })).toThrow();
    expect(() => unlockTier3Schema.parse({})).toThrow();
  });

  it('validates the optional wallet query', () => {
    expect(walletQuerySchema.parse({})).toEqual({});
    expect(walletQuerySchema.parse({ recruiterId })).toEqual({ recruiterId });
    expect(() => walletQuerySchema.parse({ recruiterId: 'not-a-uuid' })).toThrow();
  });

  it('validates the TalentLens query idempotency key', () => {
    expect(talentLensQuerySchema.parse({ queryId: reviewId })).toEqual({ queryId: reviewId });
    expect(() => talentLensQuerySchema.parse({ queryId: 'query-1' })).toThrow();
    expect(() => talentLensQuerySchema.parse({})).toThrow();
  });

  it('validates the swipe.recorded payload', () => {
    const payload = {
      swipeId,
      recruiterId,
      talentId,
      decision: 'APPROVE',
    };

    expect(swipeRecordedPayloadSchema.parse(payload)).toEqual(payload);
    expect(swipeRecordedPayloadSchema.parse({ ...payload, decision: 'DEFER' })).toEqual({
      ...payload,
      decision: 'DEFER',
    });
    expect(() => swipeRecordedPayloadSchema.parse({ ...payload, decision: 'MAYBE' })).toThrow();
    expect(() => swipeRecordedPayloadSchema.parse({ ...payload, swipeId: 'swipe-1' })).toThrow();
    expect(() => swipeRecordedPayloadSchema.parse({ recruiterId, talentId })).toThrow();
  });

  it('validates the review.submitted payload', () => {
    const payload = {
      reviewId,
      recruiterId,
      talentId,
      hasActionableFeedback: true,
    };

    expect(reviewSubmittedPayloadSchema.parse(payload)).toEqual(payload);
    expect(() =>
      reviewSubmittedPayloadSchema.parse({ ...payload, hasActionableFeedback: 'yes' }),
    ).toThrow();
    expect(() =>
      reviewSubmittedPayloadSchema.parse({ ...payload, reviewId: 'review-1' }),
    ).toThrow();
    expect(() => reviewSubmittedPayloadSchema.parse({ recruiterId, talentId })).toThrow();
  });
});
