import {
  PERMISSIONS,
  type LedgerTransaction,
  type Permission,
  type SwipeDecision,
  type TalentAccessGrant,
  type TalentLevel,
  type UserRole,
  type Wallet,
} from '@talent-ai/shared-types';
import type {
  LedgerTransaction as LedgerTransactionRow,
  TalentAccessGrant as TalentAccessGrantRow,
  Wallet as WalletRow,
} from '../generated/prisma/client.js';
import type { RewardsPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

/**
 * Authoritative role → permission grants. Mirrors the auth-service table so a
 * directly verified bearer token carries the same capabilities as one that
 * passed through the gateway.
 */
const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  CANDIDATE: ['talent:read', 'talent:write'],
  RECRUITER: [
    'talent:read',
    'talent:unlock',
    'recruiter:read',
    'recruiter:write',
    'engagement:swipe',
    'engagement:review',
    'rewards:read',
    'rewards:spend',
    'analytics:read',
  ],
  ADMIN: [...PERMISSIONS],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Resolves the recruiter whose wallet is being read or spent. Recruiters may
 * only act as themselves; administrators may act on behalf of another
 * recruiter when they explicitly supply the id.
 */
export function resolveRecruiterId(
  requestedRecruiterId: string | undefined,
  principal: RewardsPrincipal,
): string {
  if (!requestedRecruiterId) return principal.userId;
  if (requestedRecruiterId === principal.userId) return requestedRecruiterId;
  if (principal.role === 'ADMIN') return requestedRecruiterId;

  throw new AppError(
    403,
    'RECRUITER_ID_MISMATCH',
    'You may only access your own TalentCredits wallet',
  );
}

/** Guards recruiter-scoped reads to the owner or an administrator. */
export function assertRecruiterAccess(principal: RewardsPrincipal, recruiterId: string): void {
  if (principal.role === 'ADMIN') return;
  if (principal.userId === recruiterId) return;

  throw new AppError(403, 'FORBIDDEN', 'You do not have access to this wallet');
}

export function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    recruiterId: row.recruiterId,
    balance: row.balance,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLedgerTransaction(row: LedgerTransactionRow): LedgerTransaction {
  return {
    id: row.id,
    walletId: row.walletId,
    amount: row.amount,
    type: row.type as LedgerTransaction['type'],
    ...(row.referenceId ? { referenceId: row.referenceId } : {}),
    ...(row.description ? { description: row.description } : {}),
    balanceAfter: row.balanceAfter,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAccessGrant(row: TalentAccessGrantRow): TalentAccessGrant {
  return {
    id: row.id,
    recruiterId: row.recruiterId,
    talentId: row.talentId,
    tierUnlocked: row.tierUnlocked as TalentLevel,
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * A grant is active when it has no expiry or its expiry is still in the future.
 */
export function isGrantActive(
  grant: Pick<TalentAccessGrantRow, 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

/**
 * Only a terminal accept/reject decision earns the swipe reward. Deferring
 * keeps the candidate in the pipeline and is intentionally unrewarded.
 */
export function isRewardingSwipeDecision(decision: SwipeDecision): boolean {
  return decision === 'APPROVE' || decision === 'REJECT';
}
