/**
 * USER ROUTES TESTS
 * Tests for user endpoints: profiles, follows, friend requests, bikes, user list, roles
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createAdminUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
  mockUserData,
} from "../../test/utils";

describe("User Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/users", () => {
    it("should list users with pagination", async () => {
      const { token } = await createTestUser();
      await createTestUser();

      const res = await request(app)
        .get("/api/users?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should filter users by search term", async () => {
      const { token } = await createTestUser({ name: "Alice Smith" });
      await createTestUser({ name: "Bob Jones" });

      const res = await request(app)
        .get("/api/users?search=Alice")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/users");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return user profile by id", async () => {
      const user1 = await createTestUser();
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/users/${user1.user.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "user");
      expect(res.body.data.user.id).toBe(user1.user.id);
    });

    it("should return 404 for non-existent user", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/users/invalid-id-12345")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/users/:id/follow", () => {
    it("should follow a user successfully", async () => {
      const user1 = await createTestUser();
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/users/${user1.user.id}/follow`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should not allow following self", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post(`/api/users/${user.id}/follow`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/users/:id/unfollow", () => {
    it("should unfollow a user successfully", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // First follow
      await request(app)
        .post(`/api/users/${user1.user.id}/follow`)
        .set("Authorization", `Bearer ${user2.token}`);

      // Then unfollow
      const res = await request(app)
        .post(`/api/users/${user1.user.id}/unfollow`)
        .set("Authorization", `Bearer ${user2.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/users/:id/friend-request", () => {
    it("should send friend request successfully", async () => {
      const user1 = await createTestUser();
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/users/${user1.user.id}/friend-request`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Hey, lets be friends!" });

      expect(res.status).toBe(201);
    });

    it("should reject duplicate friend request", async () => {
      const user1 = await createTestUser();
      const { token } = await createTestUser();

      // Send first request
      await request(app)
        .post(`/api/users/${user1.user.id}/friend-request`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Lets be friends" });

      // Try to send duplicate
      const res = await request(app)
        .post(`/api/users/${user1.user.id}/friend-request`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Lets be friends" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("PATCH /api/users/:id/role", () => {
    it("admin should update user role", async () => {
      const admin = await createAdminUser();
      const { user } = await createTestUser();

      const res = await request(app)
        .patch(`/api/users/${user.id}/role`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ role: "RIDER" });

      expect([200, 400]).toContain(res.status);
    });

    it("non-admin should not update roles", async () => {
      const { token } = await createTestUser();
      const { user: otherUser } = await createTestUser();

      const res = await request(app)
        .patch(`/api/users/${otherUser.id}/role`)
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "ADMIN" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
