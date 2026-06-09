/**
 * FRIENDSHIP ROUTES TESTS
 * Comprehensive coverage for /api/friends (friendship.routes.ts).
 *
 * Real endpoints (7) — all mounted under /api/friends:
 *   GET    /                 list friends (paginated, ?search, ?status)
 *   GET    /requests         list pending requests received (paginated)
 *   POST   /request          send friend request   body: { receiverId }
 *   PATCH  /:id/accept       accept a request (receiver only)
 *   PATCH  /:id/decline      decline a request (receiver only)
 *   DELETE /:id              remove a friend / friendship
 *   PATCH  /:id/block        block (either party)
 *
 * The :id in accept/decline/block/delete is the FRIENDSHIP id (not a user id).
 * There is NO unblock endpoint. These routes do not run param validation, so
 * an unknown id reaches the handler and returns 404.
 *
 * The previous version of this file hit non-existent paths
 * (/api/friend-request, /api/friend-requests, POST .../accept,
 * /api/friends/:userId/block, /api/friends/:id/unblock) which only "passed"
 * because they 404'd via the catch-all. Those have been corrected to the real
 * paths/methods/bodies and now assert real behaviour.
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import { createTestUser, cleanupTestData } from "../../test/utils";

// Helper: send a friend request from sender -> receiver and return the
// created friendship row (read straight from the DB so we get its id).
async function sendRequest(senderToken: string, receiverId: string) {
  return request(app)
    .post("/api/friends/request")
    .set("Authorization", `Bearer ${senderToken}`)
    .send({ receiverId });
}

const NONEXISTENT_FRIENDSHIP_ID = "clnonexistentfriend00abcd"; // 25 chars

describe("Friendship Routes", () => {
  afterEach(async () => {
    // Friendships cascade on user delete, but clear them explicitly first so
    // a leaked row can never bleed into another suite's assertions.
    await prisma.friendship.deleteMany({});
    await cleanupTestData();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/friends/request
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/friends/request", () => {
    it("sends a friend request (201 + DB side-effect)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();

      const res = await sendRequest(sender.token, receiver.user.id);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Friend request sent");
      expect(res.body.data.friendship).toBeDefined();
      expect(res.body.data.friendship.status).toBe("PENDING");
      expect(res.body.data.friendship.senderId).toBe(sender.user.id);
      expect(res.body.data.friendship.receiverId).toBe(receiver.user.id);

      // DB side-effect assertion.
      const row = await prisma.friendship.findFirst({
        where: { senderId: sender.user.id, receiverId: receiver.user.id },
      });
      expect(row?.status).toBe("PENDING");
    });

    it("rejects a missing receiverId (400)", async () => {
      const sender = await createTestUser();

      const res = await request(app)
        .post("/api/friends/request")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toMatch(/receiverId is required/i);
    });

    it("does not allow friending yourself (400)", async () => {
      const { token, user } = await createTestUser();

      const res = await sendRequest(token, user.id);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.message).toMatch(/cannot friend yourself/i);
    });

    it("rejects a duplicate pending request (409 conflict)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();

      const first = await sendRequest(sender.token, receiver.user.id);
      expect(first.status).toBe(201);

      const dup = await sendRequest(sender.token, receiver.user.id);
      expect(dup.status).toBe(409);
      expect(dup.body.message).toMatch(/already pending/i);
    });

    it("rejects a reverse-direction request when one already exists (409)", async () => {
      const a = await createTestUser();
      const b = await createTestUser();

      // a -> b
      await sendRequest(a.token, b.user.id);
      // b -> a should also be blocked (existing friendship in either direction).
      const res = await sendRequest(b.token, a.user.id);
      expect(res.status).toBe(409);
    });

    it("returns 409 'Already friends' when the pair is already accepted", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      await prisma.friendship.create({
        data: {
          senderId: sender.user.id,
          receiverId: receiver.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await sendRequest(sender.token, receiver.user.id);
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already friends/i);
    });

    it("returns 400 when a prior friendship is BLOCKED", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      await prisma.friendship.create({
        data: {
          senderId: sender.user.id,
          receiverId: receiver.user.id,
          status: "BLOCKED",
        },
      });

      const res = await sendRequest(sender.token, receiver.user.id);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 401 without auth", async () => {
      const receiver = await createTestUser();
      const res = await request(app)
        .post("/api/friends/request")
        .send({ receiverId: receiver.user.id });
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/friends/requests  (pending, received)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/friends/requests", () => {
    it("lists pending requests received by the caller", async () => {
      const sender = await createTestUser({ name: "Requesting Rider" });
      const receiver = await createTestUser();
      await sendRequest(sender.token, receiver.user.id);

      const res = await request(app)
        .get("/api/friends/requests")
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination.total).toBe(1);
      const item = res.body.data.items[0];
      expect(item.user.id).toBe(sender.user.id);
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("createdAt");
    });

    it("does not include requests the caller sent", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      await sendRequest(sender.token, receiver.user.id);

      // The SENDER should see no incoming pending requests.
      const res = await request(app)
        .get("/api/friends/requests")
        .set("Authorization", `Bearer ${sender.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it("honours pagination params", async () => {
      const receiver = await createTestUser();
      const s1 = await createTestUser();
      const s2 = await createTestUser();
      await sendRequest(s1.token, receiver.user.id);
      await sendRequest(s2.token, receiver.user.id);

      const res = await request(app)
        .get("/api/friends/requests?page=1&limit=1")
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/friends/requests");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/friends  (friends list)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/friends", () => {
    it("returns an empty paginated list for a user with no friends", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    it("lists accepted friends in both directions (default status ACCEPTED)", async () => {
      const a = await createTestUser({ name: "User A" });
      const b = await createTestUser({ name: "User B" });
      const c = await createTestUser({ name: "User C" });
      // a sent to b (a is sender), c sent to a (a is receiver) — both accepted.
      await prisma.friendship.create({
        data: {
          senderId: a.user.id,
          receiverId: b.user.id,
          status: "ACCEPTED",
        },
      });
      await prisma.friendship.create({
        data: {
          senderId: c.user.id,
          receiverId: a.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBe(2);
      const friendIds = res.body.data.items.map((f: any) => f.user.id).sort();
      expect(friendIds).toEqual([b.user.id, c.user.id].sort());
      for (const f of res.body.data.items) {
        expect(f.status).toBe("ACCEPTED");
      }
    });

    it("excludes pending friendships from the default (ACCEPTED) list", async () => {
      const a = await createTestUser();
      const b = await createTestUser();
      await sendRequest(a.token, b.user.id); // PENDING

      const res = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBe(0);
    });

    it("can filter by status=PENDING", async () => {
      const a = await createTestUser();
      const b = await createTestUser();
      await sendRequest(a.token, b.user.id); // PENDING (a is sender)

      const res = await request(app)
        .get("/api/friends?status=PENDING")
        .set("Authorization", `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBe(1);
      expect(res.body.data.items[0].user.id).toBe(b.user.id);
      expect(res.body.data.items[0].status).toBe("PENDING");
    });

    it("supports search by the other user's name", async () => {
      const a = await createTestUser();
      const friendlyBob = await createTestUser({ name: "Findable Bob" });
      const quietSue = await createTestUser({ name: "Quiet Sue" });
      await prisma.friendship.create({
        data: {
          senderId: a.user.id,
          receiverId: friendlyBob.user.id,
          status: "ACCEPTED",
        },
      });
      await prisma.friendship.create({
        data: {
          senderId: a.user.id,
          receiverId: quietSue.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await request(app)
        .get("/api/friends?search=Findable")
        .set("Authorization", `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      const names = res.body.data.items.map((f: any) => f.user.name);
      expect(names).toContain("Findable Bob");
      expect(names).not.toContain("Quiet Sue");
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/friends/:id/accept
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/friends/:id/accept", () => {
    it("lets the receiver accept a pending request (lifecycle -> friends list)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/accept`)
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request accepted");
      expect(res.body.data.friendship.status).toBe("ACCEPTED");

      // DB side-effect.
      const row = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      expect(row?.status).toBe("ACCEPTED");

      // Both parties now see each other in their friends list.
      const senderList = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${sender.token}`);
      expect(senderList.body.data.items.map((f: any) => f.user.id)).toContain(
        receiver.user.id,
      );
    });

    it("forbids the sender from accepting their own request (403)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/accept`)
        .set("Authorization", `Bearer ${sender.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 when the request is no longer pending", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const friendship = await prisma.friendship.create({
        data: {
          senderId: sender.user.id,
          receiverId: receiver.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await request(app)
        .patch(`/api/friends/${friendship.id}/accept`)
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("returns 404 for an unknown friendship id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/accept`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).patch(
        `/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/accept`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/friends/:id/decline
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/friends/:id/decline", () => {
    it("lets the receiver decline a pending request (status -> DECLINED)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/decline`)
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request declined");
      expect(res.body.data.friendship.status).toBe("DECLINED");

      const row = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      expect(row?.status).toBe("DECLINED");

      // Declined requests no longer appear in the receiver's pending list.
      const pending = await request(app)
        .get("/api/friends/requests")
        .set("Authorization", `Bearer ${receiver.token}`);
      expect(pending.body.data.pagination.total).toBe(0);
    });

    it("forbids the sender from declining (403)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/decline`)
        .set("Authorization", `Bearer ${sender.token}`);

      expect(res.status).toBe(403);
    });

    it("returns 404 for an unknown friendship id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/decline`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).patch(
        `/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/decline`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/friends/:id/block
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/friends/:id/block", () => {
    it("lets either party block the friendship (status -> BLOCKED)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      // The receiver blocks.
      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/block`)
        .set("Authorization", `Bearer ${receiver.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("User blocked");

      const row = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
      expect(row?.status).toBe("BLOCKED");

      // Blocked rows drop out of the default ACCEPTED friends list.
      const list = await request(app)
        .get("/api/friends")
        .set("Authorization", `Bearer ${receiver.token}`);
      expect(list.body.data.pagination.total).toBe(0);
    });

    it("forbids an unrelated third party from blocking (403)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const stranger = await createTestUser();
      const sent = await sendRequest(sender.token, receiver.user.id);
      const friendshipId = sent.body.data.friendship.id;

      const res = await request(app)
        .patch(`/api/friends/${friendshipId}/block`)
        .set("Authorization", `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 for an unknown friendship id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch(`/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/block`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).patch(
        `/api/friends/${NONEXISTENT_FRIENDSHIP_ID}/block`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/friends/:id  (remove friend / friendship)
  // ───────────────────────────────────────────────────────────────────────────
  describe("DELETE /api/friends/:id", () => {
    it("lets a party remove the friendship (with DB side-effect)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const friendship = await prisma.friendship.create({
        data: {
          senderId: sender.user.id,
          receiverId: receiver.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await request(app)
        .delete(`/api/friends/${friendship.id}`)
        .set("Authorization", `Bearer ${sender.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend removed");

      const row = await prisma.friendship.findUnique({
        where: { id: friendship.id },
      });
      expect(row).toBeNull();
    });

    it("forbids an unrelated user from removing the friendship (403)", async () => {
      const sender = await createTestUser();
      const receiver = await createTestUser();
      const stranger = await createTestUser();
      const friendship = await prisma.friendship.create({
        data: {
          senderId: sender.user.id,
          receiverId: receiver.user.id,
          status: "ACCEPTED",
        },
      });

      const res = await request(app)
        .delete(`/api/friends/${friendship.id}`)
        .set("Authorization", `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
      // Friendship must still exist.
      const row = await prisma.friendship.findUnique({
        where: { id: friendship.id },
      });
      expect(row).not.toBeNull();
    });

    it("returns 404 for an unknown friendship id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete(`/api/friends/${NONEXISTENT_FRIENDSHIP_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).delete(
        `/api/friends/${NONEXISTENT_FRIENDSHIP_ID}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
