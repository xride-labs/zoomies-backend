/**
 * LOCATION ROUTES TESTS
 *
 * Comprehensive coverage of every endpoint mounted under /api/location
 * (location.routes.ts). All 9 routes are exercised:
 *
 *   POST   /                       update live location      (Pro-gated)
 *   GET    /settings               read sharing settings     (free)
 *   PATCH  /settings               update sharing settings   (Pro-gated)
 *   GET    /friends                friend locations for map  (free)
 *   GET    /friends/:friendId      a specific friend's loc   (free)
 *   GET    /permissions            list sharing permissions  (free)
 *   POST   /permissions            set a friend permission   (Pro-gated)
 *   POST   /ghost-mode             toggle ghost mode         (Pro-gated)
 *   GET    /ride/:rideId           ride participant locs     (free)
 *
 * Pro gate: requireLiveLocationPro = requirePro("Live location sharing") runs
 * BEFORE validateBody, so a non-Pro user gets 403 (SUBSCRIPTION_REQUIRED) even
 * with an invalid body. isUserPro() reads user.subscriptionTier (no billing
 * rows in tests), so createTestUser({ subscriptionTier: "PRO" }) is Pro.
 *
 * Reads (settings GET, friends, friends/:id, permissions GET, ride/:id) are
 * free — no Pro gate. setFriendPermission throws "Not friends..." which the
 * route surfaces as 400; getRideParticipantLocations throws when the requester
 * is not a participant, surfaced as 400.
 *
 * Envelope: success { success, message, data } (200); errors carry
 * error.code. 401 when unauthenticated.
 *
 * Data: friendships / live-location rows / permissions are created directly via
 * prisma since the test utils don't provide helpers. cleanupTestData() wipes
 * users, and the User cascade removes UserLiveLocation, LocationSharePermission
 * and Friendship rows, so no extra teardown is required.
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import {
  createTestUser,
  createTestRide,
  addRideParticipant,
  cleanupTestData,
  assertValidSuccessResponse,
} from "../../test/utils";

// Helper: create an ACCEPTED friendship between two users.
async function makeFriends(aId: string, bId: string) {
  return prisma.friendship.create({
    data: { senderId: aId, receiverId: bId, status: "ACCEPTED" },
  });
}

// Helper: insert/refresh a user's live location row.
async function setLiveLocation(userId: string, data: Record<string, any> = {}) {
  return prisma.userLiveLocation.upsert({
    where: { userId },
    update: { updatedAt: new Date(), ...data },
    create: {
      userId,
      latitude: 40.7128,
      longitude: -74.006,
      sharingEnabled: true,
      shareWithAll: true,
      ghostMode: false,
      ...data,
    },
  });
}

describe("Location Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/location  — update live location (Pro-gated)
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/location", () => {
    it("PRO user should update their live location (happy path + DB side-effect)", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location")
        .set("Authorization", `Bearer ${token}`)
        .send({
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          altitude: 10,
          speed: 0,
          heading: 90,
          battery: 80,
          isMoving: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Location updated");

      const db = await prisma.userLiveLocation.findUnique({
        where: { userId: user.id },
      });
      expect(db).not.toBeNull();
      expect(db?.latitude).toBeCloseTo(40.7128);
      expect(db?.longitude).toBeCloseTo(-74.006);
      expect(db?.isMoving).toBe(true);
    });

    it("non-PRO user should be blocked by the Pro gate (403)", async () => {
      const { token } = await createTestUser(); // FREE

      const res = await request(app)
        .post("/api/location")
        .set("Authorization", `Bearer ${token}`)
        .send({ latitude: 40.7128, longitude: -74.006 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("Pro gate runs before validation: non-PRO with an invalid body still gets 403", async () => {
      const { token } = await createTestUser(); // FREE

      const res = await request(app)
        .post("/api/location")
        .set("Authorization", `Bearer ${token}`)
        .send({ latitude: 999, longitude: 999 }); // out of range, but gate first

      expect(res.status).toBe(403);
    });

    it("PRO user with an invalid latitude should fail validation (400)", async () => {
      const { token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location")
        .set("Authorization", `Bearer ${token}`)
        .send({ latitude: 200, longitude: -74.006 });

      expect(res.status).toBe(400);
    });

    it("PRO user missing required latitude/longitude should fail validation (400)", async () => {
      const { token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location")
        .set("Authorization", `Bearer ${token}`)
        .send({ accuracy: 5 });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/location")
        .send({ latitude: 40.7128, longitude: -74.006 });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/location/settings  — free
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/location/settings", () => {
    it("should return default settings for a user with no location row (free)", async () => {
      const { token } = await createTestUser(); // FREE — reads are not gated

      const res = await request(app)
        .get("/api/location/settings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        sharingEnabled: true,
        shareWithAll: false,
        ghostMode: false,
        expiresAt: null,
      });
    });

    it("should reflect persisted settings", async () => {
      const { user, token } = await createTestUser();
      await setLiveLocation(user.id, {
        sharingEnabled: false,
        shareWithAll: true,
        ghostMode: true,
      });

      const res = await request(app)
        .get("/api/location/settings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sharingEnabled).toBe(false);
      expect(res.body.data.shareWithAll).toBe(true);
      expect(res.body.data.ghostMode).toBe(true);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/location/settings");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/location/settings  — Pro-gated
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/location/settings", () => {
    it("PRO user should update sharing settings and persist them", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .patch("/api/location/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ sharingEnabled: true, shareWithAll: true, expiresInMinutes: 60 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Settings updated");

      const db = await prisma.userLiveLocation.findUnique({
        where: { userId: user.id },
      });
      expect(db?.shareWithAll).toBe(true);
      expect(db?.expiresAt).toBeTruthy();
    });

    it("non-PRO user should be blocked by the Pro gate (403)", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/location/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ shareWithAll: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("PRO user with expiresInMinutes out of range should fail validation (400)", async () => {
      const { token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .patch("/api/location/settings")
        .set("Authorization", `Bearer ${token}`)
        .send({ expiresInMinutes: 5000 }); // max 1440

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .patch("/api/location/settings")
        .send({ shareWithAll: true });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/location/friends  — free (map)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/location/friends", () => {
    it("should return an empty list when the user has no friends", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/location/friends")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.friends).toEqual([]);
    });

    it("should include a friend who shares their location with all", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);
      await setLiveLocation(friend.user.id, {
        shareWithAll: true,
        sharingEnabled: true,
        ghostMode: false,
      });

      const res = await request(app)
        .get("/api/location/friends")
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.friends.length).toBe(1);
      expect(res.body.data.friends[0].id).toBe(friend.user.id);
    });

    it("should exclude a friend in ghost mode", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);
      await setLiveLocation(friend.user.id, {
        shareWithAll: true,
        ghostMode: true,
      });

      const res = await request(app)
        .get("/api/location/friends")
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.friends).toEqual([]);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/location/friends");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/location/friends/:friendId  — free
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/location/friends/:friendId", () => {
    it("should return a friend's location when shared (happy path)", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);
      await setLiveLocation(friend.user.id, {
        latitude: 12.97,
        longitude: 77.59,
        shareWithAll: true,
        sharingEnabled: true,
        ghostMode: false,
      });

      const res = await request(app)
        .get(`/api/location/friends/${friend.user.id}`)
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(friend.user.id);
      expect(res.body.data.latitude).toBeCloseTo(12.97);
    });

    it("should 404 when the friend is in ghost mode", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);
      await setLiveLocation(friend.user.id, { ghostMode: true });

      const res = await request(app)
        .get(`/api/location/friends/${friend.user.id}`)
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(404);
    });

    it("should 404 when the two users are not friends", async () => {
      const me = await createTestUser();
      const other = await createTestUser();
      await setLiveLocation(other.user.id, { shareWithAll: true });

      const res = await request(app)
        .get(`/api/location/friends/${other.user.id}`)
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(404);
    });

    it("should 404 when no location row exists for the friend", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);

      const res = await request(app)
        .get(`/api/location/friends/${friend.user.id}`)
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const { user } = await createTestUser();
      const res = await request(app).get(
        `/api/location/friends/${user.id}`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/location/permissions  — free
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/location/permissions", () => {
    it("should return an empty permissions list when the user has no friends", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/location/permissions")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.permissions).toEqual([]);
    });

    it("should default each friend to visible when no explicit permission exists", async () => {
      const me = await createTestUser();
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);

      const res = await request(app)
        .get("/api/location/permissions")
        .set("Authorization", `Bearer ${me.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.permissions.length).toBe(1);
      expect(res.body.data.permissions[0]).toMatchObject({
        friendId: friend.user.id,
        canSee: true,
      });
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/location/permissions");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/location/permissions  — Pro-gated
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/location/permissions", () => {
    it("PRO user should set a permission for an accepted friend (happy path)", async () => {
      const me = await createTestUser({ subscriptionTier: "PRO" });
      const friend = await createTestUser();
      await makeFriends(me.user.id, friend.user.id);

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${me.token}`)
        .send({ friendId: friend.user.id, canSee: true, canSeeSpeed: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Permission updated");

      const db = await prisma.locationSharePermission.findUnique({
        where: {
          userId_friendId: { userId: me.user.id, friendId: friend.user.id },
        },
      });
      expect(db?.canSee).toBe(true);
      expect(db?.canSeeSpeed).toBe(false);
    });

    it("PRO user setting a permission for a non-friend gets a 400 from the service", async () => {
      const me = await createTestUser({ subscriptionTier: "PRO" });
      const stranger = await createTestUser();

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${me.token}`)
        .send({ friendId: stranger.user.id, canSee: true });

      expect(res.status).toBe(400);
    });

    it("non-PRO user should be blocked by the Pro gate (403)", async () => {
      const me = await createTestUser(); // FREE
      const friend = await createTestUser();

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${me.token}`)
        .send({ friendId: friend.user.id, canSee: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("Pro gate runs before validation: non-PRO with an invalid body still gets 403", async () => {
      const { token } = await createTestUser(); // FREE

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${token}`)
        .send({}); // missing friendId/canSee

      expect(res.status).toBe(403);
    });

    it("PRO user with a missing canSee field should fail validation (400)", async () => {
      const { token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${token}`)
        .send({ friendId: "someFriendId" }); // canSee required

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/location/permissions")
        .send({ friendId: "x", canSee: true });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/location/ghost-mode  — Pro-gated
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/location/ghost-mode", () => {
    it("PRO user should enable ghost mode (DB side-effect)", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Ghost mode enabled");

      const db = await prisma.userLiveLocation.findUnique({
        where: { userId: user.id },
      });
      expect(db?.ghostMode).toBe(true);
    });

    it("PRO user should disable ghost mode", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });
      // Seed an existing location row so disableGhostMode's update() finds it.
      await setLiveLocation(user.id, { ghostMode: true, sharingEnabled: false });

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Ghost mode disabled");

      const db = await prisma.userLiveLocation.findUnique({
        where: { userId: user.id },
      });
      expect(db?.ghostMode).toBe(false);
      expect(db?.sharingEnabled).toBe(true);
    });

    it("PRO user should enable ghost mode with a duration", async () => {
      const { user, token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({ enabled: true, durationMinutes: 30 });

      expect(res.status).toBe(200);
      const db = await prisma.userLiveLocation.findUnique({
        where: { userId: user.id },
      });
      expect(db?.ghostMode).toBe(true);
      expect(db?.expiresAt).toBeTruthy();
    });

    it("non-PRO user should be blocked by the Pro gate (403)", async () => {
      const { token } = await createTestUser(); // FREE

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({ enabled: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("SUBSCRIPTION_REQUIRED");
    });

    it("PRO user with a missing 'enabled' field should fail validation (400)", async () => {
      const { token } = await createTestUser({ subscriptionTier: "PRO" });

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/location/ghost-mode")
        .send({ enabled: true });

      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/location/ride/:rideId  — free, but service-gated
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/location/ride/:rideId", () => {
    it("a participant should get participant locations (happy path)", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      await addRideParticipant(creator.user.id, ride.id);

      // a second participant who is broadcasting a recent location
      const rider = await createTestUser();
      await addRideParticipant(rider.user.id, ride.id);
      await setLiveLocation(rider.user.id, {
        ghostMode: false,
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/location/ride/${ride.id}`)
        .set("Authorization", `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "participants");
      expect(Array.isArray(res.body.data.participants)).toBe(true);
      expect(
        res.body.data.participants.some((p: any) => p.id === rider.user.id),
      ).toBe(true);
    });

    it("a participant with no other broadcasting participants gets an empty list", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      await addRideParticipant(creator.user.id, ride.id);

      const res = await request(app)
        .get(`/api/location/ride/${ride.id}`)
        .set("Authorization", `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.participants).toEqual([]);
    });

    it("a non-participant should get a 400 from the service", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const outsider = await createTestUser();

      const res = await request(app)
        .get(`/api/location/ride/${ride.id}`)
        .set("Authorization", `Bearer ${outsider.token}`);

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app).get(`/api/location/ride/${ride.id}`);
      expect(res.status).toBe(401);
    });
  });
});
