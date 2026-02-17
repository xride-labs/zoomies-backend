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

function buildUserProfileResponse(user: any) {
  const roles = user.userRoles?.map((r: { role: string }) => r.role) ?? [];
  const xpPoints = user.xpPoints ?? 0;
  const nextLevelXp = (user.level + 1) * 250;
  const progressPercent = nextLevelXp
    ? Math.min(100, Math.round((xpPoints / nextLevelXp) * 100))
    : 0;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    dob: user.dob,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    phone: user.phone,
    coverImage: user.coverImage,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    bloodType: user.bloodType,
    ridesCompleted: user.rideStats?.totalRides ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: roles,
    experience: {
      xpPoints,
      level: user.level,
      levelTitle: user.levelTitle,
      nextLevelXp,
      progressPercent,
      reputationScore: user.reputationScore ?? 0,
      activityLevel: user.activityLevel,
    },
    bikes:
      user.bikes?.map((bike: any) => ({
        id: bike.id,
        make: bike.make,
        model: bike.model,
        year: bike.year,
        type: bike.type,
        engineCc: bike.engineCc,
        color: bike.color,
        odo: bike.odo,
        ownerSince: bike.ownerSince,
        modifications: bike.modifications,
        isPrimary: bike.isPrimary,
      })) ?? [],
    clubs:
      user.clubMemberships?.map((membership: any) => ({
        id: membership.club.id,
        name: membership.club.name,
        role: membership.role,
        joinedAt: membership.joinedAt,
        memberCount: membership.club.memberCount,
        logo: membership.club.image,
      })) ?? [],
    rideStats: user.rideStats
      ? {
          totalDistanceKm: user.rideStats.totalDistanceKm,
          longestRideKm: user.rideStats.longestRideKm,
          nightRides: user.rideStats.nightRides,
          weekendRides: user.rideStats.weekendRides,
        }
      : null,
    badges:
      user.badges?.map((userBadge: any) => ({
        id: userBadge.badge.id,
        title: userBadge.badge.title,
        auraPoints: userBadge.badge.auraPoints,
        icon: userBadge.badge.icon,
        earnedAt: userBadge.earnedAt,
      })) ?? [],
    social: {
      followers: user._count?.followers ?? 0,
      following: user._count?.following ?? 0,
      friends: user.friendsCount ?? 0,
    },
    safety: {
      emergencyContacts: {
        count: user.emergencyContacts?.length ?? 0,
        items: user.emergencyContacts ?? [],
      },
      helmetVerified: user.helmetVerified,
      lastSafetyCheck: user.lastSafetyCheck,
    },
    preferences: user.preferences,
  };
}

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
    if (role) {
      where.userRoles = { some: { role } };
    }
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
          avatar: true,
          bio: true,
          location: true,
          bloodType: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          xpPoints: true,
          level: true,
          levelTitle: true,
          activityLevel: true,
          reputationScore: true,
          userRoles: { select: { role: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithRoles = users.map(({ userRoles, ...u }) => ({
      ...u,
      roles: userRoles.map((r) => r.role),
    }));

    ApiResponse.paginated(res, usersWithRoles, {
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
      include: {
        userRoles: { select: { role: true } },
        bikes: true,
        badges: { include: { badge: true } },
        emergencyContacts: true,
        preferences: true,
        rideStats: true,
        clubMemberships: { include: { club: true } },
        _count: {
          select: {
            createdRides: true,
            createdClubs: true,
            followers: true,
            following: true,
            friendsInitiated: true,
            friendsReceived: true,
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

    const friendsCount =
      (user._count?.friendsInitiated ?? 0) +
      (user._count?.friendsReceived ?? 0);
    const userWithFriends = { ...user, friendsCount };
    ApiResponse.success(res, {
      user: buildUserProfileResponse(userWithFriends),
    });
  }),
);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Update a user
 *     description: Update user details. Can update own profile or admin can update any user. Profile images (avatar/cover) should be uploaded via /api/media/upload/profile endpoints and will be served via Cloudinary.
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               bloodType:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 description: Avatar URL (Cloudinary)
 *               coverImage:
 *                 type: string
 *                 format: uri
 *                 description: Cover image URL (Cloudinary)
 *               dob:
 *                 type: string
 *                 format: date-time
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not authorized to update this user
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
      // Check if requester has admin role
      const adminRole = await prisma.userRoleAssignment.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ["ADMIN"] },
        },
      });

      if (!adminRole) {
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
      bloodType,
      avatar,
      coverImage,
      dob,
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
        ...(bloodType !== undefined && { bloodType }),
        ...(avatar !== undefined && { avatar }),
        ...(coverImage !== undefined && { coverImage }),
        ...(dob !== undefined && { dob: new Date(dob) }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        coverImage: true,
        bio: true,
        location: true,
        bloodType: true,
        dob: true,
        phone: true,
        userRoles: { select: { role: true } },
        updatedAt: true,
      },
    });

    const { userRoles: updatedRoles, ...userData } = user;
    ApiResponse.success(
      res,
      { user: { ...userData, roles: updatedRoles.map((r) => r.role) } },
      "User updated successfully",
    );
  }),
);

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Update user role
 *     description: Add a role to a user. Requires ADMIN role.
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
 *       400:
 *         description: Invalid role
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires ADMIN role
 */
router.patch(
  "/:id/role",
  validateParams(idParamSchema),
  validateBody(updateUserRoleSchema),
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["ADMIN", "CLUB_OWNER", "RIDER", "SELLER"];
    if (!validRoles.includes(role)) {
      return ApiResponse.validationError(res, {
        role: [`Invalid role. Must be one of: ${validRoles.join(", ")}`],
      });
    }

    // Add the role (upsert to avoid duplicates)
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: id, role } },
      create: { userId: id, role },
      update: {},
    });

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
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Delete a user account. Can delete own account or admin can delete any user.
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
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not authorized to delete this user
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const isSelf = session.user.id === id;
    if (!isSelf) {
      const adminRole = await prisma.userRoleAssignment.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ["ADMIN"] },
        },
      });

      if (!adminRole) {
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
 * @swagger
 * /api/users/{id}/rides:
 *   get:
 *     summary: Get user's rides
 *     description: Get paginated list of rides created by a user.
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
 *     responses:
 *       200:
 *         description: Paginated list of user's rides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/users/{id}/clubs:
 *   get:
 *     summary: Get user's clubs
 *     description: Get list of clubs owned by a user.
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
 *     responses:
 *       200:
 *         description: List of user's clubs
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
 *                     clubs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Club'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
