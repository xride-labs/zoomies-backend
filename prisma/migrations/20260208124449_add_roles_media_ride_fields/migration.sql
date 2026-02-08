-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'CLUB_OWNER';

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "club_id" TEXT,
ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "keep_permanently" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "route_data" TEXT;

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "type" "MediaType" NOT NULL,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "duration" DOUBLE PRECISION,
    "folder" TEXT NOT NULL,
    "user_id" TEXT,
    "club_id" TEXT,
    "ride_id" TEXT,
    "listing_id" TEXT,
    "post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_public_id_key" ON "media"("public_id");
