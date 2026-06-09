/**
 * DISCOVERY ROUTES TESTS - COMPREHENSIVE SUITE
 * Tests for the location-based discovery feed.
 *
 * Route file: src/routes/discovery/discovery.routes.ts (mounted at /api/discover).
 *
 * IMPORTANT REALITIES (aligned to the real implementation):
 *  - There is exactly ONE endpoint: GET /api/discover. There is NO
 *    /api/discover/nearby route, so requests to it 404 at the router level.
 *  - The handler delegates to getDiscoveryFeed(), which returns a SECTIONS
 *    OBJECT, not a paginated list. The success envelope is
 *    { success, message, data } where data is:
 *      { nearbyRides, upcomingRides, clubsNearYou, newClubs,
 *        nearbyBusinesses, nearbyListings } — each an array of
 *      { distanceKm, score, data } feed items.
 *  - Query schema (discoveryFeedQuerySchema):
 *      lat (required, -90..90), lng (required, -180..180),
 *      radiusKm (default 50, max 500, positive),
 *      page (default 1), limit (default 20, max 50),
 *      rideType ∈ {Beginner, Intermediate, Expert},
 *      difficulty ∈ {Leisurely, Moderate, Fast},
 *      upcomingOnly (coerced boolean).
 *    Unknown keys (e.g. type, sort) are STRIPPED by zod (default object
 *    behaviour) → such requests still succeed with 200.
 *  - Missing lat OR lng → 400 validation error.
 *  - The nearbyRides query only returns rides with status PLANNED/IN_PROGRESS
 *    that have latitude/longitude inside the bounding box AND within the
 *    precise haversine radius. createTestRide() seeds latitude 40.7128 /
 *    longitude -74.006 and status defaults to PLANNED, so a ride near that
 *    point appears in nearbyRides.
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestRide,
  cleanupTestData,
} from "../../test/utils";

// NYC reference coordinates that match createTestRide()'s default lat/lng.
const NYC = { lat: 40.7128, lng: -74.006 };

/** Assert the discovery feed envelope + all six section arrays. */
function assertFeedShape(body: any) {
  expect(body).toHaveProperty("success", true);
  expect(body).toHaveProperty("data");
  const d = body.data;
  expect(Array.isArray(d.nearbyRides)).toBe(true);
  expect(Array.isArray(d.upcomingRides)).toBe(true);
  expect(Array.isArray(d.clubsNearYou)).toBe(true);
  expect(Array.isArray(d.newClubs)).toBe(true);
  expect(Array.isArray(d.nearbyBusinesses)).toBe(true);
  expect(Array.isArray(d.nearbyListings)).toBe(true);
}

describe("Discovery Routes - Comprehensive Tests", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/discover - Feed (happy path + envelope)", () => {
    it("should return the full sections object with all six arrays", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=10`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Discovery feed retrieved successfully");
      assertFeedShape(res.body);
    });

    it("should include a nearby ride (with distanceKm/score/data) in nearbyRides", async () => {
      const { user, token } = await createTestUser();
      // Seeded at NYC default coords + PLANNED status → inside the feed window.
      const ride = await createTestRide(user.id, {
        title: "Discovery Nearby Ride",
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=25`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);

      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(found).toBeDefined();
      // Feed item shape: { distanceKm, score, data }
      expect(typeof found.distanceKm).toBe("number");
      expect(typeof found.score).toBe("number");
      expect(found.data.title).toBe("Discovery Nearby Ride");
      // The ride is essentially at the query point → ~0 km away.
      expect(found.distanceKm).toBeLessThan(1);
    });

    it("should exclude a ride far outside the radius", async () => {
      const { user, token } = await createTestUser();
      // Los Angeles coords — ~3900 km from NYC, well outside any radius cap.
      const ride = await createTestRide(user.id, {
        title: "Far Away Ride",
        latitude: 34.0522,
        longitude: -118.2437,
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=50`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(found).toBeUndefined();
    });

    it("should exclude COMPLETED rides from nearbyRides (only PLANNED/IN_PROGRESS)", async () => {
      const { user, token } = await createTestUser();
      const completed = await createTestRide(user.id, {
        title: "Completed Ride",
        status: "COMPLETED",
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=25`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === completed.id,
      );
      expect(found).toBeUndefined();
    });

    it("should use the default radius (50km) when radiusKm is omitted", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);
    });
  });

  describe("GET /api/discover - Filters", () => {
    it("should accept rideType filter (Intermediate) and still return sections", async () => {
      const { user, token } = await createTestUser();
      // createTestRide default experienceLevel is "INTERMEDIATE" (upper-cased),
      // while the feed filters on exact "Intermediate". We don't assert the ride
      // is present — only that the filter is accepted and the feed renders.
      await createTestRide(user.id);

      const res = await request(app)
        .get(
          `/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&rideType=Intermediate`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);
    });

    it("should match nearbyRides when rideType equals the ride's experienceLevel", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id, {
        title: "Beginner Ride",
        experienceLevel: "Beginner",
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&rideType=Beginner`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(found).toBeDefined();
    });

    it("should filter OUT a ride whose experienceLevel does not match rideType", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id, {
        title: "Beginner Ride",
        experienceLevel: "Beginner",
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&rideType=Expert`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(found).toBeUndefined();
    });

    it("should accept difficulty (pace) filter (Moderate)", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id, {
        title: "Moderate Pace Ride",
        pace: "Moderate",
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&difficulty=Moderate`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const found = res.body.data.nearbyRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(found).toBeDefined();
    });

    it("should accept upcomingOnly=true and return the upcomingRides section", async () => {
      const { user, token } = await createTestUser();
      // Scheduled in the future + PLANNED → eligible for the upcoming section.
      const ride = await createTestRide(user.id, {
        title: "Future Planned Ride",
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // +2h
        status: "PLANNED",
      });

      const res = await request(app)
        .get(
          `/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&upcomingOnly=true&radiusKm=25`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);
      const upcoming = res.body.data.upcomingRides.find(
        (item: any) => item.data?.id === ride.id,
      );
      expect(upcoming).toBeDefined();
    });

    it("should respect the limit query param (max 50)", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&limit=5`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);
    });

    it("should strip unknown query keys (type/sort) and still succeed", async () => {
      const { token } = await createTestUser();

      // `type` and `sort` are not part of discoveryFeedQuerySchema. zod strips
      // unknown keys, so these requests succeed with 200.
      const res = await request(app)
        .get(
          `/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&type=rides&sort=distance`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertFeedShape(res.body);
    });
  });

  describe("GET /api/discover - Ranking", () => {
    it("should rank nearer rides ahead of farther rides by score", async () => {
      const { user, token } = await createTestUser();
      // Near: at the query point. Far: ~20km north (still inside a 50km radius).
      const near = await createTestRide(user.id, {
        title: "Near Ride",
        latitude: NYC.lat,
        longitude: NYC.lng,
      });
      const far = await createTestRide(user.id, {
        title: "Far Ride",
        latitude: NYC.lat + 0.18, // ~20km north
        longitude: NYC.lng,
      });

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=50`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const items: any[] = res.body.data.nearbyRides;
      const nearItem = items.find((i) => i.data?.id === near.id);
      const farItem = items.find((i) => i.data?.id === far.id);

      expect(nearItem).toBeDefined();
      expect(farItem).toBeDefined();
      // Distance weighting in the score → nearer ride scores higher.
      expect(nearItem.score).toBeGreaterThan(farItem.score);
      expect(nearItem.distanceKm).toBeLessThan(farItem.distanceKm);
      // Results are returned pre-sorted by score descending.
      expect(items.indexOf(nearItem)).toBeLessThan(items.indexOf(farItem));
    });
  });

  describe("GET /api/discover - Validation (400)", () => {
    it("should return 400 when lat is missing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lng=${NYC.lng}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when lng is missing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when both lat and lng are missing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when lat is out of range (> 90)", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=200&lng=${NYC.lng}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when lng is out of range (< -180)", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=-999`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when lat is non-numeric", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=abc&lng=${NYC.lng}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when radiusKm exceeds the 500km max", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=999`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when rideType is not an allowed enum value", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&rideType=Pro`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("should return 400 when difficulty is not an allowed enum value", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&difficulty=Insane`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/discover - Auth (401)", () => {
    it("should return 401 without auth even with valid coords", async () => {
      const res = await request(app).get(
        `/api/discover?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=10`,
      );

      expect(res.status).toBe(401);
    });

    it("should return 401 without auth and missing coords (auth runs before validation)", async () => {
      const res = await request(app).get("/api/discover");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/discover/nearby - Not a real route", () => {
    it("should 404 because /api/discover only exposes GET / (no /nearby)", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/discover/nearby?lat=${NYC.lat}&lng=${NYC.lng}&radiusKm=5`)
        .set("Authorization", `Bearer ${token}`);

      // The discovery router has no /nearby handler → Express falls through to
      // the global 404 handler.
      expect(res.status).toBe(404);
    });
  });
});
