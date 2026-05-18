-- CreateEnum
CREATE TYPE "BrandMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('GENERAL_SERVICE', 'OIL_CHANGE', 'BRAKE_SERVICE', 'TYRE_CHANGE', 'ELECTRICAL', 'SUSPENSION', 'ENGINE_WORK', 'CUSTOM_MODIFICATION', 'INSPECTION', 'ROADSIDE_ASSISTANCE', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "brand_members" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "BrandMemberRole" NOT NULL DEFAULT 'MEMBER',
    "invited_by" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_listings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL DEFAULT 'GENERAL_SERVICE',
    "price_range" TEXT,
    "duration" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_inquiries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_member_business_idx" ON "brand_members"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_members_business_id_user_id_key" ON "brand_members"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "service_listing_business_idx" ON "service_listings"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "inquiry_business_idx" ON "business_inquiries"("business_id");

-- CreateIndex
CREATE INDEX "inquiry_user_idx" ON "business_inquiries"("from_user_id");

-- AddForeignKey
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
