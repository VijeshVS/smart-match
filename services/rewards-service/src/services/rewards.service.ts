import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '@talent-ai/logger';
import {
  TALENT_CREDIT_RULES,
  type CoinsAwardedPayload,
  type LedgerTransaction,
  type LedgerTransactionType,
  type Tier3UnlockedPayload,
  type UnlockTier3Response,
  type Wallet,
  type WalletSummary,
} from '@talent-ai/shared-types';
import type {
  LedgerTransaction as LedgerTransactionRow,
  Prisma,
  Wallet as WalletRow,
} from '../generated/prisma/client.js';
import {
  isGrantActive,
  resolveRecruiterId,
  toAccessGrant,
  toLedgerTransaction,
  toWallet,
} from '../domain/rewards.js';
import type { RewardsPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import { prisma } from '../lib/prisma.js';
import type { UnlockTier3Input } from '../validation/rewards.schemas.js';

/** Tier unlocked by the Level-3 access product. */
const TIER3 = 'LEVEL_3_LEAD' as const;

/** Maximum number of ledger rows returned with a wallet summary. */
const WALLET_HISTORY_LIMIT = 100;

/** Retries for optimistic-lock conflicts and unique-key races. */
const MAX_TRANSACTION_ATTEMPTS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Raised when `wallets.version` changed between the read and the write.
 * The whole transaction is retried so balance checks use fresh data.
 */
class OptimisticLockError extends Error {
  constructor() {
    super('Wallet was modified concurrently');
    this.name = 'OptimisticLockError';
  }
}

function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OptimisticLockError) return true;
  const code = prismaErrorCode(error);
  // P2002: unique race (wallet/grant creation or duplicate ledger credit).
  // P2034: serialization failure when the database escalates conflicts.
  return code === 'P2002' || code === 'P2034';
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
      lastError = error;
      logger.debug({ err: error, attempt: attempt + 1 }, 'retrying rewards transaction');
      // Jittered backoff keeps concurrent retries from colliding in lockstep.
      await sleep(Math.min(10 * 2 ** attempt, 250) + Math.floor(Math.random() * 25));
    }
  }

  throw lastError;
}

/**
 * Applies the one-time welcome bonus if it has not been recorded yet. Keyed on
 * the wallet id so a wallet is never welcomed twice, even if two transactions
 * observe the wallet before the ledger row commits.
 */
async function ensureWelcomeBonus(
  tx: Prisma.TransactionClient,
  wallet: WalletRow,
  correlationId?: string,
): Promise<WalletRow> {
  const existing = await tx.ledgerTransaction.findUnique({
    where: {
      type_referenceId: {
        type: 'CREDIT_WELCOME_BONUS',
        referenceId: wallet.id,
      },
    },
  });

  if (existing) return wallet;

  const bonus = TALENT_CREDIT_RULES.WELCOME_BONUS;
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: { increment: bonus },
      version: { increment: 1 },
    },
  });

  const ledger = await tx.ledgerTransaction.create({
    data: {
      walletId: wallet.id,
      amount: bonus,
      type: 'CREDIT_WELCOME_BONUS',
      referenceId: wallet.id,
      description: 'Welcome bonus',
      balanceAfter: updated.balance,
    },
  });

  const payload: CoinsAwardedPayload = {
    walletId: updated.id,
    recruiterId: updated.recruiterId,
    amount: bonus,
    type: 'CREDIT_WELCOME_BONUS',
    referenceId: updated.id,
    balanceAfter: updated.balance,
    timestamp: ledger.createdAt.toISOString(),
  };

  await enqueueOutbox(tx, {
    eventType: 'rewards.coins_awarded',
    aggregateId: ledger.id,
    correlationId,
    payload: { ...payload },
  });

  logger.info(
    { walletId: updated.id, recruiterId: updated.recruiterId, bonus, balance: updated.balance },
    'wallet created with welcome bonus',
  );

  return updated;
}

/**
 * Returns the recruiter's wallet, creating it on first use.
 *
 * `INSERT … ON CONFLICT DO NOTHING` makes concurrent first-use requests — for
 * example a burst of review events for the same recruiter — converge without a
 * unique-key exception. A losing insert waits for the winner to commit and then
 * observes the wallet plus its welcome bonus. Must run inside a transaction so
 * the wallet, bonus ledger row and bonus event commit atomically.
 */
async function ensureWallet(
  tx: Prisma.TransactionClient,
  recruiterId: string,
  correlationId?: string,
): Promise<WalletRow> {
  const existing = await tx.wallet.findUnique({ where: { recruiterId } });
  if (existing) return ensureWelcomeBonus(tx, existing, correlationId);

  const walletId = randomUUID();
  const inserted = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO wallets (id, recruiter_id, balance, version, created_at, updated_at)
    VALUES (${walletId}::uuid, ${recruiterId}::uuid, 0, 0, NOW(), NOW())
    ON CONFLICT (recruiter_id) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    // Another transaction won the insert and committed. Its welcome bonus was
    // written in the same transaction, so it is visible here.
    const raced = await tx.wallet.findUniqueOrThrow({ where: { recruiterId } });
    return ensureWelcomeBonus(tx, raced, correlationId);
  }

  const created = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
  return ensureWelcomeBonus(tx, created, correlationId);
}

interface CreditInput {
  recruiterId: string;
  amount: number;
  type: LedgerTransactionType;
  referenceId: string;
  description: string;
  correlationId?: string;
}

interface CreditResult {
  wallet: WalletRow;
  transaction: LedgerTransactionRow;
  credited: boolean;
}

/**
 * Applies an idempotent credit inside the caller's transaction. The unique
 * `(type, referenceId)` constraint is the idempotency key: a redelivered event
 * finds the existing ledger row and performs no second mutation.
 */
async function applyCredit(
  tx: Prisma.TransactionClient,
  input: CreditInput,
): Promise<CreditResult> {
  const wallet = await ensureWallet(tx, input.recruiterId, input.correlationId);

  const existing = await tx.ledgerTransaction.findUnique({
    where: {
      type_referenceId: {
        type: input.type,
        referenceId: input.referenceId,
      },
    },
  });

  if (existing) {
    return { wallet, transaction: existing, credited: false };
  }

  // Credits are atomic increments rather than version-predicated updates: an
  // increment never loses a concurrent write, and a burst of review events for
  // the same wallet therefore does not fight over `version`. Debits still use
  // optimistic locking because they must re-check the balance.
  const updatedRows = await tx.$queryRaw<Array<{ balance: number }>>`
    UPDATE wallets
    SET balance = balance + ${input.amount},
        version = version + 1,
        updated_at = NOW()
    WHERE id = ${wallet.id}::uuid
    RETURNING balance
  `;

  const updated = updatedRows[0];
  if (!updated) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'The recruiter wallet no longer exists');
  }

  const transaction = await tx.ledgerTransaction.create({
    data: {
      walletId: wallet.id,
      amount: input.amount,
      type: input.type,
      referenceId: input.referenceId,
      description: input.description,
      balanceAfter: updated.balance,
    },
  });

  const refreshed = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

  const payload: CoinsAwardedPayload = {
    walletId: refreshed.id,
    recruiterId: input.recruiterId,
    amount: input.amount,
    type: input.type,
    referenceId: input.referenceId,
    balanceAfter: updated.balance,
    timestamp: transaction.createdAt.toISOString(),
  };

  await enqueueOutbox(tx, {
    eventType: 'rewards.coins_awarded',
    aggregateId: transaction.id,
    correlationId: input.correlationId,
    payload: { ...payload },
  });

  return { wallet: refreshed, transaction, credited: true };
}

/** Current balance plus the most recent ledger entries. */
export async function getWalletSummary(
  requestedRecruiterId: string | undefined,
  principal: RewardsPrincipal,
): Promise<WalletSummary> {
  const recruiterId = resolveRecruiterId(requestedRecruiterId, principal);
  const correlationId = getCorrelationId() ?? undefined;

  const wallet = await withRetry(() =>
    prisma.$transaction((tx) => ensureWallet(tx, recruiterId, correlationId)),
  );

  const transactions = await prisma.ledgerTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: WALLET_HISTORY_LIMIT,
  });

  return {
    wallet: toWallet(wallet),
    transactions: transactions.map(toLedgerTransaction),
  };
}

/**
 * Unlocks a candidate's Level-3 profile for the recruiter.
 *
 * The debit, grant and outbox event commit in one PostgreSQL transaction, so a
 * failure at any step rolls everything back — that is the compensation path.
 * `wallets.version` provides optimistic locking, and the
 * `(recruiterId, talentId, tierUnlocked)` unique constraint makes concurrent
 * unlocks converge on a single grant without double charging.
 */
export async function unlockTier3(
  input: UnlockTier3Input,
  principal: RewardsPrincipal,
): Promise<UnlockTier3Response> {
  const recruiterId = resolveRecruiterId(input.recruiterId, principal);
  const correlationId = getCorrelationId() ?? undefined;
  const cost = TALENT_CREDIT_RULES.TIER3_UNLOCK_COST;

  const result = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx, recruiterId, correlationId);

      const existing = await tx.talentAccessGrant.findUnique({
        where: {
          recruiterId_talentId_tierUnlocked: {
            recruiterId,
            talentId: input.talentId,
            tierUnlocked: TIER3,
          },
        },
      });

      // Already unlocked: return the active grant without charging again.
      if (existing && isGrantActive(existing)) {
        return {
          grant: toAccessGrant(existing),
          wallet: toWallet(wallet),
          chargedCredits: 0,
        };
      }

      if (wallet.balance < cost) {
        throw new AppError(
          402,
          'INSUFFICIENT_CREDITS',
          `Unlocking this candidate requires ${cost} TalentCredits`,
          { details: { requiredCredits: cost, balance: wallet.balance } },
        );
      }

      const debitReference = randomUUID();
      const balanceAfter = wallet.balance - cost;

      // Optimistic debit: the version predicate guarantees no lost updates.
      const debited = await tx.wallet.updateMany({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balance: { decrement: cost },
          version: { increment: 1 },
        },
      });

      if (debited.count === 0) throw new OptimisticLockError();

      await tx.ledgerTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -cost,
          type: 'DEBIT_TIER3_UNLOCK',
          referenceId: debitReference,
          description: 'Unlocked Level-3 candidate profile',
          balanceAfter,
        },
      });

      const grant = existing
        ? await tx.talentAccessGrant.update({
            where: { id: existing.id },
            data: { expiresAt: null },
          })
        : await tx.talentAccessGrant.create({
            data: {
              recruiterId,
              talentId: input.talentId,
              tierUnlocked: TIER3,
              expiresAt: null,
            },
          });

      const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

      const payload: Tier3UnlockedPayload = {
        grantId: grant.id,
        recruiterId,
        talentId: grant.talentId,
        chargedCredits: cost,
        timestamp: grant.createdAt.toISOString(),
      };

      await enqueueOutbox(tx, {
        eventType: 'rewards.tier3_unlocked',
        aggregateId: grant.id,
        correlationId,
        payload: { ...payload },
      });

      return {
        grant: toAccessGrant(grant),
        wallet: toWallet(updatedWallet),
        chargedCredits: cost,
      };
    }),
  );

  logger.info(
    {
      grantId: result.grant.id,
      recruiterId,
      talentId: input.talentId,
      chargedCredits: result.chargedCredits,
      balance: result.wallet.balance,
    },
    result.chargedCredits === 0 ? 'tier3 grant reused' : 'tier3 access granted',
  );

  return result;
}

export interface ReviewCreditResult {
  credited: boolean;
  wallet: Wallet;
  transaction: LedgerTransaction;
}

/**
 * Credits the reviewer for actionable feedback. Called by the
 * `review.submitted` consumer; `reviewId` is the idempotency key, so at-least-
 * once delivery never double-credits.
 */
export async function creditReviewFeedback(input: {
  reviewId: string;
  recruiterId: string;
  correlationId?: string;
}): Promise<ReviewCreditResult> {
  const result = await withRetry(() =>
    prisma.$transaction(async (tx) => {
      return applyCredit(tx, {
        recruiterId: input.recruiterId,
        amount: TALENT_CREDIT_RULES.REVIEW_FEEDBACK_REWARD,
        type: 'CREDIT_REVIEW_FEEDBACK',
        referenceId: input.reviewId,
        description: 'Actionable review feedback reward',
        correlationId: input.correlationId,
      });
    }),
  );

  logger.info(
    {
      reviewId: input.reviewId,
      recruiterId: input.recruiterId,
      credited: result.credited,
      balance: result.wallet.balance,
    },
    result.credited ? 'review feedback credited' : 'review feedback already credited',
  );

  return {
    credited: result.credited,
    wallet: toWallet(result.wallet),
    transaction: toLedgerTransaction(result.transaction),
  };
}
