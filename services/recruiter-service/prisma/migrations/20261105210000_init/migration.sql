-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "domain" VARCHAR(255),
    "website" VARCHAR(500),
    "logo_url" VARCHAR(500),
    "industry" VARCHAR(120),
    "size" VARCHAR(60),
    "billing_email" VARCHAR(254),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "title" VARCHAR(120),
    "phone" VARCHAR(32),
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "location" VARCHAR(200),
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_experience_years" INTEGER,
    "max_experience_years" INTEGER,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_profiles_user_id_key" ON "recruiter_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_profiles_email_key" ON "recruiter_profiles"("email");

-- CreateIndex
CREATE INDEX "recruiter_profiles_organization_id_idx" ON "recruiter_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "recruiter_profiles_email_idx" ON "recruiter_profiles"("email");

-- CreateIndex
CREATE INDEX "job_postings_organization_id_status_idx" ON "job_postings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "job_postings_recruiter_id_created_at_idx" ON "job_postings"("recruiter_id", "created_at");

-- CreateIndex
CREATE INDEX "job_postings_status_created_at_idx" ON "job_postings"("status", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "recruiter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

