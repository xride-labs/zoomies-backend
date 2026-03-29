-- Restore Better Auth-compatible image column for social OAuth signups.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "image" TEXT;

-- Backfill image from legacy avatar so existing users keep profile photos.
UPDATE "users"
SET "image" = "avatar"
WHERE "image" IS NULL
  AND "avatar" IS NOT NULL;
