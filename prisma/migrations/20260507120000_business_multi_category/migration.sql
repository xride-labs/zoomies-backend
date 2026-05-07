-- Migration: Change BusinessProfile.category (single enum) to categories (array)
--
-- Steps:
--   1. Add new array column
--   2. Backfill from existing single value
--   3. Drop old column
--   4. Rename new column (or keep as-is since Prisma maps to the column name)

-- Add the new array column
ALTER TABLE "business_profiles" ADD COLUMN "categories" "BusinessCategory"[] NOT NULL DEFAULT '{}';

-- Backfill: move existing single value into the array
UPDATE "business_profiles" SET "categories" = ARRAY["category"::"BusinessCategory"];

-- Drop the old single-value column
ALTER TABLE "business_profiles" DROP COLUMN "category";

-- Update the index (drop old, create new covering verification only)
DROP INDEX IF EXISTS "business_category_status_idx";
CREATE INDEX "business_category_status_idx" ON "business_profiles"("verification");
