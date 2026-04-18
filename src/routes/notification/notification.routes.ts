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

export default router;
