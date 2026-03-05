-- CreateTable
CREATE TABLE "user_live_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "battery" INTEGER,
    "is_moving" BOOLEAN NOT NULL DEFAULT false,
    "is_on_ride" BOOLEAN NOT NULL DEFAULT false,
    "ride_id" TEXT,
    "sharing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "share_with_all" BOOLEAN NOT NULL DEFAULT false,
    "ghost_mode" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_live_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_share_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "friend_id" TEXT NOT NULL,
    "can_see" BOOLEAN NOT NULL DEFAULT true,
    "can_see_speed" BOOLEAN NOT NULL DEFAULT true,
    "can_see_battery" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_share_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_live_locations_user_id_key" ON "user_live_locations"("user_id");

-- CreateIndex
CREATE INDEX "user_live_locations_latitude_longitude_idx" ON "user_live_locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "user_live_locations_updated_at_idx" ON "user_live_locations"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "location_share_permissions_user_id_friend_id_key" ON "location_share_permissions"("user_id", "friend_id");

-- AddForeignKey
ALTER TABLE "user_live_locations" ADD CONSTRAINT "user_live_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
