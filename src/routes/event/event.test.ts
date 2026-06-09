/**
 * EVENT ROUTES TESTS
 * Tests for event discovery, hosting, and attendance.
 *
 * Routes (all behind requireAuth):
 *   GET  /api/events                 -> ApiResponse.success(events[], ...)
 *   POST /api/events                 -> ApiResponse.created(event, ...) | 403 (club gating)
 *   POST /api/events/:id/attend      -> ApiResponse.success(participation, ...) | 404
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import {
  createTestUser,
  createAdminUser,
  createTestClub,
  cleanupTestData,
} from "../../test/utils";

// ─── Local data helpers ──────────────────────────────────────────────────────

async function createEvent(creatorId: string, overrides: Partial<any> = {}) {
  return prisma.event.create({
    data: {
      title: "Test Event",
      scheduledAt: new Date(Date.now() + 7 * 86400000), // next week
      creatorId,
      ...overrides,
    },
  });
}

function futureIso(daysAhead = 7) {
  return new Date(Date.now() + daysAhead * 86400000).toISOString();
}

describe("Event Routes", () => {
  afterEach(async () => {
    // Children before parents: participants -> events. Clubs/users handled by
    // cleanupTestData (events reference both via cascade-safe order here).
    await prisma.eventParticipant.deleteMany({});
    await prisma.event.deleteMany({});
    await cleanupTestData();
  });

  // ─── GET /api/events ─────────────────────────────────────────────────────────
  describe("GET /api/events", () => {
    it("should list upcoming events with participant counts (happy path)", async () => {
      const { user, token } = await createTestUser();
      const event = await createEvent(user.id, { title: "Sunday Ride Meetup" });

      const res = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // ApiResponse.success(events) — data is the array directly.
      expect(Array.isArray(res.body.data)).toBe(true);
      const served = res.body.data.find((e: any) => e.id === event.id);
      expect(served).toBeTruthy();
      expect(served.title).toBe("Sunday Ride Meetup");
      expect(served._count).toHaveProperty("participants");
      expect(served.creator).toMatchObject({ id: user.id });
    });

    it("should exclude past and CANCELLED events", async () => {
      const { user, token } = await createTestUser();
      const past = await createEvent(user.id, {
        scheduledAt: new Date(Date.now() - 86400000),
      });
      const cancelled = await createEvent(user.id, { status: "CANCELLED" });

      const res = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: any) => e.id);
      expect(ids).not.toContain(past.id);
      expect(ids).not.toContain(cancelled.id);
    });

    it("should filter by isFeatured=true", async () => {
      const { user, token } = await createTestUser();
      const featured = await createEvent(user.id, { isFeatured: true });
      const normal = await createEvent(user.id, { isFeatured: false });

      const res = await request(app)
        .get("/api/events?isFeatured=true")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: any) => e.id);
      expect(ids).toContain(featured.id);
      expect(ids).not.toContain(normal.id);
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).get("/api/events");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/events ────────────────────────────────────────────────────────
  describe("POST /api/events", () => {
    it("should create a standalone event (201 + DB side-effect)", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Coastal Cruise",
          description: "A scenic group ride",
          location: "Pacific Coast Hwy",
          scheduledAt: futureIso(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Coastal Cruise");
      expect(res.body.data.creatorId).toBe(user.id);

      const inDb = await prisma.event.findUnique({
        where: { id: res.body.data.id },
      });
      expect(inDb).toBeTruthy();
      expect(inDb?.creatorId).toBe(user.id);
    });

    it("should return 400 when title is too short", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "ab", scheduledAt: futureIso() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when scheduledAt is missing", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "No Date Event" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when scheduledAt is not a valid datetime", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Bad Date Event", scheduledAt: "not-a-date" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 when a non-owner/non-staff hosts a club event", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      // A different, non-member, non-staff user tries to host for the club.
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Unauthorized Club Event",
          scheduledAt: futureIso(),
          clubId: club.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow the club owner to host a club event (201)", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          title: "Owner Hosted Club Event",
          scheduledAt: futureIso(),
          clubId: club.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.clubId).toBe(club.id);
      expect(res.body.data.creatorId).toBe(owner.user.id);
    });

    it("should allow platform staff (ADMIN) to host a club event (201)", async () => {
      const owner = await createTestUser();
      const club = await createTestClub(owner.user.id);
      const admin = await createAdminUser();

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          title: "Admin Hosted Club Event",
          scheduledAt: futureIso(),
          clubId: club.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.clubId).toBe(club.id);
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app)
        .post("/api/events")
        .send({ title: "No Auth Event", scheduledAt: futureIso() });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/events/:id/attend ─────────────────────────────────────────────
  describe("POST /api/events/:id/attend", () => {
    it("should join an event and create a participant (DB side-effect)", async () => {
      const creator = await createTestUser();
      const event = await createEvent(creator.user.id);
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post(`/api/events/${event.id}/attend`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ACCEPTED");

      const participation = await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      });
      expect(participation).toBeTruthy();
      expect(participation?.status).toBe("ACCEPTED");
    });

    it("should be idempotent on re-attend (upsert, no duplicate)", async () => {
      const creator = await createTestUser();
      const event = await createEvent(creator.user.id);
      const { user, token } = await createTestUser();

      await request(app)
        .post(`/api/events/${event.id}/attend`)
        .set("Authorization", `Bearer ${token}`);
      const res2 = await request(app)
        .post(`/api/events/${event.id}/attend`)
        .set("Authorization", `Bearer ${token}`);

      expect(res2.status).toBe(200);
      const count = await prisma.eventParticipant.count({
        where: { eventId: event.id, userId: user.id },
      });
      expect(count).toBe(1);
    });

    it("should return 404 for a valid-but-nonexistent event id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events/clnonexistent000000000000/attend")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for a malformed (non-cuid) event id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/events/not-a-cuid/attend")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without authentication", async () => {
      const res = await request(app).post(
        "/api/events/clnonexistent000000000000/attend",
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
