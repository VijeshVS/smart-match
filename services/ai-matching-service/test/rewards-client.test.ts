import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiPrincipal } from '../src/middleware/auth.js';

const { chargeTalentLensQuery, refundTalentLensQuery } =
  await import('../src/lib/rewards-client.js');

const principal: AiPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'riley@acme.com',
  role: 'RECRUITER',
  permissions: [],
};

const queryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const wallet = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  recruiterId: principal.userId,
  balance: 25,
  version: 4,
  createdAt: '2026-11-09T10:00:00.000Z',
  updatedAt: '2026-11-09T10:05:00.000Z',
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TalentLens rewards client', () => {
  it('charges the query and forwards the caller identity', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { wallet, charged: true, chargedCredits: 15, transaction: null } }),
    );

    const result = await chargeTalentLensQuery(principal, queryId, 'Bearer access-token');

    expect(result).toEqual({ wallet, charged: true, chargedCredits: 15 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/rewards/talent-lens/charge');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ queryId });

    const headers = init.headers as Record<string, string>;
    expect(headers['x-user-id']).toBe(principal.userId);
    expect(headers['x-user-email']).toBe(principal.email);
    expect(headers['x-user-role']).toBe(principal.role);
    expect(headers.authorization).toBe('Bearer access-token');
  });

  it('maps a 402 response to INSUFFICIENT_CREDITS', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          status: 402,
          error: {
            code: 'INSUFFICIENT_CREDITS',
            message: 'A TalentLens search requires 15 TalentCredits',
            details: { requiredCredits: 15, balance: 10 },
          },
        },
        402,
      ),
    );

    await expect(chargeTalentLensQuery(principal, queryId)).rejects.toMatchObject({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      details: { requiredCredits: 15, balance: 10 },
    });
  });

  it('fails closed when rewards-service is unavailable', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 503, error: { code: 'UNAVAILABLE' } }, 503));

    await expect(chargeTalentLensQuery(principal, queryId)).rejects.toMatchObject({
      status: 503,
      code: 'REWARDS_UNAVAILABLE',
    });
  });

  it('fails closed when the rewards request cannot be made', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(chargeTalentLensQuery(principal, queryId)).rejects.toMatchObject({
      status: 503,
      code: 'REWARDS_UNAVAILABLE',
    });
  });

  it('posts a refund for the same query id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { wallet, refunded: true, refundedCredits: 15 } }),
    );

    await expect(refundTalentLensQuery(principal, queryId)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/rewards/talent-lens/refund');
    expect(JSON.parse(String(init.body))).toEqual({ queryId });
  });
});
