/**
 * NOTIFICATION ROUTES TESTS
 * Tests for /api/notifications endpoints (all behind requireAuth):
 *   GET    /                      list (paginated, ?unreadOnly)
 *   GET    /unread-count          count of unread
 *   PATCH  /read-all              mark all as read
 *   PATCH  /:id/read              mark one as read
 *   DELETE /:id                   delete one (userId-guarded)
 *   DELETE /                      clear all
 *   POST   /devices/register      register/refresh a push token
 *   POST   /devices/unregister    remove a push token
 *
 * Notification has no validateBody/Params on its routes, so id params are raw.
 * A nonexistent id therefore yields a real 404 (or a no-op for deleteMany),
 * never a validation 400.
 */

import request from "supertest";
import { app } from "../../server";
import prisma from "../../lib/prisma";
import { createTestUser, cleanupTestData } from "../../test/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Notification row directly with the real required fields from
 * schema.prisma: userId, type (NotificationType enum), title. `message` and
 * the read flags are optional but useful for assertions.
 */
async function createNotification(
  userId: string,
  overrides: Partial<{
    type: any;
    title: string;
    message: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return prisma.notification.create({
    data: {
      userId,
      type: overrides.type ?? "SYSTEM_ALERT",
      title: overrides.title ?? "Test notification",
      message: overrides.message ?? "A test notification body",
      isRead: overrides.isRead ?? false,
      ...(overrides.readAt !== undefined ? { readAt: overrides.readAt } : {}),
      ...(overrides.createdAt !== undefined
        ? { createdAt: overrides.createdAt }
        : {}),
    },
  });
}

describe("Notification Routes", () => {
  // Notification + DeviceToken are NOT cleaned by cleanupTestData(); they hold
  // a userId FK so they must be deleted BEFORE the users are removed.
  afterEach(async () => {
    await prisma.notification.deleteMany({});
    await prisma.deviceToken.deleteMany({});
    await cleanupTestData();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/notifications  (list, paginated)
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/notifications", () => {
    it("should list the caller's notifications with paginated envelope", async () => {
      const { user, token } = await createTestUser();
      await createNotification(user.id, { title: "n1" });
      await createNotification(user.id, { title: "n2" });
      await createNotification(user.id, { title: "n3" });

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // ApiResponse.paginated nests as data:{items,pagination}
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it("should only return the caller's own notifications", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      await createNotification(owner.user.id, { title: "mine-1" });
      await createNotification(owner.user.id, { title: "mine-2" });
      await createNotification(other.user.id, { title: "theirs" });

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
      const titles = res.body.data.items.map((n: any) => n.title);
      expect(titles).not.toContain("theirs");
      for (const n of res.body.data.items) {
        expect(n.userId).toBe(owner.user.id);
      }
    });

    it("should respect page/limit query params", async () => {
      const { user, token } = await createTestUser();
      for (let i = 0; i < 5; i++) {
        await createNotification(user.id, { title: `n${i}` });
      }

      const res = await request(app)
        .get("/api/notifications?page=2&limit=2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it("should filter to unread only when unreadOnly=true", async () => {
      const { user, token } = await createTestUser();
      await createNotification(user.id, { title: "read-one", isRead: true });
      await createNotification(user.id, { title: "unread-one", isRead: false });
      await createNotification(user.id, { title: "unread-two", isRead: false });

      const res = await request(app)
        .get("/api/notifications?unreadOnly=true")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
      for (const n of res.body.data.items) {
        expect(n.isRead).toBe(false);
      }
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/notifications/unread-count
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/notifications/unread-count", () => {
    it("should return the correct unread count for the caller", async () => {
      const { user, token } = await createTestUser();
      await createNotification(user.id, { isRead: false });
      await createNotification(user.id, { isRead: false });
      await createNotification(user.id, { isRead: false });
      await createNotification(user.id, { isRead: true });

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ unread: 3 });
    });

    it("should not count another user's unread notifications", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      await createNotification(owner.user.id, { isRead: false });
      await createNotification(other.user.id, { isRead: false });
      await createNotification(other.user.id, { isRead: false });

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBe(1);
    });

    it("should return 0 when there are no unread notifications", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBe(0);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).get("/api/notifications/unread-count");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/notifications/read-all
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/notifications/read-all", () => {
    it("should mark all of the caller's unread notifications as read", async () => {
      const { user, token } = await createTestUser();
      await createNotification(user.id, { isRead: false });
      await createNotification(user.id, { isRead: false });
      // Pre-read row carries its own readAt (read-all only touches unread rows,
      // so it won't backfill readAt on an already-read notification).
      await createNotification(user.id, { isRead: true, readAt: new Date() });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Only the 2 unread rows are updated.
      expect(res.body.data).toEqual({ updated: 2 });

      // Re-query: nothing should remain unread, and readAt is set.
      const stillUnread = await prisma.notification.count({
        where: { userId: user.id, isRead: false },
      });
      expect(stillUnread).toBe(0);
      const rows = await prisma.notification.findMany({
        where: { userId: user.id },
      });
      for (const r of rows) {
        expect(r.isRead).toBe(true);
        expect(r.readAt).not.toBeNull();
      }
    });

    it("should not touch another user's notifications", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const otherNotif = await createNotification(other.user.id, {
        isRead: false,
      });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(0);

      const reloaded = await prisma.notification.findUnique({
        where: { id: otherNotif.id },
      });
      expect(reloaded?.isRead).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).patch("/api/notifications/read-all");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/notifications/:id/read
  // ───────────────────────────────────────────────────────────────────────────
  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark a single unread notification as read", async () => {
      const { user, token } = await createTestUser();
      const notif = await createNotification(user.id, { isRead: false });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Marked as read");
      expect(res.body.data).toEqual({ id: notif.id });

      const reloaded = await prisma.notification.findUnique({
        where: { id: notif.id },
      });
      expect(reloaded?.isRead).toBe(true);
      expect(reloaded?.readAt).not.toBeNull();
    });

    it("should be idempotent and report 'Already read' for a read notification", async () => {
      const { user, token } = await createTestUser();
      const notif = await createNotification(user.id, {
        isRead: true,
        readAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif.id}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Already read");
      expect(res.body.data).toEqual({ id: notif.id });
    });

    it("should return 404 for a well-formed but nonexistent id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch("/api/notifications/nonexistentnotif00000000/read")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when acting on another user's notification (no leak)", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const otherNotif = await createNotification(other.user.id, {
        isRead: false,
      });

      const res = await request(app)
        .patch(`/api/notifications/${otherNotif.id}/read`)
        .set("Authorization", `Bearer ${owner.token}`);

      // Handler returns notFound when userId mismatches, never 403.
      expect(res.status).toBe(404);

      // The victim's notification must remain unread.
      const reloaded = await prisma.notification.findUnique({
        where: { id: otherNotif.id },
      });
      expect(reloaded?.isRead).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const { user } = await createTestUser();
      const notif = await createNotification(user.id, { isRead: false });

      const res = await request(app).patch(
        `/api/notifications/${notif.id}/read`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/notifications/:id
  // ───────────────────────────────────────────────────────────────────────────
  describe("DELETE /api/notifications/:id", () => {
    it("should delete the caller's own notification", async () => {
      const { user, token } = await createTestUser();
      const notif = await createNotification(user.id);

      const res = await request(app)
        .delete(`/api/notifications/${notif.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ ok: true });

      const reloaded = await prisma.notification.findUnique({
        where: { id: notif.id },
      });
      expect(reloaded).toBeNull();
    });

    it("should NOT delete another user's notification (userId-guarded no-op)", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const otherNotif = await createNotification(other.user.id);

      const res = await request(app)
        .delete(`/api/notifications/${otherNotif.id}`)
        .set("Authorization", `Bearer ${owner.token}`);

      // deleteMany with a userId guard silently matches nothing → still 200.
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ok: true });

      // Victim's row must still exist.
      const reloaded = await prisma.notification.findUnique({
        where: { id: otherNotif.id },
      });
      expect(reloaded).not.toBeNull();
    });

    it("should succeed (no-op) for a nonexistent id", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/api/notifications/nonexistentnotif00000000")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ok: true });
    });

    it("should return 401 when not authenticated", async () => {
      const { user } = await createTestUser();
      const notif = await createNotification(user.id);

      const res = await request(app).delete(`/api/notifications/${notif.id}`);
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/notifications  (clear all)
  // ───────────────────────────────────────────────────────────────────────────
  describe("DELETE /api/notifications", () => {
    it("should clear all of the caller's notifications", async () => {
      const { user, token } = await createTestUser();
      await createNotification(user.id);
      await createNotification(user.id);
      await createNotification(user.id);

      const res = await request(app)
        .delete("/api/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("All notifications cleared");
      expect(res.body.data).toEqual({ ok: true });

      const remaining = await prisma.notification.count({
        where: { userId: user.id },
      });
      expect(remaining).toBe(0);
    });

    it("should not clear another user's notifications", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      await createNotification(owner.user.id);
      await createNotification(other.user.id);
      await createNotification(other.user.id);

      const res = await request(app)
        .delete("/api/notifications")
        .set("Authorization", `Bearer ${owner.token}`);

      expect(res.status).toBe(200);

      const ownerCount = await prisma.notification.count({
        where: { userId: owner.user.id },
      });
      const otherCount = await prisma.notification.count({
        where: { userId: other.user.id },
      });
      expect(ownerCount).toBe(0);
      expect(otherCount).toBe(2);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app).delete("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/notifications/devices/register
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/notifications/devices/register", () => {
    it("should register a new device token", async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .post("/api/notifications/devices/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: "expo-push-token-abcdef123456", platform: "ios" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Device registered");
      expect(res.body.data).toEqual({ ok: true });

      const saved = await prisma.deviceToken.findUnique({
        where: { token: "expo-push-token-abcdef123456" },
      });
      expect(saved).not.toBeNull();
      expect(saved?.userId).toBe(user.id);
      expect(saved?.platform).toBe("ios");
    });

    it("should be idempotent and refresh lastSeenAt on re-register", async () => {
      const { user, token } = await createTestUser();
      const pushToken = "expo-push-token-idempotent01";

      await request(app)
        .post("/api/notifications/devices/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: pushToken, platform: "android" });

      const res = await request(app)
        .post("/api/notifications/devices/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: pushToken, platform: "android", deviceId: "device-1" });

      expect(res.status).toBe(200);

      // Still exactly one row for this token, owned by the user.
      const rows = await prisma.deviceToken.findMany({
        where: { token: pushToken },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(user.id);
      expect(rows[0].deviceId).toBe("device-1");
    });

    it("should cap a user at 5 device tokens, evicting the oldest", async () => {
      const { user, token } = await createTestUser();

      // Register 6 tokens; the least-recently-seen should be evicted to keep 5.
      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post("/api/notifications/devices/register")
          .set("Authorization", `Bearer ${token}`)
          .send({ token: `push-token-cap-${i}-xxxxxx`, platform: "ios" });
        expect(res.status).toBe(200);
      }

      const count = await prisma.deviceToken.count({
        where: { userId: user.id },
      });
      expect(count).toBe(5);
    });

    it("should reject a missing/short token with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/notifications/devices/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: "short", platform: "ios" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject an invalid platform with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/notifications/devices/register")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: "valid-length-token-here", platform: "windows" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/notifications/devices/register")
        .send({ token: "valid-length-token-here", platform: "ios" });
      expect(res.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/notifications/devices/unregister
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/notifications/devices/unregister", () => {
    it("should unregister the caller's own device token", async () => {
      const { user, token } = await createTestUser();
      const pushToken = "expo-push-token-toremove0001";
      await prisma.deviceToken.create({
        data: { userId: user.id, token: pushToken, platform: "ios" },
      });

      const res = await request(app)
        .post("/api/notifications/devices/unregister")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: pushToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Device unregistered");
      expect(res.body.data).toEqual({ ok: true });

      const remaining = await prisma.deviceToken.findUnique({
        where: { token: pushToken },
      });
      expect(remaining).toBeNull();
    });

    it("should not delete a token owned by another user", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const pushToken = "expo-push-token-otheruser001";
      await prisma.deviceToken.create({
        data: { userId: other.user.id, token: pushToken, platform: "android" },
      });

      const res = await request(app)
        .post("/api/notifications/devices/unregister")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ token: pushToken });

      // deleteMany is userId-guarded → no-op but still 200.
      expect(res.status).toBe(200);

      const remaining = await prisma.deviceToken.findUnique({
        where: { token: pushToken },
      });
      expect(remaining).not.toBeNull();
      expect(remaining?.userId).toBe(other.user.id);
    });

    it("should succeed (no-op) for an unknown token", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/notifications/devices/unregister")
        .set("Authorization", `Bearer ${token}`)
        .send({ token: "totally-unknown-token-xyz" });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ok: true });
    });

    it("should reject a missing token with 400", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/api/notifications/devices/unregister")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 when not authenticated", async () => {
      const res = await request(app)
        .post("/api/notifications/devices/unregister")
        .send({ token: "some-token" });
      expect(res.status).toBe(401);
    });
  });
});
