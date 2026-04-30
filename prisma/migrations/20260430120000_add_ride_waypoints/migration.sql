-- AlterTable: add planned waypoints column to rides
ALTER TABLE "rides" ADD COLUMN "waypoints" JSONB;
