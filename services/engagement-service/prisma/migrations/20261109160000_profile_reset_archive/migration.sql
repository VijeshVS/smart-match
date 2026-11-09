-- Archive the active engagement rows before a qualification update resets them.
-- `event_id` is unique so at-least-once delivery cannot apply the same reset
-- twice, and the JSON snapshots keep the previous history queryable for audit.

CREATE TABLE "profile_reset_archives" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(120) NOT NULL,
    "talent_id" UUID NOT NULL,
    "reset_at" TIMESTAMPTZ(3) NOT NULL,
    "swipes" JSONB NOT NULL,
    "reviews" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_reset_archives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_reset_archives_event_id_key"
    ON "profile_reset_archives"("event_id");

CREATE INDEX "profile_reset_archives_talent_id_reset_at_idx"
    ON "profile_reset_archives"("talent_id", "reset_at");
