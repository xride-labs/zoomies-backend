-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('BRAND', 'GEAR_SELLER', 'HELMET_SELLER', 'PARTS_SELLER', 'MARKETPLACE_SELLER', 'CLUB', 'SERVICE_STORE', 'MECHANIC', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdPlacementSlot" AS ENUM ('HOME_FEED', 'DISCOVER_TOP', 'MARKETPLACE_INLINE', 'CHAT_LIST_TOP', 'POST_RIDE_SUMMARY');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';
ALTER TYPE "UserRole" ADD VALUE 'CLUB_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'CLUB_MODERATOR';
ALTER TYPE "UserRole" ADD VALUE 'BRAND_OWNER';
ALTER TYPE "UserRole" ADD VALUE 'BRAND_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'BRAND_MODERATOR';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "retention_policy" TEXT;

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "category" "BusinessCategory" NOT NULL,
    "display_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website_url" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pricing_tier" TEXT,
    "verification" "BusinessVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verification_notes" TEXT,
    "documents" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cta_label" TEXT NOT NULL,
    "cta_url" TEXT,
    "deep_link" TEXT,
    "image_url" TEXT NOT NULL,
    "video_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "budget_paise" INTEGER NOT NULL DEFAULT 0,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "slots" "AdPlacementSlot"[],
    "target_tags" TEXT[],
    "impression_cap" INTEGER,
    "impression_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "percent_off" INTEGER,
    "amount_off_paise" INTEGER,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "applies_to" JSONB,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_slug_key" ON "business_profiles"("slug");

-- CreateIndex
CREATE INDEX "business_category_status_idx" ON "business_profiles"("category", "verification");

-- CreateIndex
CREATE INDEX "business_geo_idx" ON "business_profiles"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "business_owner_idx" ON "business_profiles"("owner_id");

-- CreateIndex
CREATE INDEX "ad_campaign_status_window_idx" ON "ad_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "ad_campaign_owner_idx" ON "ad_campaigns"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discount_window_idx" ON "discounts"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "discount_owner_idx" ON "discounts"("business_id");

-- CreateIndex
CREATE INDEX "media_expires_at_idx" ON "media"("expires_at");

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
