/*
  Warnings:

  - The values [SUPER_ADMIN,USER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `affiliations` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bikeOdometer` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bike_modifications` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bike_owned` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bike_owner_age` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bike_owner_since` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bike_type` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `experience_level` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `level_of_activity` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `reminders` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `rides_completed` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BikeType" AS ENUM ('SPORT', 'CRUISER', 'TOURING', 'ADVENTURE', 'NAKED', 'CAFE_RACER', 'DUAL_SPORT', 'SCOOTER', 'COMMUTER', 'SUPERBIKE', 'OTHER');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'CLUB_OWNER', 'RIDER', 'SELLER');
ALTER TABLE "user_role_assignments" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "affiliations",
DROP COLUMN "bikeOdometer",
DROP COLUMN "bike_modifications",
DROP COLUMN "bike_owned",
DROP COLUMN "bike_owner_age",
DROP COLUMN "bike_owner_since",
DROP COLUMN "bike_type",
DROP COLUMN "experience_level",
DROP COLUMN "image",
DROP COLUMN "level_of_activity",
DROP COLUMN "reminders",
DROP COLUMN "rides_completed",
ADD COLUMN     "activity_level" TEXT NOT NULL DEFAULT 'Casual',
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "helmet_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_safety_check" TIMESTAMP(3),
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "level_title" TEXT NOT NULL DEFAULT 'Beginner',
ALTER COLUMN "xp_points" SET DEFAULT 0,
ALTER COLUMN "reputation_score" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "bikes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "BikeType" NOT NULL DEFAULT 'OTHER',
    "engine_cc" INTEGER,
    "color" TEXT,
    "license_plate" TEXT,
    "vin" TEXT,
    "odo" INTEGER NOT NULL DEFAULT 0,
    "owner_since" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "modifications" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "aura_points" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "requirement" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ride_reminders" BOOLEAN NOT NULL DEFAULT true,
    "service_reminder_km" INTEGER NOT NULL DEFAULT 3000,
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "open_to_invite" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "sms_notifications" BOOLEAN NOT NULL DEFAULT false,
    "profile_visibility" TEXT NOT NULL DEFAULT 'public',
    "show_location" BOOLEAN NOT NULL DEFAULT true,
    "show_bikes" BOOLEAN NOT NULL DEFAULT true,
    "show_stats" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ride_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_distance_km" INTEGER NOT NULL DEFAULT 0,
    "longest_ride_km" INTEGER NOT NULL DEFAULT 0,
    "total_rides" INTEGER NOT NULL DEFAULT 0,
    "night_rides" INTEGER NOT NULL DEFAULT 0,
    "weekend_rides" INTEGER NOT NULL DEFAULT 0,
    "solo_rides" INTEGER NOT NULL DEFAULT 0,
    "group_rides" INTEGER NOT NULL DEFAULT 0,
    "avg_ride_distance_km" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ride_time_min" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ride_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_title_key" ON "badges"("title");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_ride_stats_user_id_key" ON "user_ride_stats"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_sender_id_receiver_id_key" ON "friendships"("sender_id", "receiver_id");

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ride_stats" ADD CONSTRAINT "user_ride_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
