-- Ensure users.interests exists to match Prisma schema (String[] @default([]))
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
