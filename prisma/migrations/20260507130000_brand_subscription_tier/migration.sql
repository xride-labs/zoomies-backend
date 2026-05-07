-- Add brand portal subscription tier to business_profiles
ALTER TABLE "business_profiles"
  ADD COLUMN "brand_tier" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN "brand_pro_expires_at" TIMESTAMPTZ;
