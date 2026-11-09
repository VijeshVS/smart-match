import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiPrincipal } from '../src/middleware/auth.js';

const mocks = vi.hoisted(() => ({
  chargeTalentLensQuery: vi.fn(),
  refundTalentLensQuery: vi.fn(),
  qdrantSearch: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../src/lib/rewards-client.js', () => ({
  chargeTalentLensQuery: mocks.chargeTalentLensQuery,
  refundTalentLensQuery: mocks.refundTalentLensQuery,
}));

vi.mock('../src/lib/qdrant.js', () => ({
  qdrant: { search: mocks.qdrantSearch },
}));

vi.mock('../src/services/cache.js', () => ({
  cacheKey: () => 'talent-lens:test-key',
  responseCache: { get: mocks.cacheGet, set: mocks.cacheSet },
}));

vi.mock('../src/lib/event-bus.js', () => ({
  eventBus: { publish: mocks.publish },
}));

vi.mock('../src/ai/llm.js', () => ({
  llm: {
    provider: 'local',
    generateJson: async <T>(options: { fallback: () => T }) => ({
      value: options.fallback(),
      fallback: true,
    }),
  },
}));

const { talentLens } = await import('../src/services/talent-lens.service.js');

const principal: AiPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'riley@acme.com',
  role: 'RECRUITER',
  permissions: [],
};

const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const authorization = 'Bearer access-token';

const wallet = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  recruiterId: principal.userId,
  balance: 25,
  version: 4,
  createdAt: '2026-11-09T10:00:00.000Z',
  updatedAt: '2026-11-09T10:05:00.000Z',
};

const input = {
  query: 'senior react engineers',
  limit: 5,
  requestId,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cacheGet.mockResolvedValue(undefined);
  mocks.cacheSet.mockResolvedValue(undefined);
  mocks.publish.mockResolvedValue(undefined);
  mocks.qdrantSearch.mockResolvedValue([]);
  mocks.chargeTalentLensQuery.mockResolvedValue({
    wallet,
    charged: true,
    chargedCredits: 15,
  });
  mocks.refundTalentLensQuery.mockResolvedValue(undefined);
});

describe('talentLens credit orchestration', () => {
  it('charges before searching and returns the updated wallet', async () => {
    const result = await talentLens(input, principal, authorization);

    expect(mocks.chargeTalentLensQuery).toHaveBeenCalledTimes(1);
    expect(mocks.chargeTalentLensQuery).toHaveBeenCalledWith(principal, requestId, authorization);
    expect(mocks.qdrantSearch).toHaveBeenCalledTimes(1);
    expect(mocks.refundTalentLensQuery).not.toHaveBeenCalled();
    expect(result.chargedCredits).toBe(15);
    expect(result.wallet).toEqual(wallet);
  });

  it('charges cached searches too because every query costs credits', async () => {
    mocks.cacheGet.mockResolvedValue({
      query: input.query,
      results: [],
      cached: false,
      provider: 'local',
      fallback: false,
    });

    const result = await talentLens(input, principal, authorization);

    expect(mocks.chargeTalentLensQuery).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(true);
    expect(result.chargedCredits).toBe(15);
  });

  it('refunds the charge when the search fails after a debit', async () => {
    mocks.qdrantSearch.mockRejectedValue(new Error('qdrant down'));

    await expect(talentLens(input, principal, authorization)).rejects.toMatchObject({
      status: 503,
      code: 'VECTOR_STORE_UNAVAILABLE',
    });

    expect(mocks.chargeTalentLensQuery).toHaveBeenCalledTimes(1);
    expect(mocks.refundTalentLensQuery).toHaveBeenCalledTimes(1);
    expect(mocks.refundTalentLensQuery).toHaveBeenCalledWith(principal, requestId, authorization);
  });

  it('does not refund when an idempotent retry did not debit again', async () => {
    mocks.chargeTalentLensQuery.mockResolvedValue({
      wallet,
      charged: false,
      chargedCredits: 0,
    });
    mocks.qdrantSearch.mockRejectedValue(new Error('qdrant down'));

    await expect(talentLens(input, principal, authorization)).rejects.toMatchObject({
      status: 503,
    });

    expect(mocks.refundTalentLensQuery).not.toHaveBeenCalled();
  });

  it('does not search when the charge fails', async () => {
    mocks.chargeTalentLensQuery.mockRejectedValue(
      Object.assign(new Error('insufficient credits'), {
        status: 402,
        code: 'INSUFFICIENT_CREDITS',
      }),
    );

    await expect(talentLens(input, principal, authorization)).rejects.toMatchObject({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
    });

    expect(mocks.qdrantSearch).not.toHaveBeenCalled();
    expect(mocks.refundTalentLensQuery).toHaveBeenCalledTimes(1);
  });
});
