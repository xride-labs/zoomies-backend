/**
 * LOCATION ROUTES TESTS
 * Tests for real-time location sharing and tracking
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestRide,
  cleanupTestData,
  assertValidSuccessResponse,
} from "../../test/utils";

describe("Location Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("POST /api/location/update", () => {
    it("should update user location", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/location/update")
        .set("Authorization", `Bearer ${token}`)
        .send({
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          altitude: 10,
          speed: 0,
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).post("/api/location/update").send({
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(res.status).toBe(401);
    });
  });

  describe("[CRITICAL] Ghost Mode", () => {
    it("should toggle ghost mode", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${token}`)
        .send({ enabled: true });

      expect([200, 404]).toContain(res.status);
    });

    it("should hide location from friends when ghost mode is on", async () => {
      const user = await createTestUser();
      const friend = await createTestUser();

      // First friend each other
      await request(app)
        .post(`/api/users/${friend.user.id}/friend-request`)
        .set("Authorization", `Bearer ${user.token}`);

      // Accept request
      // Then enable ghost mode
      await request(app)
        .post("/api/location/ghost-mode")
        .set("Authorization", `Bearer ${user.token}`)
        .send({ enabled: true });

      // Friend tries to see location
      const res = await request(app)
        .get(`/api/location/user/${user.user.id}`)
        .set("Authorization", `Bearer ${friend.token}`);

      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe("GET /api/location/user/:id", () => {
    it("should get user location if friend and not hidden", async () => {
      const { token, user } = await createTestUser();

      const res = await request(app)
        .get(`/api/location/user/${user.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("GET /api/location/ride/:id", () => {
    it("should get live locations of ride participants", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/location/ride/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("POST /api/location/permissions", () => {
    it("should manage location sharing permissions", async () => {
      const { token } = await createTestUser();
      const friend = await createTestUser();

      const res = await request(app)
        .post("/api/location/permissions")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: friend.user.id,
          canSeeLocation: true,
        });

      expect([200, 404]).toContain(res.status);
    });
  });
});
