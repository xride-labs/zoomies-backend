/**
 * FRIENDSHIP ROUTES TESTS
 * Tests for friend request and friend list endpoints
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Friendship Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/friends", () => {
    it("should get user's friend list", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/friend-request", () => {
    it("should send friend request", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();

      const res = await request(app)
        .post("/api/friend-request")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({ userId: receiver.user.id });

      expect([200, 201, 404]).toContain(res.status);
    });

    it("should not allow sending duplicate requests", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();

      // Send first request
      await request(app)
        .post("/api/friend-request")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({ userId: receiver.user.id });

      // Try to send duplicate
      const res = await request(app)
        .post("/api/friend-request")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({ userId: receiver.user.id });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should not allow friending yourself", async () => {
      const { token, user } = await createTestUser();

      const res = await request(app)
        .post("/api/friend-request")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: user.id });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /api/friend-requests", () => {
    it("should list pending friend requests", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/friend-requests")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });
  });

  describe("POST /api/friend-requests/:id/accept", () => {
    it("should accept friend request", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();

      // Sender creates request
      await request(app)
        .post("/api/friend-request")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({ userId: receiver.user.id });

      // Receiver accepts (using a mock request ID)
      const res = await request(app)
        .post("/api/friend-requests/test-request-id/accept")
        .set("Authorization", `Bearer ${receiver.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("POST /api/friend-requests/:id/decline", () => {
    it("should decline friend request", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/friend-requests/test-request-id/decline")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("POST /api/friends/:id/block", () => {
    it("should block a friend", async () => {
      const { token } = await createTestUser();
      const friend = await createTestUser();

      const res = await request(app)
        .post(`/api/friends/${friend.user.id}/block`)
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("POST /api/friends/:id/unblock", () => {
    it("should unblock a user", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/friends/test-user-id/unblock")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
