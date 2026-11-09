-- Timestamp of the last qualification-changing profile update. It lets the
-- projection ignore late swipe/review events that belong to the previous
-- profile version after the candidate's counters have been reset.

ALTER TABLE "candidate_metrics"
    ADD COLUMN "qualifications_updated_at" TIMESTAMPTZ(3);
