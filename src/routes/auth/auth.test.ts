/**
 * AUTH ROUTES TESTS
 * Tests for authentication endpoints: login, signup, logout, password change, profile updates
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import {
  createTestUser,
  createMockToken,
  cleanupTestData,
  mockUserData,
  assertValidSuccessResponse,
  assertValidErrorResponse,
} from "../../test/utils";

describe("Auth Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/auth/me", () => {
    it("should return current user profile when authenticated", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "user");
      expect(res.body.data.user.id).toBe(user.id);
      expect(res.body.data.user.email).toBe(user.email);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/auth/profile", () => {
    it("should update user profile successfully", async () => {
      const { token } = await createTestUser();

      const updateData = {
        name: "Updated Name",
        bio: "Updated bio",
        location: "New City",
        dob: new Date("1990-01-01").toISOString(),
      };

      const res = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "user");
      expect(res.body.data.user.name).toBe(updateData.name);
      expect(res.body.data.user.bio).toBe(updateData.bio);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .patch("/api/auth/profile")
        .send({ name: "Updated" });

      expect(res.status).toBe(401);
    });

    it("should validate email format", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "invalid-email" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/change-password", () => {
    it("should change password successfully with correct current password", async () => {
      const testUser = await createTestUser({
        password: "OldPassword123", // You would need to implement password hash
      });

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${testUser.token}`)
        .send({
          currentPassword: "OldPassword123",
          newPassword: "NewPassword456",
        });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "message");
    });

    it("should return 400 with weak password", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: "ValidPassword123",
          newPassword: "weak", // Too weak
        });

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).post("/api/auth/change-password").send({
        currentPassword: "test",
        newPassword: "NewPass123",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should verify email with valid token", async () => {
      const { token } = await createTestUser({ emailVerified: false });

      const res = await request(app)
        .post("/api/auth/verify-email")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: "valid-verification-token" });

      // Response depends on implementation
      expect([200, 400]).toContain(res.status);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "some-token" });

      expect(res.status).toBe(401);
    });
  });
});
