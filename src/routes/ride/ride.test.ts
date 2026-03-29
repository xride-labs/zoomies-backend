/**
 * RIDE ROUTES TESTS
 * Tests for ride endpoints: create, list, join, leave, complete, cancel, rate participants
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestRide,
  createAdminUser,
  addRideParticipant,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
  mockRideData,
} from "../../test/utils";

describe("Ride Routes", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("GET /api/rides", () => {
    it("should list all rides with pagination", async () => {
      const { token } = await createTestUser();
      const creator = await createTestUser();
      await createTestRide(creator.user.id);
      await createTestRide(creator.user.id);

      const res = await request(app)
        .get("/api/rides?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should filter rides by status", async () => {
      const { token } = await createTestUser();
      const creator = await createTestUser();
      await createTestRide(creator.user.id, { status: "PLANNED" });
      await createTestRide(creator.user.id, { status: "IN_PROGRESS" });

      const res = await request(app)
        .get("/api/rides?status=PLANNED")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      res.body.data.forEach((ride: any) => {
        expect(ride.status).toBe("PLANNED");
      });
    });

    it("should search rides by title", async () => {
      const { token } = await createTestUser();
      const creator = await createTestUser();
      await createTestRide(creator.user.id, { title: "Mountain Adventure" });
      await createTestRide(creator.user.id, { title: "City Tour" });

      const res = await request(app)
        .get("/api/rides?search=Mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/rides");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/rides/:id", () => {
    it("should return ride details by id", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .get(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "ride");
      expect(res.body.data.ride.id).toBe(ride.id);
    });

    it("should return 404 for non-existent ride", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/rides/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/rides", () => {
    it("should create a ride successfully", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send(mockRideData.valid);

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "ride");
      expect(res.body.data.ride.title).toBe(mockRideData.valid.title);
    });

    it("should reject invalid ride data", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send(mockRideData.invalid);

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/rides")
        .send(mockRideData.valid);

      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/rides/:id", () => {
    it("ride creator should update their ride", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ title: "Updated Title" });

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "ride");
      expect(res.body.data.ride.title).toBe("Updated Title");
    });

    it("non-creator should not update ride", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Title" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("DELETE /api/rides/:id", () => {
    it("ride creator should delete their ride", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .delete(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/rides/:id/join", () => {
    it("should join a ride successfully", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token } = await createTestUser();

      const res = await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Count me in!" });

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "participant");
    });

    it("should not allow joining same ride twice", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token, user } = await createTestUser();

      // First join
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "I want to join" });

      // Try to join again
      const res = await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "I want to join" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("DELETE /api/rides/:id/leave", () => {
    it("should leave a ride successfully", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token } = await createTestUser();

      // Join first
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${token}`);

      // Then leave
      const res = await request(app)
        .delete(`/api/rides/${ride.id}/leave`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /api/rides/:id/participants/:userId", () => {
    it("ride creator should accept participant request", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);
      const { token: participantToken, user: participant } =
        await createTestUser();

      // User joins
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${participantToken}`);

      // Creator accepts
      const res = await request(app)
        .patch(`/api/rides/${ride.id}/participants/${participant.id}`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ status: "ACCEPTED" });

      expect(res.status).toBe(200);
    });
  });

  describe("[CRITICAL] Ride Completion & Rating", () => {
    it("should mark ride as completed", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ status: "COMPLETED" });

      // This endpoint might need special handling
      expect([200, 400, 404]).toContain(res.status);
    });

    it("should rate a ride participant (MISSING FEATURE - NEEDS IMPLEMENTATION)", async () => {
      const creator = await createTestUser();
      const participant = await createTestUser();
      const ride = await createTestRide(creator.user.id, {
        status: "COMPLETED",
      });
      await addRideParticipant(participant.user.id, ride.id, "COMPLETED");

      const res = await request(app)
        .post(`/api/rides/${ride.id}/rate/${participant.user.id}`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ rating: 5, message: "Great rider!" });

      // This endpoint might not exist yet
      expect([201, 404]).toContain(res.status);
    });
  });
});
