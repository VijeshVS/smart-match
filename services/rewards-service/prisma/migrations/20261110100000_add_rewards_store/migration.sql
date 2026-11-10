ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'DEBIT_REWARD_REDEMPTION';
CREATE TYPE "RewardCategory" AS ENUM ('FOOD', 'SHOPPING', 'TRAVEL', 'ENTERTAINMENT');

CREATE TABLE "partner_brands" (
  "id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "logo_url" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_brands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_brands_name_key" ON "partner_brands"("name");

CREATE TABLE "rewards" (
  "id" UUID NOT NULL,
  "brand_id" UUID NOT NULL,
  "category" "RewardCategory" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "discount" VARCHAR(120) NOT NULL,
  "cost" INTEGER NOT NULL,
  "terms" TEXT[] NOT NULL,
  "expires_at" TIMESTAMPTZ(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rewards_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "partner_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "rewards_category_active_idx" ON "rewards"("category", "active");

CREATE TABLE "voucher_codes" (
  "id" UUID NOT NULL,
  "reward_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "claimed_at" TIMESTAMPTZ(3),
  CONSTRAINT "voucher_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voucher_codes_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "voucher_codes_code_key" ON "voucher_codes"("code");
CREATE INDEX "voucher_codes_reward_id_claimed_at_idx" ON "voucher_codes"("reward_id", "claimed_at");

CREATE TABLE "reward_redemptions" (
  "id" UUID NOT NULL,
  "recruiter_id" UUID NOT NULL,
  "reward_id" UUID NOT NULL,
  "voucher_id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "redeemed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3),
  CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reward_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "reward_redemptions_voucher_id_key" ON "reward_redemptions"("voucher_id");
CREATE UNIQUE INDEX "reward_redemptions_request_id_key" ON "reward_redemptions"("request_id");
CREATE INDEX "reward_redemptions_recruiter_id_redeemed_at_idx" ON "reward_redemptions"("recruiter_id", "redeemed_at");

INSERT INTO "partner_brands" ("id", "name") VALUES
  ('10000000-0000-4000-8000-000000000001', 'Swiggy'),
  ('10000000-0000-4000-8000-000000000002', 'Nike'),
  ('10000000-0000-4000-8000-000000000003', 'MakeMyTrip')
ON CONFLICT ("name") DO NOTHING;
INSERT INTO "rewards" ("id", "brand_id", "category", "title", "description", "discount", "cost", "terms") VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'FOOD', 'Food delivery voucher', 'Enjoy your next meal on us.', '₹150 off on orders above ₹499', 25, ARRAY['One use per account', 'Valid on selected restaurants']),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'SHOPPING', 'Move with confidence', 'A little something for your next workout.', '₹500 off on orders above ₹2,500', 75, ARRAY['Valid on selected products', 'Cannot be combined']),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'TRAVEL', 'Plan your next escape', 'Save on a future hotel or flight booking.', '10% off up to ₹1,000', 100, ARRAY['Valid on selected bookings', 'Blackout dates may apply'])
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "voucher_codes" ("id", "reward_id", "code") VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'TALENT-SWIGGY-150'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'TALENT-NIKE-500'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'TALENT-TRAVEL-10')
ON CONFLICT ("code") DO NOTHING;
