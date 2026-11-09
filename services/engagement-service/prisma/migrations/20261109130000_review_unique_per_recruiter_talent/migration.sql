-- A recruiter may review a candidate only once. Existing duplicate rows are
-- collapsed to the earliest review so the unique index can be applied safely.
DELETE FROM "reviews" a
USING "reviews" b
WHERE a."recruiter_id" = b."recruiter_id"
  AND a."talent_id" = b."talent_id"
  AND (
    a."created_at" > b."created_at"
    OR (a."created_at" = b."created_at" AND a."id" > b."id")
  );

CREATE UNIQUE INDEX "reviews_recruiter_id_talent_id_key"
  ON "reviews"("recruiter_id", "talent_id");
