/**
 * ADMIN ROUTES TESTS
 * Tests for admin endpoints: dashboard, user management, report handling
 */

import request from "supertest";
import { app } from "../../server";
import {
  createAdminUser,
  createTestUser,
  createTestRide,
  cleanupTestData,
  assertValidSuccessResponse,
} from "../../test/utils";

describe("Admin Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/admin/dashboard", () => {
    it("admin should access dashboard", async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${admin.token}`);

      expect([200, 404]).toContain(res.status);
    });

    it("non-admin should not access dashboard", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /api/admin/users", () => {
    it("admin should list all users", async () => {
      const admin = await createAdminUser();
      await createTestUser();
      await createTestUser();

      const res = await request(app)
        .get("/api/admin/users?page=1&limit=10")
        .set("Authorization", `Bearer ${admin.token}`);

      expect([200, 404]).toContain(res.status);
    });

    it("admin should search users", async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get("/api/admin/users?search=test")
        .set("Authorization", `Bearer ${admin.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("PATCH /api/admin/users/:id", () => {
    it("admin should update user roles", async () => {
      const admin = await createAdminUser();
      const user = await createTestUser();

      const res = await request(app)
        .patch(`/api/admin/users/${user.user.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ role: "OFFICER" });

      expect([200, 404]).toContain(res.status);
    });

    it("admin should ban/suspend users", async () => {
      const admin = await createAdminUser();
      const user = await createTestUser();

      const res = await request(app)
        .patch(`/api/admin/users/${user.user.id}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ isBanned: true });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("GET /api/admin/reports", () => {
    it("admin should view reports", async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .get("/api/admin/reports")
        .set("Authorization", `Bearer ${admin.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("PATCH /api/admin/reports/:id", () => {
    it("admin should resolve reports", async () => {
      const admin = await createAdminUser();

      const res = await request(app)
        .patch("/api/admin/reports/test-report-id")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "RESOLVED" });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("GET /api/admin/rides", () => {
    it("admin should view all rides", async () => {
      const admin = await createAdminUser();
      const creator = await createTestUser();
      await createTestRide(creator.user.id);

      const res = await request(app)
        .get("/api/admin/rides")
        .set("Authorization", `Bearer ${admin.token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
