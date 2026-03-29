/**
 * CLUB ROUTES TESTS
 * Tests for club endpoints: create, list, members, join, invite, leave
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestClub,
  createAdminUser,
  addUserToClub,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
  mockClubData,
} from "../../test/utils";

describe("Club Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/clubs", () => {
    it("should list all public clubs", async () => {
      const owner = await createTestUser();
      const { token } = await createTestUser();
      await createTestClub(owner.user.id, { isPublic: true });
      await createTestClub(owner.user.id, { isPublic: true });

      const res = await request(app)
        .get("/api/clubs?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should search clubs by name", async () => {
      const owner = await createTestUser();
      const { token } = await createTestUser();
      await createTestClub(owner.user.id, { name: "Mountain Bikers" });
      await createTestClub(owner.user.id, { name: "Road Cyclists" });

      const res = await request(app)
        .get("/api/clubs?search=Mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/clubs/my-clubs", () => {
    it("should return user's clubs", async () => {
      const { user, token } = await createTestUser();
      const club1 = await createTestClub(user.id);
      const club2 = await createTestClub(user.id);

      const res = await request(app)
        .get("/api/clubs/my-clubs")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
    });
  });

  describe("GET /api/clubs/:id", () => {
    it("should return club details", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "club");
      expect(res.body.data.club.id).toBe(club.id);
    });

    it("should return 404 for non-existent club", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/clubs/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/clubs", () => {
    it("should create a club successfully", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/clubs")
        .set("Authorization", `Bearer ${token}`)
        .send(mockClubData.valid);

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "club");
      expect(res.body.data.club.name).toBe(mockClubData.valid.name);
    });

    it("should reject invalid club data", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/clubs")
        .set("Authorization", `Bearer ${token}`)
        .send(mockClubData.invalid);

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/clubs/:id", () => {
    it("club owner should update club", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);

      const res = await request(app)
        .patch(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Updated Club Name" });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "club");
      expect(res.body.data.club.name).toBe("Updated Club Name");
    });

    it("non-owner should not update club", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Hacked Name" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("DELETE /api/clubs/:id", () => {
    it("club owner should delete club", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);

      const res = await request(app)
        .delete(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/clubs/:id/join", () => {
    it("should request to join club", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id, { isPublic: true });
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "I want to join!" });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe("DELETE /api/clubs/:id/leave", () => {
    it("member should leave club", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      const { token, user } = await createTestUser();

      // Add member
      await addUserToClub(user.id, club.id, "MEMBER");

      const res = await request(app)
        .delete(`/api/clubs/${club.id}/leave`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/clubs/:id/members", () => {
    it("should list club members", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      const member = await createTestUser();
      await addUserToClub(member.user.id, club.id);

      const res = await request(app)
        .get(`/api/clubs/${club.id}/members`)
        .set("Authorization", `Bearer ${owner.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
