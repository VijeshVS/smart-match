-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SwipeDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "swipes" (
    "id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "decision" "SwipeDecision" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "swipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "swipe_id" UUID,
    "recruiter_id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "decision" "SwipeDecision" NOT NULL,
    "rating" INTEGER,
    "feedback_text" TEXT,
    "actionable_advice" TEXT,
    "has_actionable_feedback" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "swipes_talent_id_decision_idx" ON "swipes"("talent_id", "decision");

-- CreateIndex
CREATE INDEX "swipes_recruiter_id_created_at_idx" ON "swipes"("recruiter_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "swipes_recruiter_id_talent_id_key" ON "swipes"("recruiter_id", "talent_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_swipe_id_key" ON "reviews"("swipe_id");

-- CreateIndex
CREATE INDEX "reviews_talent_id_created_at_idx" ON "reviews"("talent_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_recruiter_id_created_at_idx" ON "reviews"("recruiter_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_swipe_id_fkey" FOREIGN KEY ("swipe_id") REFERENCES "swipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

