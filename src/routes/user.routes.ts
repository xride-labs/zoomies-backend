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
import { requireAdmin } from "../middlewares/rbac.js";
import {
  userQuerySchema,
  idParamSchema,
  updateUserSchema,
  updateUserRoleSchema,
} from "../validators/schemas.js";

const router = Router();

// All user routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a paginated list of all users
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/",
  validateQuery(userQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, role, search } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        where,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          image: true,
          bio: true,
          location: true,
          role: true,
          ridesCompleted: true,
          experienceLevel: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    ApiResponse.paginated(res, users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a single user by their unique identifier
 *     tags: [Users]
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
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        image: true,
        bio: true,
        location: true,
        role: true,
        bikeType: true,
        bikeOwned: true,
        ridesCompleted: true,
        experienceLevel: true,
        levelOfActivity: true,
        xpPoints: true,
        reputationScore: true,
        createdAt: true,
        _count: {
          select: {
            createdRides: true,
            createdClubs: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return ApiResponse.notFound(
        res,
        "User not found",
        ErrorCode.USER_NOT_FOUND,
      );
    }

    ApiResponse.success(res, { user });
  }),
);

/**
 * PATCH /api/users/:id
 * Update a user (self or admin)
 */
router.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const isSelf = session.user.id === id;
    if (!isSelf) {
      const requester = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!requester) {
        return ApiResponse.unauthorized(
          res,
          "User not found",
          ErrorCode.USER_NOT_FOUND,
        );
      }

      if (!["ADMIN", "SUPER_ADMIN"].includes(requester.role)) {
        return ApiResponse.forbidden(
          res,
          "You don't have permission to update this user",
        );
      }
    }

    const {
      email,
      username,
      name,
      bio,
      location,
      bikeType,
      bikeOwned,
      experienceLevel,
      levelOfActivity,
      bloodType,
      image,
      phone,
    } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(email !== undefined && { email }),
        ...(username !== undefined && { username }),
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(bikeType !== undefined && { bikeType }),
        ...(bikeOwned !== undefined && { bikeOwned }),
        ...(experienceLevel !== undefined && { experienceLevel }),
        ...(levelOfActivity !== undefined && { levelOfActivity }),
        ...(bloodType !== undefined && { bloodType }),
        ...(image !== undefined && { image }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        image: true,
        bio: true,
        location: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });

    ApiResponse.success(res, { user }, "User updated successfully");
  }),
);

/**
 * PATCH /api/users/:id/role
 * Update user role (admin only)
 */
router.patch(
  "/:id/role",
  validateParams(idParamSchema),
  validateBody(updateUserRoleSchema),
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "CLUB_OWNER",
      "USER",
      "RIDER",
      "SELLER",
    ];
    if (!validRoles.includes(role)) {
      return ApiResponse.validationError(res, {
        role: [`Invalid role. Must be one of: ${validRoles.join(", ")}`],
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    ApiResponse.success(res, { user }, "User role updated successfully");
  }),
);

/**
 * DELETE /api/users/:id
 * Delete a user (self or admin)
 */
router.delete(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const isSelf = session.user.id === id;
    if (!isSelf) {
      const requester = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!requester) {
        return ApiResponse.unauthorized(
          res,
          "User not found",
          ErrorCode.USER_NOT_FOUND,
        );
      }

      if (!["ADMIN", "SUPER_ADMIN"].includes(requester.role)) {
        return ApiResponse.forbidden(
          res,
          "You don't have permission to delete this user",
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      return ApiResponse.notFound(
        res,
        "User not found",
        ErrorCode.USER_NOT_FOUND,
      );
    }

    await prisma.user.delete({ where: { id } });

    ApiResponse.success(res, null, "User deleted successfully");
  }),
);

/**
 * GET /api/users/:id/rides
 * Get rides created by a user
 */
router.get(
  "/:id/rides",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { creatorId: id },
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { participants: true } },
        },
      }),
      prisma.ride.count({ where: { creatorId: id } }),
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
 * GET /api/users/:id/clubs
 * Get clubs created by a user
 */
router.get(
  "/:id/clubs",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const clubs = await prisma.club.findMany({
      where: { ownerId: id },
      include: {
        _count: { select: { members: true } },
      },
    });

    ApiResponse.success(res, { clubs });
  }),
);

export default router;
