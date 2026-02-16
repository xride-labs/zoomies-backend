import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../config/auth.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  asyncHandler,
} from "../middlewares/validation.js";
import {
  requireAdmin,
  requireSuperAdmin,
  requireWebAccess,
  UserRole,
} from "../middlewares/rbac.js";
import {
  adminStatsQuerySchema,
  idParamSchema,
  updateUserRoleSchema,
  updateReportSchema,
} from "../validators/schemas.js";
import { runJobManually } from "../jobs/scheduler.js";

const router = Router();

// All admin routes require authentication and web access
router.use(requireAuth);
router.use(requireWebAccess);

/**
 * GET /api/admin/stats
 * Get platform-wide statistics (Super Admin only)
 */
router.get(
  "/stats",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const [
      totalUsers,
      totalRides,
      totalClubs,
      totalListings,
      activeRides,
      completedRides,
      verifiedClubs,
      recentUsers,
      recentRides,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.ride.count(),
      prisma.club.count(),
      prisma.marketplaceListing.count(),
      prisma.ride.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ride.count({ where: { status: "COMPLETED" } }),
      prisma.club.count({ where: { verified: true } }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.ride.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get user role breakdown from role assignments
    const usersByRole = await prisma.userRoleAssignment.groupBy({
      by: ["role"],
      _count: { role: true },
    });

    // Get rides by status
    const ridesByStatus = await prisma.ride.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    ApiResponse.success(res, {
      overview: {
        totalUsers,
        totalRides,
        totalClubs,
        totalListings,
        activeRides,
        completedRides,
        verifiedClubs,
      },
      recent: {
        newUsersLast7Days: recentUsers,
        newRidesLast7Days: recentRides,
      },
      breakdown: {
        usersByRole: (() => {
          const result: Record<string, number> = {};
          for (const item of usersByRole) {
            result[item.role] = item._count.role;
          }
          return result;
        })(),
        ridesByStatus: (() => {
          const result: Record<string, number> = {};
          for (const item of ridesByStatus) {
            result[item.status] = item._count.status;
          }
          return result;
        })(),
      },
    });
  }),
);

/**
 * GET /api/admin/users
 * Get all users with filters (Admin only)
 */
router.get(
  "/users",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, role, search } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (role) {
      where.userRoles = { some: { role } };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          phone: true,
          userRoles: { select: { role: true } },
          ridesCompleted: true,
          createdAt: true,
          _count: {
            select: { createdRides: true, createdClubs: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    // Flatten roles for response
    const usersWithRoles = users.map(({ userRoles, ...u }) => ({
      ...u,
      roles: userRoles.map((r) => r.role),
    }));

    ApiResponse.paginated(res, usersWithRoles, {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    });
  }),
);

/**
 * PATCH /api/admin/users/:id/role
 * Update user role
 */
router.patch(
  "/users/:id/role",
  validateParams(idParamSchema),
  validateBody(updateUserRoleSchema),
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    // Upsert the role assignment (add if missing, no-op if exists)
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: id, role } },
      create: { userId: id, role },
      update: {},
    });

    // Return user with all current roles
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        userRoles: { select: { role: true } },
      },
    });

    const roles = user?.userRoles.map((r) => r.role) ?? [];
    ApiResponse.success(
      res,
      { user: { id: user?.id, email: user?.email, name: user?.name, roles } },
      "User role updated successfully",
    );
  }),
);

/**
 * DELETE /api/admin/users/:id
 * Delete a user (Super Admin only)
 */
router.delete(
  "/users/:id",
  validateParams(idParamSchema),
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session;

    if (id === session.user.id) {
      return ApiResponse.error(
        res,
        "You cannot delete your own account",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    ApiResponse.success(res, null, "User deleted successfully");
  }),
);

/**
 * GET /api/admin/rides
 * Get all rides with filters
 */
router.get(
  "/rides",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status, creatorId } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (creatorId) where.creatorId = creatorId;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          creator: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { participants: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.count({ where }),
    ]);

    ApiResponse.paginated(res, rides, {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    });
  }),
);

/**
 * GET /api/admin/clubs
 * Get all clubs with filters
 */
router.get(
  "/clubs",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, verified, ownerId } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (verified !== undefined) where.verified = verified === "true";
    if (ownerId) where.ownerId = ownerId;

    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          owner: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.club.count({ where }),
    ]);

    ApiResponse.paginated(res, clubs, {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    });
  }),
);

/**
 * PATCH /api/admin/clubs/:id/verify
 * Verify or unverify a club
 */
router.patch(
  "/clubs/:id/verify",
  validateParams(idParamSchema),
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { verified } = req.body;

    const club = await prisma.club.update({
      where: { id },
      data: { verified: verified ?? true },
      select: {
        id: true,
        name: true,
        verified: true,
      },
    });

    ApiResponse.success(
      res,
      { club },
      `Club ${club.verified ? "verified" : "unverified"} successfully`,
    );
  }),
);

/**
 * POST /api/admin/jobs/:jobName/run
 * Run a background job manually
 */
router.post(
  "/jobs/:jobName/run",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobName } = req.params;

    try {
      const result = await runJobManually(jobName);
      ApiResponse.success(
        res,
        { result },
        `Job '${jobName}' executed successfully`,
      );
    } catch (error) {
      return ApiResponse.error(
        res,
        (error as Error).message,
        400,
        ErrorCode.INVALID_INPUT,
      );
    }
  }),
);

/**
 * GET /api/admin/reports
 * Get all reports with filters
 */
router.get(
  "/reports",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status, priority } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          reporter: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.report.count({ where }),
    ]);

    const formattedReports = reports.map((report) => ({
      id: report.id,
      type: report.type,
      title: report.title,
      description: report.description ?? undefined,
      reportedItem: {
        id: report.reportedItemId ?? "",
        name: report.reportedItemName ?? "",
        type: report.reportedItemType ?? report.type,
      },
      reporter: {
        id: report.reporter?.id ?? "",
        name: report.reporter?.name ?? "Unknown",
      },
      status: report.status,
      priority: report.priority,
      createdAt: report.createdAt.toISOString(),
    }));

    ApiResponse.paginated(res, formattedReports, {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    });
  }),
);

/**
 * PATCH /api/admin/reports/:id
 * Update report status/resolution
 */
router.patch(
  "/reports/:id",
  validateParams(idParamSchema),
  validateBody(updateReportSchema),
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const report = await prisma.report.update({
      where: { id },
      data: { status, resolution },
      include: {
        reporter: {
          select: { id: true, name: true },
        },
      },
    });

    ApiResponse.success(res, {
      report: {
        id: report.id,
        status: report.status,
        resolution: report.resolution,
        reporter: {
          id: report.reporter?.id ?? "",
          name: report.reporter?.name ?? "Unknown",
        },
      },
    });
  }),
);

/**
 * GET /api/admin/marketplace
 * Get all marketplace listings with filters
 */
router.get(
  "/marketplace",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, status, sellerId } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (sellerId) where.sellerId = sellerId;

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          seller: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    ApiResponse.paginated(res, listings, {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    });
  }),
);

export default router;
