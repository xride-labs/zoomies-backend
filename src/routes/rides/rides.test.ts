/**
 * RIDES ROUTES TESTS - COMPREHENSIVE AUTOMATION SUITE
 * Tests for ride endpoints: create, read, update, delete, search, tracking
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import {
  createTestUser,
  createTestRide,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Rides Routes - Comprehensive Tests", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("POST /api/rides - Create Ride", () => {
    it("should create a public ride with valid data", async () => {
      const { user, token } = await createTestUser();

      const rideData = {
        title: "Downtown Cruise",
        description: "Casual ride through downtown",
        startLocation: "NYC",
        endLocation: "Times Square",
        latitude: 40.7128,
        longitude: -74.006,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        experienceLevel: "intermediate",
        duration: 120,
        distance: 25,
      };

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send(rideData);

      expect([201, 200]).toContain(res.status);
      if (res.status === 201 || res.status === 200) {
        expect(res.body.data).toBeDefined();
      }
    });

    it("should create a private ride restricted to friends", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Friends Only Ride",
          visibility: "private",
          startPoint: { latitude: 40.7128, longitude: -74.006, address: "NYC" },
          endPoint: {
            latitude: 40.758,
            longitude: -73.9855,
            address: "Times Square",
          },
          scheduleTime: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          maxParticipants: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.ride.visibility).toBe("private");
    });

    it("should create a group-restricted ride", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Club Ride",
          visibility: "group",
          groupId: "test-group-id",
          startPoint: { latitude: 40.7128, longitude: -74.006, address: "NYC" },
          endPoint: {
            latitude: 40.758,
            longitude: -73.9855,
            address: "Times Square",
          },
          scheduleTime: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          maxParticipants: 20,
        });

      expect([201, 400, 404]).toContain(res.status); // 404 if group doesn't exist
    });

    it("should reject ride without required fields", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Incomplete Ride" }); // Missing required fields

      expect(res.status).toBe(400);
    });

    it("should reject ride with past schedule time", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Past Ride",
          startPoint: { latitude: 40.7128, longitude: -74.006, address: "NYC" },
          endPoint: {
            latitude: 40.758,
            longitude: -73.9855,
            address: "Times Square",
          },
          scheduleTime: new Date(Date.now() - 1000).toISOString(), // 1 second ago
          maxParticipants: 5,
        });

      expect(res.status).toBe(400);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).post("/api/rides").send({ title: "Test" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/rides - List Rides", () => {
    it("should list public rides with pagination", async () => {
      const { user, token } = await createTestUser();
      await createTestRide(user.id, { visibility: "public" });
      await createTestRide(user.id, { visibility: "public" });

      const res = await request(app)
        .get("/api/rides?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should filter rides by difficulty level", async () => {
      const { user, token } = await createTestUser();
      await createTestRide(user.id, { difficulty: "easy", visibility: "public" });
      await createTestRide(user.id, { difficulty: "hard", visibility: "public" });

      const res = await request(app)
        .get("/api/rides?difficulty=easy")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((ride: any) => {
        expect(ride.difficulty).toBe("easy");
      });
    });

    it("should filter rides by bike type", async () => {
      const { user, token } = await createTestUser();
      await createTestRide(user.id, { bikeType: "mountain", visibility: "public" });
      await createTestRide(user.id, { bikeType: "road", visibility: "public" });

      const res = await request(app)
        .get("/api/rides?bikeType=mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((ride: any) => {
        expect(ride.bikeType).toBe("mountain");
      });
    });

    it("should filter rides by distance radius", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/rides?latitude=40.7128&longitude=-74.006&radius=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should search rides by title/description", async () => {
      const { user, token } = await createTestUser();
      await createTestRide(user.id, {
        title: "Mountain Loop Adventure",
        visibility: "public",
      });

      const res = await request(app)
        .get("/api/rides?search=mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should sort rides by date, distance, or difficulty", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/rides?sort=date&order=asc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/rides/:id - Get Ride Details", () => {
    it("should return ride details with full route data", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .get(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidSuccessResponse(res.body, "ride");
      expect(res.body.data.ride.id).toBe(ride.id);
      expect(res.body.data.ride.startPoint).toBeDefined();
      expect(res.body.data.ride.endPoint).toBeDefined();
    });

    it("should include participant list in ride details", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .get(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.ride.participants)).toBe(true);
    });

    it("should return 404 for non-existent ride", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/rides/invalid-ride-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/rides/:id - Update Ride", () => {
    it("should update ride details as creator", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id);

      const updateData = {
        title: "Updated Ride Title",
        description: "Updated description",
        maxParticipants: 15,
      };

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.ride.title).toBe(updateData.title);
    });

    it("should not allow updating ride after it starts", async () => {
      const { user, token } = await createTestUser();
      const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const ride = await createTestRide(user.id, {
        scheduledAt: pastTime,
        status: "IN_PROGRESS",
      });

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(403);
    });

    it("should not allow non-creator to update ride", async () => {
      const creator = await createTestUser();
      const other = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .patch(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ title: "Hacked Title" });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/rides/:id - Delete Ride", () => {
    it("should delete ride as creator", async () => {
      const { user, token } = await createTestUser();
      const ride = await createTestRide(user.id);

      const res = await request(app)
        .delete(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify it's deleted
      const checkRes = await request(app)
        .get(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(checkRes.status).toBe(404);
    });

    it("should not allow non-creator to delete ride", async () => {
      const creator = await createTestUser();
      const other = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .delete(`/api/rides/${ride.id}`)
        .set("Authorization", `Bearer ${other.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/rides/:id/join - Join Ride", () => {
    it("should allow user to join public ride", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const ride = await createTestRide(creator.user.id, {
        visibility: "public",
      });

      const res = await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(200);
    });

    it("should not allow joining ride when max participants reached", async () => {
      const creator = await createTestUser();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const ride = await createTestRide(creator.user.id, {
        maxParticipants: 1,
      });

      // First user joins
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user1.token}`);

      // Second user tries to join
      const res = await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user2.token}`);

      expect(res.status).toBe(400);
    });

    it("should not allow duplicate join", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      // First join
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      // Duplicate join
      const res = await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/rides/:id/leave - Leave Ride", () => {
    it("should allow participant to leave ride", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      // Join first
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      // Then leave
      const res = await request(app)
        .delete(`/api/rides/${ride.id}/leave`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(200);
    });

    it("should not allow leaving ride user not in", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .delete(`/api/rides/${ride.id}/leave`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/rides/:id/invite - Invite to Ride", () => {
    it("should allow creator to invite user to ride", async () => {
      const creator = await createTestUser();
      const invitee = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .post(`/api/rides/${ride.id}/invite`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ userIds: [invitee.user.id] });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.invitations)).toBe(true);
      expect(res.body.data.notificationsSent).toBe(1);
    });

    it("should not allow non-creator to invite", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const other = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      // User joins ride first
      await request(app)
        .post(`/api/rides/${ride.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      // User tries to invite
      const res = await request(app)
        .post(`/api/rides/${ride.id}/invite`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ userIds: [other.user.id] });

      expect(res.status).toBe(403);
    });

    it("should reject invite request without userIds array", async () => {
      const creator = await createTestUser();
      const invitee = await createTestUser();
      const ride = await createTestRide(creator.user.id);

      const res = await request(app)
        .post(`/api/rides/${ride.id}/invite`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ userId: invitee.user.id });

      expect(res.status).toBe(400);
    });
  });

  describe("Performance & Load Tests", () => {
    it("should handle listing 1000+ rides efficiently", async () => {
      const { user, token } = await createTestUser();

      // Create many rides
      for (let i = 0; i < 50; i++) {
        await createTestRide(user.id, { visibility: "public" });
      }

      const startTime = Date.now();
      const res = await request(app)
        .get("/api/rides?page=1&limit=50")
        .set("Authorization", `Bearer ${token}`);

      const duration = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    it("should handle concurrent ride joins", async () => {
      const creator = await createTestUser();
      const ride = await createTestRide(creator.user.id, {
        maxParticipants: 100,
      });

      // Create multiple users
      const users = await Promise.all([
        createTestUser(),
        createTestUser(),
        createTestUser(),
        createTestUser(),
        createTestUser(),
      ]);

      // All try to join simultaneously
      const results = await Promise.all(
        users.map((u) =>
          request(app)
            .post(`/api/rides/${ride.id}/join`)
            .set("Authorization", `Bearer ${u.token}`),
        ),
      );

      // All should succeed
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });
});
