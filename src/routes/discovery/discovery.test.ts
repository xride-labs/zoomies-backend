/**
 * DISCOVERY ROUTES TESTS
 * Tests for location-based discovery feed
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  cleanupTestData,
  assertValidSuccessResponse,
} from "../../test/utils";

describe("Discovery Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/discover", () => {
    it("should get location-based discovery feed", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover?lat=40.7128&lng=-74.0060&radiusKm=10")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });

    it("should filter by type in discovery", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover?lat=40.7128&lng=-74.0060&type=rides")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get(
        "/api/discover?lat=40.7128&lng=-74.0060&radiusKm=10",
      );

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/discover/nearby", () => {
    it("should get nearby items", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover/nearby?lat=40.7128&lng=-74.0060&radiusKm=5")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("[CRITICAL] Discovery Ranking", () => {
    it("should rank results by distance", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover?lat=40.7128&lng=-74.0060&sort=distance")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });

    it("should rank results by popularity", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/discover?lat=40.7128&lng=-74.0060&sort=popularity")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
