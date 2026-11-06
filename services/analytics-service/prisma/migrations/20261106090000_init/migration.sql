-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "candidate_metrics" (
    "talent_id" UUID NOT NULL,
    "user_id" UUID,
    "right_swipes" INTEGER NOT NULL DEFAULT 0,
    "left_swipes" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "profile_created_at" TIMESTAMPTZ(3),
    "first_approved_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidate_metrics_pkey" PRIMARY KEY ("talent_id")
);

-- CreateTable
CREATE TABLE "recruiter_identities" (
    "profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiter_identities_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "recruiter_metrics" (
    "recruiter_id" UUID NOT NULL,
    "organization_id" UUID,
    "open_jobs" INTEGER NOT NULL DEFAULT 0,
    "reviews_submitted" INTEGER NOT NULL DEFAULT 0,
    "actionable_feedback_count" INTEGER NOT NULL DEFAULT 0,
    "credits_earned" INTEGER NOT NULL DEFAULT 0,
    "approvals" INTEGER NOT NULL DEFAULT 0,
    "rejections" INTEGER NOT NULL DEFAULT 0,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "match_delay_ms_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiter_metrics_pkey" PRIMARY KEY ("recruiter_id")
);

-- CreateTable
CREATE TABLE "skill_metrics" (
    "skill" VARCHAR(80) NOT NULL,
    "demand_count" INTEGER NOT NULL DEFAULT 0,
    "supply_count" INTEGER NOT NULL DEFAULT 0,
    "experience_sum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "experience_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skill_metrics_pkey" PRIMARY KEY ("skill")
);

-- CreateTable
CREATE TABLE "recruiter_skill_demands" (
    "recruiter_id" UUID NOT NULL,
    "skill" VARCHAR(80) NOT NULL,
    "job_count" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiter_skill_demands_pkey" PRIMARY KEY ("recruiter_id","skill")
);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "talent_id" UUID NOT NULL,
    "skill" VARCHAR(80) NOT NULL,
    "experience_years" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("talent_id","skill")
);

-- CreateTable
CREATE TABLE "funnel_aggregates" (
    "day" DATE NOT NULL,
    "profiles_created" INTEGER NOT NULL DEFAULT 0,
    "swipes_recorded" INTEGER NOT NULL DEFAULT 0,
    "reviews_submitted" INTEGER NOT NULL DEFAULT 0,
    "tier3_unlocks" INTEGER NOT NULL DEFAULT 0,
    "approvals" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "funnel_aggregates_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "candidate_metrics_user_id_idx" ON "candidate_metrics"("user_id");

-- CreateIndex
CREATE INDEX "candidate_metrics_first_approved_at_idx" ON "candidate_metrics"("first_approved_at");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_identities_user_id_key" ON "recruiter_identities"("user_id");

-- CreateIndex
CREATE INDEX "recruiter_metrics_actionable_feedback_count_idx" ON "recruiter_metrics"("actionable_feedback_count");

-- CreateIndex
CREATE INDEX "recruiter_metrics_credits_earned_idx" ON "recruiter_metrics"("credits_earned");

-- CreateIndex
CREATE INDEX "skill_metrics_demand_count_idx" ON "skill_metrics"("demand_count");

-- CreateIndex
CREATE INDEX "skill_metrics_supply_count_idx" ON "skill_metrics"("supply_count");

-- CreateIndex
CREATE INDEX "recruiter_skill_demands_recruiter_id_job_count_idx" ON "recruiter_skill_demands"("recruiter_id", "job_count");

-- CreateIndex
CREATE INDEX "candidate_skills_skill_idx" ON "candidate_skills"("skill");

-- CreateIndex
CREATE INDEX "processed_events_processed_at_idx" ON "processed_events"("processed_at");

