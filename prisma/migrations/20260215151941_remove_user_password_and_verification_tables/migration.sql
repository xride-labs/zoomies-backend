/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `verification_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_user_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password";

-- DropTable
DROP TABLE "verification_tokens";

-- DropTable
DROP TABLE "verifications";
