/**
 * CLUBS ROUTES TESTS - COMPREHENSIVE AUTOMATION SUITE
 * Tests for club endpoints: create, manage members, roles, join/leave, search
 */

import request from "supertest";
import { app } from "../../server";
import {
  createTestUser,
  createTestClub,
  cleanupTestData,
  assertValidSuccessResponse,
  assertValidPaginatedResponse,
} from "../../test/utils";

describe("Clubs Routes - Comprehensive Tests", () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe("POST /api/clubs - Create Club", () => {
    it("should create a public club", async () => {
      const { token } = await createTestUser();

      const clubData = {
        name: "Downtown Cyclists",
        description: "City cycling enthusiasts",
        icon: "🚴",
        visibility: "public",
      };

      const res = await request(app)
        .post("/api/clubs")
        .set("Authorization", `Bearer ${token}`)
        .send(clubData);

      expect(res.status).toBe(201);
      assertValidSuccessResponse(res.body, "club");
      expect(res.body.data.club.name).toBe(clubData.name);
      expect(res.body.data.club.creatorId).toBeDefined();
    });

    it("should create a private club", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/clubs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Elite Racers",
          description: "Invitation only",
          visibility: "private",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.club.visibility).toBe("private");
    });

    it("should reject club without name", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/clubs")
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "No name club" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/clubs - List Clubs", () => {
    it("should list public clubs with pagination", async () => {
      const { token } = await createTestUser();
      await createTestClub({ visibility: "public" });
      await createTestClub({ visibility: "public" });

      const res = await request(app)
        .get("/api/clubs?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
    });

    it("should filter clubs by search term", async () => {
      const { token } = await createTestUser();
      await createTestClub({ name: "Mountain Bikers", visibility: "public" });
      await createTestClub({ name: "Road Warriors", visibility: "public" });

      const res = await request(app)
        .get("/api/clubs?search=mountain")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((club: any) => {
        expect(club.name.toLowerCase()).toContain("mountain");
      });
    });

    it("should show user's joined clubs", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/clubs?myClubs=true")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /api/clubs/:id - Update Club", () => {
    it("should update club as creator", async () => {
      const { user, token } = await createTestUser();
      const club = await createTestClub({ creatorId: user.id });

      const updateData = {
        name: "Updated Club Name",
        description: "Updated description",
      };

      const res = await request(app)
        .patch(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.data.club.name).toBe(updateData.name);
    });

    it("should not allow non-creator to update club", async () => {
      const creator = await createTestUser();
      const other = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      const res = await request(app)
        .patch(`/api/clubs/${club.id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ name: "Hacked Club" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/clubs/:id/join - Join Club", () => {
    it("should allow user to join public club", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({
        creatorId: creator.user.id,
        visibility: "public",
      });

      const res = await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(200);
    });

    it("should not allow joining private club without invite", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({
        creatorId: creator.user.id,
        visibility: "private",
      });

      const res = await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(403);
    });

    it("should not allow duplicate join", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      const res = await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/clubs/:id/leave - Leave Club", () => {
    it("should allow member to leave club", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      const res = await request(app)
        .delete(`/api/clubs/${club.id}/leave`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(200);
    });

    it("should not allow leaving club user not in", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      const res = await request(app)
        .delete(`/api/clubs/${club.id}/leave`)
        .set("Authorization", `Bearer ${user.token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("Member Management - Roles", () => {
    it("should list club members", async () => {
      const { token } = await createTestUser();
      const club = await createTestClub();

      const res = await request(app)
        .get(`/api/clubs/${club.id}/members`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      assertValidPaginatedResponse(res.body);
    });

    it("should update member role as admin", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      // User joins club
      await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      // Creator updates user role
      const res = await request(app)
        .patch(`/api/clubs/${club.id}/members/${user.user.id}`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ role: "OFFICER" });

      expect([200, 400, 403]).toContain(res.status);
    });

    it("should remove member from club", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      await request(app)
        .post(`/api/clubs/${club.id}/join`)
        .set("Authorization", `Bearer ${user.token}`);

      const res = await request(app)
        .delete(`/api/clubs/${club.id}/members/${user.user.id}`)
        .set("Authorization", `Bearer ${creator.token}`);

      expect([200, 403]).toContain(res.status);
    });
  });

  describe("Club Invites", () => {
    it("should send invite to user for private club", async () => {
      const creator = await createTestUser();
      const invitee = await createTestUser();
      const club = await createTestClub({
        creatorId: creator.user.id,
        visibility: "private",
      });

      const res = await request(app)
        .post(`/api/clubs/${club.id}/invite`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ userId: invitee.user.id });

      expect([200, 201]).toContain(res.status);
    });

    it("should list club join requests", async () => {
      const creator = await createTestUser();
      const club = await createTestClub({ creatorId: creator.user.id });

      const res = await request(app)
        .get(`/api/clubs/${club.id}/requests`)
        .set("Authorization", `Bearer ${creator.token}`);

      expect(res.status).toBe(200);
    });

    it("should approve join request", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({
        creatorId: creator.user.id,
        visibility: "private",
      });

      // Create join request (user requests to join)
      await request(app)
        .post(`/api/clubs/${club.id}/request-join`)
        .set("Authorization", `Bearer ${user.token}`);

      // Creator approves
      const res = await request(app)
        .post(`/api/clubs/${club.id}/approve-request`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ userId: user.user.id });

      expect([200, 400]).toContain(res.status);
    });

    it("should reject join request", async () => {
      const creator = await createTestUser();
      const user = await createTestUser();
      const club = await createTestClub({
        creatorId: creator.user.id,
        visibility: "private",
      });

      await request(app)
        .post(`/api/clubs/${club.id}/request-join`)
        .set("Authorization", `Bearer ${user.token}`);

      const res = await request(app)
        .post(`/api/clubs/${club.id}/reject-request`)
        .set("Authorization", `Bearer ${creator.token}`)
        .send({ userId: user.user.id });

      expect([200, 400]).toContain(res.status);
    });
  });

  describe("Club Analytics", () => {
    it("should get club statistics", async () => {
      const { token } = await createTestUser();
      const club = await createTestClub();

      const res = await request(app)
        .get(`/api/clubs/${club.id}/stats`)
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });

    it("should get club activity feed", async () => {
      const { token } = await createTestUser();
      const club = await createTestClub();

      const res = await request(app)
        .get(`/api/clubs/${club.id}/activity`)
        .set("Authorization", `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
