/*
  Warnings:

  - Added the required column `updated_at` to the `device_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RIDE_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'RIDE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_SOLD';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'SOS_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'BADGE_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'BUSINESS_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'BUSINESS_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ALERT';

-- DropIndex
DROP INDEX "idx_notification_created";

-- DropIndex
DROP INDEX "idx_notification_read";

-- DropIndex
DROP INDEX "idx_notification_user";

-- AlterTable
ALTER TABLE "device_tokens" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "idx_device_token_stale" ON "device_tokens"("last_seen_at");

-- CreateIndex
CREATE INDEX "idx_notification_user_unread" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notification_user_feed" ON "notifications"("user_id", "created_at" DESC);
