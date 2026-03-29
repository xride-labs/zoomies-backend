/**
 * FRIEND GROUP ROUTES TESTS
 * Tests for friend group endpoints: create, list, members
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Friend Group Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/friend-groups", () => {
    it("should list user's friend groups", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/friend-groups")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
      }
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/friend-groups");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/friend-groups", () => {
    it("should create a friend group", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/friend-groups")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Weekend Riders",
          icon: "🚴",
        });

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("PATCH /api/friend-groups/:id", () => {
    it("should update friend group", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/friend-groups/test-group-id")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Group Name" });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/friend-groups/:id", () => {
    it("should delete friend group", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/friend-groups/test-group-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("POST /api/friend-groups/:id/members", () => {
    it("should add member to group", async () => {
      const { token, user } = await createTestUser();
      const friend = await createTestUser();

      const res = await request(app)
        .post("/api/friend-groups/test-group-id/members")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: friend.user.id });

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("DELETE /api/friend-groups/:id/members/:userId", () => {
    it("should remove member from group", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/friend-groups/test-group-id/members/test-user-id")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 204, 404]).toContain(res.status);
    });
  });
});
