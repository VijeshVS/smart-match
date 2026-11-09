import { describe, expect, it } from 'vitest';
import {
  assertRecruiterAccess,
  isGrantActive,
  isRewardingSwipeDecision,
  permissionsForRole,
  resolveRecruiterId,
  toAccessGrant,
  toLedgerTransaction,
  toWallet,
} from '../src/domain/rewards.js';
import type { RewardsPrincipal } from '../src/middleware/auth.js';

const recruiter: RewardsPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'riley@acme.com',
  role: 'RECRUITER',
  permissions: [],
};

const otherRecruiter: RewardsPrincipal = {
  ...recruiter,
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'sam@acme.com',
};

const admin: RewardsPrincipal = {
  ...recruiter,
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'admin@talent.ai',
  role: 'ADMIN',
};

const now = new Date('2026-11-05T00:00:00.000Z');

describe('rewards domain', () => {
  it('grants rewards permissions by role', () => {
    expect(permissionsForRole('RECRUITER')).toContain('rewards:read');
    expect(permissionsForRole('RECRUITER')).toContain('rewards:spend');
    expect(permissionsForRole('CANDIDATE')).toEqual(['talent:read', 'talent:write']);
    expect(permissionsForRole('ADMIN')).toContain('rewards:spend');
  });

  it('defaults the wallet owner to the caller and blocks impersonation', () => {
    expect(resolveRecruiterId(undefined, recruiter)).toBe(recruiter.userId);
    expect(resolveRecruiterId(recruiter.userId, recruiter)).toBe(recruiter.userId);
    expect(resolveRecruiterId(otherRecruiter.userId, admin)).toBe(otherRecruiter.userId);

    expect(() => resolveRecruiterId(otherRecruiter.userId, recruiter)).toThrow(
      /own TalentCredits wallet/,
    );
  });

  it('guards wallet access to the owner or an admin', () => {
    expect(() => assertRecruiterAccess(recruiter, recruiter.userId)).not.toThrow();
    expect(() => assertRecruiterAccess(admin, otherRecruiter.userId)).not.toThrow();
    expect(() => assertRecruiterAccess(otherRecruiter, recruiter.userId)).toThrow(
      /access to this wallet/,
    );
  });

  it('maps wallet rows to the shared contract', () => {
    const wallet = toWallet({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recruiterId: recruiter.userId,
      balance: 20,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    expect(wallet).toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recruiterId: recruiter.userId,
      balance: 20,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it('maps ledger rows and omits empty optional fields', () => {
    const entry = toLedgerTransaction({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      walletId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      amount: 5,
      type: 'CREDIT_REVIEW_FEEDBACK',
      referenceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      description: null,
      balanceAfter: 25,
      createdAt: now,
    });

    expect(entry).toMatchObject({
      amount: 5,
      type: 'CREDIT_REVIEW_FEEDBACK',
      balanceAfter: 25,
    });
    expect(entry.referenceId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(entry.description).toBeUndefined();
  });

  it('rewards only terminal swipe decisions', () => {
    expect(isRewardingSwipeDecision('APPROVE')).toBe(true);
    expect(isRewardingSwipeDecision('REJECT')).toBe(true);
    expect(isRewardingSwipeDecision('DEFER')).toBe(false);
  });

  it('maps access grants and treats a missing expiry as active', () => {
    const grantRow = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      recruiterId: recruiter.userId,
      talentId: '99999999-9999-4999-8999-999999999999',
      tierUnlocked: 'LEVEL_3_LEAD' as const,
      expiresAt: null,
      createdAt: now,
    };

    expect(isGrantActive(grantRow, now)).toBe(true);
    expect(isGrantActive({ expiresAt: new Date('2026-11-04T00:00:00.000Z') }, now)).toBe(false);
    expect(isGrantActive({ expiresAt: new Date('2026-11-06T00:00:00.000Z') }, now)).toBe(true);

    const grant = toAccessGrant(grantRow);

    expect(grant).toMatchObject({
      id: grantRow.id,
      tierUnlocked: 'LEVEL_3_LEAD',
      createdAt: now.toISOString(),
    });
    expect(grant.expiresAt).toBeUndefined();
  });
});
