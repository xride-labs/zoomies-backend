-- Add explicit start/end coordinate columns to rides so the mobile MapPreview
-- can render an actual route. The legacy `latitude` / `longitude` columns are
-- kept and mirrored from start_lat / start_lng to preserve the existing geo
-- index and the nearby-feed query path.

ALTER TABLE "rides"
  ADD COLUMN "start_lat" DOUBLE PRECISION,
  ADD COLUMN "start_lng" DOUBLE PRECISION,
  ADD COLUMN "end_lat"   DOUBLE PRECISION,
  ADD COLUMN "end_lng"   DOUBLE PRECISION;

-- Backfill: any existing ride with a single point becomes its own start.
UPDATE "rides"
SET "start_lat" = "latitude",
    "start_lng" = "longitude"
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
