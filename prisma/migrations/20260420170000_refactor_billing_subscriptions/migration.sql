ALTER TABLE "users"
DROP COLUMN IF EXISTS "subscription_status",
DROP COLUMN IF EXISTS "subscription_plan",
DROP COLUMN IF EXISTS "subscription_current_period_end",
DROP COLUMN IF EXISTS "subscription_cancel_at",
DROP COLUMN IF EXISTS "dodo_customer_id",
DROP COLUMN IF EXISTS "subscription_id";

CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DODO',
  "provider_customer_id" TEXT,
  "provider_subscription_id" TEXT NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'PRO',
  "plan" TEXT,
  "status" TEXT NOT NULL,
  "current_period_end" TIMESTAMP(3),
  "cancel_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_provider_subscription_id_key"
ON "billing_subscriptions"("provider_subscription_id");

CREATE INDEX IF NOT EXISTS "billing_subscriptions_user_id_status_idx"
ON "billing_subscriptions"("user_id", "status");

CREATE INDEX IF NOT EXISTS "billing_subscriptions_provider_customer_id_idx"
ON "billing_subscriptions"("provider_customer_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE "billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;