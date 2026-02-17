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
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get platform statistics
 *     description: Get platform-wide statistics including user counts, ride stats, and activity metrics. Requires SUPER_ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         totalRides:
 *                           type: integer
 *                         totalClubs:
 *                           type: integer
 *                         totalListings:
 *                           type: integer
 *                         activeRides:
 *                           type: integer
 *                         completedRides:
 *                           type: integer
 *                         verifiedClubs:
 *                           type: integer
 *                     recent:
 *                       type: object
 *                       properties:
 *                         newUsersLast7Days:
 *                           type: integer
 *                         newRidesLast7Days:
 *                           type: integer
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         usersByRole:
 *                           type: object
 *                         ridesByStatus:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires SUPER_ADMIN role
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
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin)
 *     description: Get paginated list of all users with optional filters. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, CLUB_OWNER, RIDER, SELLER]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
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
          avatar: true,
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
 * @swagger
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     description: Add a role to a user. Requires SUPER_ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CLUB_OWNER, RIDER, SELLER]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires SUPER_ADMIN role
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Permanently delete a user account. Requires SUPER_ADMIN role. Cannot delete own account.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete own account
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires SUPER_ADMIN role
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/admin/rides:
 *   get:
 *     summary: Get all rides (admin)
 *     description: Get paginated list of all rides with filters. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNED, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - in: query
 *         name: creatorId
 *         schema:
 *           type: string
 *         description: Filter by creator ID
 *     responses:
 *       200:
 *         description: Paginated list of rides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
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
            select: { id: true, name: true, avatar: true },
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
 * @swagger
 * /api/admin/clubs:
 *   get:
 *     summary: Get all clubs (admin)
 *     description: Get paginated list of all clubs with filters. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of clubs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
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
            select: { id: true, name: true, avatar: true },
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
 * @swagger
 * /api/admin/clubs/{id}/verify:
 *   patch:
 *     summary: Verify or unverify a club
 *     description: Update club verification status. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Club ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verified:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Club verification status updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/admin/jobs/{jobName}/run:
 *   post:
 *     summary: Run background job manually
 *     description: Trigger a background job to run immediately. Requires SUPER_ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *         description: Job name to run
 *     responses:
 *       200:
 *         description: Job executed successfully
 *       400:
 *         description: Invalid job name
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires SUPER_ADMIN role
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
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Get all reports (admin)
 *     description: Get paginated list of user/content reports. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, REVIEWING, RESOLVED, DISMISSED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *     responses:
 *       200:
 *         description: Paginated list of reports
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
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
 * @swagger
 * /api/admin/reports/{id}:
 *   patch:
 *     summary: Update report status
 *     description: Update report status and resolution. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWING, RESOLVED, DISMISSED]
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/admin/marketplace:
 *   get:
 *     summary: Get all marketplace listings (admin)
 *     description: Get paginated list of all marketplace listings. Requires ADMIN role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SOLD, INACTIVE]
 *       - in: query
 *         name: sellerId
 *         schema:
 *           type: string
 *         description: Filter by seller ID
 *     responses:
 *       200:
 *         description: Paginated list of listings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
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
            select: { id: true, name: true, avatar: true },
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
