import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import { requireAuth } from "../../config/auth.js";
import { ApiResponse } from "../../lib/utils/apiResponse.js";
import { asyncHandler } from "../../middlewares/validation.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const unreadOnly = req.query.unreadOnly === "true";
    const skip = (page - 1) * limit;

    const where = {
      userId: session.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Math.max(limit, 1),
      }),
      prisma.notification.count({ where }),
    ]);

    ApiResponse.paginated(res, items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const unread = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });

    ApiResponse.success(res, { unread });
  }),
);

router.patch(
  "/read-all",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const updated = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    ApiResponse.success(res, { updated: updated.count }, "Marked all as read");
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, isRead: true },
    });

    if (!notification || notification.userId !== session.user.id) {
      return ApiResponse.notFound(res, "Notification not found");
    }

    if (notification.isRead) {
      return ApiResponse.success(res, { id }, "Already read");
    }

    await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    ApiResponse.success(res, { id }, "Marked as read");
  }),
);

/**
 * Delete a single notification. Uses deleteMany with userId guard so a user
 * can never delete another user's notification (avoids a separate findUnique
 * + ownership check round-trip).
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    await prisma.notification.deleteMany({
      where: { id, userId: session.user.id },
    });

    ApiResponse.success(res, { ok: true });
  }),
);

/**
 * Clear all notifications for the authenticated user (e.g. "Clear all" button).
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;

    await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    });

    ApiResponse.success(res, { ok: true }, "All notifications cleared");
  }),
);

/**
 * Register (or refresh) a device push token. Idempotent — calling repeatedly
 * with the same token from the same user just bumps `lastSeenAt`. Tokens are
 * unique across the system, so re-registering a token previously owned by
 * another user transfers ownership (typical when a phone is wiped + reused).
 */
router.post(
  "/devices/register",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const userId = session.user.id;
    const { token, platform, deviceId, appVersion } = req.body ?? {};

    if (typeof token !== "string" || token.length < 10) {
      return ApiResponse.validationError(res, { token: "required" }, "Missing or invalid push token");
    }
    if (platform !== "ios" && platform !== "android") {
      return ApiResponse.validationError(res, { platform: "required" }, "platform must be 'ios' or 'android'");
    }

    await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        deviceId: typeof deviceId === "string" ? deviceId : null,
        appVersion: typeof appVersion === "string" ? appVersion : null,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId: typeof deviceId === "string" ? deviceId : null,
        appVersion: typeof appVersion === "string" ? appVersion : null,
      },
    });

    ApiResponse.success(res, { ok: true }, "Device registered");
  }),
);

/**
 * Unregister a token (called on logout). We don't 401 on unknown tokens —
 * the client may be retrying a previous unregister, and that's fine.
 */
router.post(
  "/devices/unregister",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { token } = req.body ?? {};
    if (typeof token !== "string") {
      return ApiResponse.validationError(res, { token: "required" }, "Missing token");
    }

    await prisma.deviceToken.deleteMany({
      where: { token, userId: session.user.id },
    });

    ApiResponse.success(res, { ok: true }, "Device unregistered");
  }),
);

export default router;
