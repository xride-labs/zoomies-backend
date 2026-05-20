-- CreateEnum
CREATE TYPE "BrandProductCategory" AS ENUM ('MOTORCYCLE', 'GEAR', 'HELMET', 'JACKET', 'GLOVES', 'BOOTS', 'PANTS', 'PARTS', 'ACCESSORIES', 'ELECTRONICS', 'TOOLS', 'LUBRICANTS', 'TYRES', 'LIGHTING', 'APPAREL', 'MEMORABILIA', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'DISCONTINUED');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_announcement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "brand_products" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "category" "BrandProductCategory" NOT NULL DEFAULT 'OTHER',
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "images" TEXT[],
    "availability" "ProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specs" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_product_business_idx" ON "brand_products"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "posts_club_feed_idx" ON "posts"("club_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_expires_idx" ON "posts"("expires_at");

-- AddForeignKey
ALTER TABLE "brand_products" ADD CONSTRAINT "brand_products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
