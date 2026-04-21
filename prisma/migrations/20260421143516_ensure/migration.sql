-- CreateEnum
CREATE TYPE "ListingOfferStatus" AS ENUM ('INTERESTED', 'OFFER_MADE', 'NEGOTIATING', 'ACCEPTED', 'DEAL_DONE', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RIDE_INVITE', 'RIDE_JOINED', 'RIDE_COMPLETED', 'CLUB_INVITE', 'CLUB_REQUEST', 'LISTING_OFFER', 'LISTING_INTERESTED', 'MESSAGE', 'FOLLOW', 'COMMENT', 'LIKE', 'FRIEND_REQUEST');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "billing_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_license" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "marketplace_listings" ADD COLUMN     "allow_bids" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location_label" TEXT,
ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_live_locations" ALTER COLUMN "ghost_mode" SET DEFAULT true;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "low_data_mode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ride_tracking_data" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "actual_start_time" TIMESTAMP(3),
    "actual_end_time" TIMESTAMP(3),
    "total_duration_min" INTEGER,
    "total_distance_km" DOUBLE PRECISION,
    "max_speed_kmh" DOUBLE PRECISION,
    "avg_speed_kmh" DOUBLE PRECISION,
    "elevation_gain_m" DOUBLE PRECISION,
    "break_count" INTEGER NOT NULL DEFAULT 0,
    "total_break_min" INTEGER NOT NULL DEFAULT 0,
    "route_geojson" TEXT,
    "waypoints" JSONB,
    "weather_notes" TEXT,
    "rider_notes" TEXT,
    "conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_tracking_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_ratings" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "rated_by_id" TEXT NOT NULL,
    "rated_user_id" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_offers" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "status" "ListingOfferStatus" NOT NULL DEFAULT 'INTERESTED',
    "original_price" DOUBLE PRECISION,
    "offered_price" DOUBLE PRECISION,
    "message" TEXT,
    "negotiation_history" TEXT,
    "last_message_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_interests" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "sent_via_email" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_push" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNED',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "banner_image" TEXT,
    "ticket_url" TEXT,
    "creator_id" TEXT NOT NULL,
    "club_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "RideParticipantStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ride_tracking_data_ride_id_key" ON "ride_tracking_data"("ride_id");

-- CreateIndex
CREATE INDEX "idx_rated_user" ON "ride_ratings"("rated_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_ride_rating" ON "ride_ratings"("ride_id", "rated_by_id", "rated_user_id");

-- CreateIndex
CREATE INDEX "idx_offer_status" ON "listing_offers"("status");

-- CreateIndex
CREATE INDEX "idx_buyer_id" ON "listing_offers"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_buyer_per_listing" ON "listing_offers"("listing_id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_listing_interest" ON "listing_interests"("listing_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_notification_user" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notification_read" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "idx_notification_created" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "events_geo_idx" ON "events"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "events_status_scheduled_idx" ON "events"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_user_id_key" ON "event_participants"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "ride_tracking_data" ADD CONSTRAINT "ride_tracking_data_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_rated_by_id_fkey" FOREIGN KEY ("rated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_offers" ADD CONSTRAINT "listing_offers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_offers" ADD CONSTRAINT "listing_offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_interests" ADD CONSTRAINT "listing_interests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_interests" ADD CONSTRAINT "listing_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
