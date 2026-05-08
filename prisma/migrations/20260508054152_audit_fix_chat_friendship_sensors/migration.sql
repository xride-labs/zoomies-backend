-- AlterTable
ALTER TABLE "business_profiles" ALTER COLUMN "categories" DROP DEFAULT,
ALTER COLUMN "brand_pro_expires_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "start_reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "ghost_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sensor_mode" BOOLEAN NOT NULL DEFAULT false;
