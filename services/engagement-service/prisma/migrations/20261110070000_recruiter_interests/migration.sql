-- Candidates a recruiter explicitly bookmarked from TalentLens. The unique key
-- makes mark/unmark idempotent and keeps the scoped pipeline duplicate-free.
CREATE TABLE "recruiter_interests" (
    "id" UUID NOT NULL,
    "recruiter_id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_interests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiter_interests_recruiter_id_talent_id_key"
    ON "recruiter_interests"("recruiter_id", "talent_id");

CREATE INDEX "recruiter_interests_recruiter_id_created_at_idx"
    ON "recruiter_interests"("recruiter_id", "created_at");
