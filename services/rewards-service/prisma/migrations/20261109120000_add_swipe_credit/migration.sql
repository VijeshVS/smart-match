-- Accepting or rejecting a candidate now earns a TalentCredit. The value is
-- appended so existing ledger rows keep their meaning.
ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'CREDIT_SWIPE_DECISION' BEFORE 'CREDIT_REVIEW_FEEDBACK';
