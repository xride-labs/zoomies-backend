-- AlterTable
ALTER TABLE "friend_groups"
ADD COLUMN "club_id" TEXT,
ADD COLUMN "join_approval_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "FriendGroupJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "friend_group_join_requests" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "FriendGroupJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_group_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friend_groups_club_id_idx" ON "friend_groups"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "friend_group_join_requests_group_id_user_id_key" ON "friend_group_join_requests"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "friend_group_join_requests_group_id_status_idx" ON "friend_group_join_requests"("group_id", "status");

-- AddForeignKey
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_join_requests" ADD CONSTRAINT "friend_group_join_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "friend_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_join_requests" ADD CONSTRAINT "friend_group_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
