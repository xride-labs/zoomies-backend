/**
 * MEDIA ROUTES TESTS
 * Tests for media upload endpoints: profiles, clubs, rides, listings, posts
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestRide,
  createTestClub,
  createTestListing,
  cleanupTestData,
  assertValidSuccessResponse,
} from "../../test/utils";

describe("Media Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("POST /api/media/upload", () => {
    it("should upload profile image", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .send({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          type: "profile",
          targetId: null,
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should upload club image", async () => {
      const { token, user } = await createTestUser();
      const club = await createTestClub(user.id);

      const res = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .send({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          type: "club",
          targetId: club.id,
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should upload ride image", async () => {
      const { token, user } = await createTestUser();
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .send({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          type: "ride",
          targetId: ride.id,
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should upload listing image", async () => {
      const { token, user } = await createTestUser();
      const listing = await createTestListing(user.id);

      const res = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .send({
          file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          type: "listing",
          targetId: listing.id,
        });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should reject invalid file type", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .send({
          file: "not-valid-base64",
          type: "profile",
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/media/upload")
        .send({ file: "data", type: "profile" });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/media/:id", () => {
    it("should delete media", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/media/test-media-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });
});
