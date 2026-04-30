-- CreateEnum
CREATE TYPE "RideBreakType" AS ENUM ('REST', 'FUEL', 'FOOD', 'PHOTO', 'REPAIR', 'EMERGENCY', 'OTHER');

-- AlterEnum
ALTER TYPE "RideStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "paused_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ride_breaks" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RideBreakType" NOT NULL DEFAULT 'REST',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_detours" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distance_added_km" DOUBLE PRECISION,
    "duration_added_min" INTEGER,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_detours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ride_breaks_ride_idx" ON "ride_breaks"("ride_id", "started_at");

-- CreateIndex
CREATE INDEX "ride_breaks_user_idx" ON "ride_breaks"("user_id");

-- CreateIndex
CREATE INDEX "ride_detours_ride_idx" ON "ride_detours"("ride_id", "added_at");

-- AddForeignKey
ALTER TABLE "ride_breaks" ADD CONSTRAINT "ride_breaks_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_breaks" ADD CONSTRAINT "ride_breaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_detours" ADD CONSTRAINT "ride_detours_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_detours" ADD CONSTRAINT "ride_detours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
