-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('CREDIT_REVIEW_FEEDBACK', 'CREDIT_PURCHASE', 'CREDIT_WELCOME_BONUS', 'DEBIT_TIER3_UNLOCK', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TalentLevel" AS ENUM ('LEVEL_1_ENTRY', 'LEVEL_2_MID', 'LEVEL_3_LEAD');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "reference_id" VARCHAR(120),
    "description" VARCHAR(255),
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_access_grants" (
    "id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "tier_unlocked" "TalentLevel" NOT NULL DEFAULT 'LEVEL_3_LEAD',
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_id" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" VARCHAR(120),
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_recruiter_id_key" ON "wallets"("recruiter_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_wallet_id_created_at_idx" ON "ledger_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_type_reference_id_key" ON "ledger_transactions"("type", "reference_id");

-- CreateIndex
CREATE INDEX "talent_access_grants_recruiter_id_created_at_idx" ON "talent_access_grants"("recruiter_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "talent_access_grants_recruiter_id_talent_id_tier_unlocked_key" ON "talent_access_grants"("recruiter_id", "talent_id", "tier_unlocked");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
