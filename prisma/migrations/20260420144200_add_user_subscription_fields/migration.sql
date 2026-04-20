-- Add subscription and billing fields expected by the Prisma User model.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "subscription_tier" TEXT DEFAULT 'FREE',
ADD COLUMN IF NOT EXISTS "dodo_customer_id" TEXT,
ADD COLUMN IF NOT EXISTS "subscription_id" TEXT;
