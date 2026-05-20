ALTER TABLE "business_profiles"
ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "business_profiles"
SET "onboarding_completed" = true;
