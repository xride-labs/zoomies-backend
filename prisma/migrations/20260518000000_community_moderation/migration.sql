-- CreateEnum
CREATE TYPE "ClubMemberStatus" AS ENUM ('ACTIVE', 'MUTED', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "ClubModerationActionType" AS ENUM ('PROMOTE', 'DEMOTE', 'MUTE', 'UNMUTE', 'SUSPEND', 'UNSUSPEND', 'BAN', 'UNBAN', 'KICK');

-- AlterTable
ALTER TABLE "club_members" ADD COLUMN     "status" "ClubMemberStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "muted_until" TIMESTAMP(3),
ADD COLUMN     "suspended_until" TIMESTAMP(3),
ADD COLUMN     "banned_until" TIMESTAMP(3),
ADD COLUMN     "last_interaction_at" TIMESTAMP(3),
ADD COLUMN     "last_message_at" TIMESTAMP(3),
ADD COLUMN     "message_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "friend_groups" ADD COLUMN     "is_announcement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "post_policy" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN     "conversation_id" TEXT;

-- CreateTable
CREATE TABLE "club_moderation_actions" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "ClubModerationActionType" NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_members_status_idx" ON "club_members"("club_id", "status");

-- CreateIndex
CREATE INDEX "club_mod_actions_target_idx" ON "club_moderation_actions"("club_id", "target_user_id");

-- CreateIndex
CREATE INDEX "club_mod_actions_feed_idx" ON "club_moderation_actions"("club_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "club_moderation_actions" ADD CONSTRAINT "club_moderation_actions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
