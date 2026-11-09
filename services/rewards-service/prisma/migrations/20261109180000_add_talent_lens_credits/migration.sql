-- TalentLens searches now cost TalentCredits. A debit is written for every
-- successful search; the matching credit reverses a debit when the AI search
-- fails after the charge has committed.
ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'CREDIT_TALENT_LENS_REFUND' BEFORE 'DEBIT_TIER3_UNLOCK';
ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'DEBIT_TALENT_LENS_QUERY' BEFORE 'ADJUSTMENT';
