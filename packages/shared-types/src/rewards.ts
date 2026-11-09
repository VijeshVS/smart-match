import type { ISODateString, UUID } from './common.js';
import type { TalentLevel } from './talent.js';

export const LEDGER_TRANSACTION_TYPES = [
  'CREDIT_SWIPE_DECISION',
  'CREDIT_REVIEW_FEEDBACK',
  'CREDIT_PURCHASE',
  'CREDIT_WELCOME_BONUS',
  'DEBIT_TIER3_UNLOCK',
  'ADJUSTMENT',
] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

export interface Wallet {
  id: UUID;
  recruiterId: UUID;
  /** TalentCredits (TC). */
  balance: number;
  /** Optimistic concurrency version. */
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface LedgerTransaction {
  id: UUID;
  walletId: UUID;
  amount: number;
  type: LedgerTransactionType;
  referenceId?: string;
  description?: string;
  balanceAfter: number;
  createdAt: ISODateString;
}

export interface TalentAccessGrant {
  id: UUID;
  recruiterId: UUID;
  talentId: UUID;
  tierUnlocked: TalentLevel;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
}

export interface WalletSummary {
  wallet: Wallet;
  transactions: LedgerTransaction[];
}

export interface UnlockTier3Request {
  recruiterId?: UUID;
  talentId: UUID;
}

export interface UnlockTier3Response {
  grant: TalentAccessGrant;
  wallet: Wallet;
  chargedCredits: number;
}

/** Business rules for the TalentCredits economy. */
export const TALENT_CREDIT_RULES = {
  /** Accepting or rejecting a candidate earns this once per swipe. */
  SWIPE_DECISION_REWARD: 1,
  /** Submitting candidate feedback earns this once per review. */
  REVIEW_FEEDBACK_REWARD: 5,
  TIER3_UNLOCK_COST: 50,
  WELCOME_BONUS: 20,
} as const;

export interface CoinsAwardedPayload {
  walletId: UUID;
  recruiterId: UUID;
  amount: number;
  type: LedgerTransactionType;
  referenceId?: string;
  balanceAfter: number;
  timestamp: ISODateString;
}

export interface Tier3UnlockedPayload {
  grantId: UUID;
  recruiterId: UUID;
  talentId: UUID;
  chargedCredits: number;
  expiresAt?: ISODateString;
  timestamp: ISODateString;
}
