-- CreateEnum
CREATE TYPE "ClubJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "marketplace_listings" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "club_join_requests" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "ClubJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_join_requests_club_id_user_id_key" ON "club_join_requests"("club_id", "user_id");

-- CreateIndex
CREATE INDEX "clubs_geo_idx" ON "clubs"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "clubs_member_count_idx" ON "clubs"("member_count");

-- CreateIndex
CREATE INDEX "clubs_created_idx" ON "clubs"("created_at");

-- CreateIndex
CREATE INDEX "listings_geo_idx" ON "marketplace_listings"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "listings_status_created_idx" ON "marketplace_listings"("status", "created_at");

-- CreateIndex
CREATE INDEX "rides_geo_idx" ON "rides"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "rides_status_scheduled_idx" ON "rides"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "rides_created_idx" ON "rides"("created_at");

-- AddForeignKey
ALTER TABLE "club_join_requests" ADD CONSTRAINT "club_join_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_join_requests" ADD CONSTRAINT "club_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
