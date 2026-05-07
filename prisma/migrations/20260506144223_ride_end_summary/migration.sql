-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "effective_distance_km" DOUBLE PRECISION,
ADD COLUMN     "effective_duration_sec" INTEGER,
ADD COLUMN     "ended_reason" TEXT;

-- CreateTable
CREATE TABLE "ride_summaries" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "total_distance_km" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_duration_sec" INTEGER NOT NULL DEFAULT 0,
    "moving_time_sec" INTEGER NOT NULL DEFAULT 0,
    "idle_time_sec" INTEGER NOT NULL DEFAULT 0,
    "avg_speed_kmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_speed_kmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elevation_gain_m" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "break_count" INTEGER NOT NULL DEFAULT 0,
    "detour_count" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "highlights" JSONB,
    "badges" TEXT[],
    "route_snapshot_url" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ride_summaries_ride_id_key" ON "ride_summaries"("ride_id");

-- AddForeignKey
ALTER TABLE "ride_summaries" ADD CONSTRAINT "ride_summaries_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
