-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "friend_group_id" TEXT;

-- CreateTable
CREATE TABLE "friend_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friend_group_members_group_id_user_id_key" ON "friend_group_members"("group_id", "user_id");

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_friend_group_id_fkey" FOREIGN KEY ("friend_group_id") REFERENCES "friend_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "friend_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
