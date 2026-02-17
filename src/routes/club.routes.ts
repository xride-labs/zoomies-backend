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
  requireOwnershipOrAdmin,
  requireClubMembership,
  UserRole,
} from "../middlewares/rbac.js";
import {
  createClubSchema,
  updateClubSchema,
  clubQuerySchema,
  idParamSchema,
  updateMemberRoleSchema,
} from "../validators/schemas.js";
import { sendClubJoinEmail } from "../lib/mailer.js";

const router = Router();

// All club routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/clubs:
 *   get:
 *     summary: Get all clubs
 *     description: Retrieve a paginated list of public clubs
 *     tags: [Clubs]
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
 *         description: List of clubs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clubs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Club'
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
  validateQuery(clubQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, isPublic, verified, search } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isPublic !== undefined) where.isPublic = isPublic;
    if (verified !== undefined) where.verified = verified;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: { id: true, name: true, avatar: true },
          },
          _count: { select: { members: true } },
        },
      }),
      prisma.club.count({ where }),
    ]);

    ApiResponse.paginated(res, clubs, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

/**
 * @swagger
 * /api/clubs/{id}:
 *   get:
 *     summary: Get club by ID
 *     description: Retrieve a single club by its unique identifier
 *     tags: [Clubs]
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
 *     responses:
 *       200:
 *         description: Club details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 club:
 *                   $ref: '#/components/schemas/Club'
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

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { joinedAt: "desc" },
          take: 20,
        },
        _count: { select: { members: true } },
      },
    });

    if (!club) {
      return ApiResponse.notFound(
        res,
        "Club not found",
        ErrorCode.CLUB_NOT_FOUND,
      );
    }

    ApiResponse.success(res, { club });
  }),
);

/**
 * @swagger
 * /api/clubs:
 *   post:
 *     summary: Create a new club
 *     description: Create a new club with the provided details
 *     tags: [Clubs]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Bay Area Riders
 *               description:
 *                 type: string
 *                 example: A community for cycling enthusiasts
 *               image:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/club-image.jpg
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Club created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Club created successfully
 *                 club:
 *                   $ref: '#/components/schemas/Club'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/",
  validateBody(createClubSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const {
      name,
      description,
      location,
      clubType,
      isPublic,
      image,
      coverImage,
    } = req.body;

    const club = await prisma.club.create({
      data: {
        name,
        description,
        location,
        clubType,
        image,
        coverImage,
        isPublic: isPublic ?? true,
        ownerId: session.user.id,
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Add owner as FOUNDER member
    await prisma.clubMember.create({
      data: {
        clubId: club.id,
        userId: session.user.id,
        role: "FOUNDER",
      },
    });

    // Ensure user has CLUB_OWNER role
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: session.user.id, role: "CLUB_OWNER" } },
      create: { userId: session.user.id, role: "CLUB_OWNER" },
      update: {},
    });

    ApiResponse.created(res, { club }, "Club created successfully");
  }),
);

/**
 * @swagger
 * /api/clubs/{id}:
 *   patch:
 *     summary: Update a club
 *     description: Update club details. Must be club owner or admin. Club images (logo/cover) should be uploaded via /api/media/upload/club/{clubId} endpoint and will be served via Cloudinary.
 *     tags: [Clubs]
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
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               clubType:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: uri
 *                 description: Club logo URL (Cloudinary)
 *               coverImage:
 *                 type: string
 *                 format: uri
 *                 description: Club cover URL (Cloudinary)
 *     responses:
 *       200:
 *         description: Club updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not club owner or admin
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(updateClubSchema),
  requireOwnershipOrAdmin("club"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      name,
      description,
      location,
      clubType,
      isPublic,
      image,
      coverImage,
    } = req.body;

    const club = await prisma.club.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(clubType !== undefined && { clubType }),
        ...(image !== undefined && { image }),
        ...(coverImage !== undefined && { coverImage }),
        ...(isPublic !== undefined && { isPublic }),
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    ApiResponse.success(res, { club }, "Club updated successfully");
  }),
);

/**
 * @swagger
 * /api/clubs/{id}:
 *   delete:
 *     summary: Delete a club
 *     description: Delete a club and all its members. Must be club owner or admin.
 *     tags: [Clubs]
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
 *         description: Club deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not club owner or admin
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id",
  validateParams(idParamSchema),
  requireOwnershipOrAdmin("club"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Delete members first
    await prisma.clubMember.deleteMany({
      where: { clubId: id },
    });

    await prisma.club.delete({
      where: { id },
    });

    ApiResponse.success(res, null, "Club deleted successfully");
  }),
);

/**
 * @swagger
 * /api/clubs/{id}/join:
 *   post:
 *     summary: Join a club
 *     description: Join a public club as a member.
 *     tags: [Clubs]
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
 *     responses:
 *       201:
 *         description: Joined club successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Club is private
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Already a member
 */
router.post(
  "/:id/join",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!club) {
      return ApiResponse.notFound(
        res,
        "Club not found",
        ErrorCode.CLUB_NOT_FOUND,
      );
    }

    if (!club.isPublic) {
      return ApiResponse.forbidden(
        res,
        "This club is private. Request an invitation from the owner.",
      );
    }

    // Check if already a member
    const existing = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: session.user.id } },
    });

    if (existing) {
      return ApiResponse.conflict(res, "You are already a member of this club");
    }

    const membership = await prisma.clubMember.create({
      data: {
        clubId: id,
        userId: session.user.id,
        role: "MEMBER",
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Update member count
    await prisma.club.update({
      where: { id },
      data: { memberCount: { increment: 1 } },
    });

    // if (club.owner?.email && club.owner.id !== session.user.id) {
    //   const memberName = membership.user?.name || "A new member";
    //   try {
    //     await sendClubJoinEmail({
    //       to: club.owner.email,
    //       clubName: club.name,
    //       memberName,
    //     });
    //   } catch (error) {
    //     console.warn("[Email] Club join email failed:", error);
    //   }
    // }

    ApiResponse.created(res, { membership }, "Joined club successfully");
  }),
);

/**
 * @swagger
 * /api/clubs/{id}/leave:
 *   delete:
 *     summary: Leave a club
 *     description: Leave a club you have joined. Founders cannot leave - they must transfer ownership or delete the club.
 *     tags: [Clubs]
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
 *     responses:
 *       200:
 *         description: Left club successfully
 *       400:
 *         description: Founders cannot leave
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Not a member of this club
 */
router.delete(
  "/:id/leave",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: session.user.id } },
    });

    if (!membership) {
      return ApiResponse.notFound(res, "You are not a member of this club");
    }

    if (membership.role === "FOUNDER") {
      return ApiResponse.error(
        res,
        "Club founders cannot leave. Transfer ownership or delete the club.",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    await prisma.clubMember.delete({
      where: { clubId_userId: { clubId: id, userId: session.user.id } },
    });

    // Update member count
    await prisma.club.update({
      where: { id },
      data: { memberCount: { decrement: 1 } },
    });

    ApiResponse.success(res, null, "Left club successfully");
  }),
);

/**
 * @swagger
 * /api/clubs/{id}/members/{userId}:
 *   patch:
 *     summary: Update member role
 *     description: Update a club member's role. Requires club ADMIN role.
 *     tags: [Clubs]
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
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member user ID
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
 *                 enum: [MEMBER, OFFICER, ADMIN]
 *     responses:
 *       200:
 *         description: Member role updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires club ADMIN role
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/:id/members/:userId",
  validateParams(idParamSchema.extend({ userId: idParamSchema.shape.id })),
  validateBody(updateMemberRoleSchema),
  requireClubMembership("ADMIN", "id"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id, userId } = req.params;
    const { role } = req.body;

    const membership = await prisma.clubMember.update({
      where: { clubId_userId: { clubId: id, userId } },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    ApiResponse.success(res, { membership }, `Member role updated to ${role}`);
  }),
);

/**
 * @swagger
 * /api/clubs/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from club
 *     description: Remove a member from the club. Requires club ADMIN role. Cannot remove founders.
 *     tags: [Clubs]
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
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member user ID
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: Cannot remove yourself
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Requires club ADMIN role or cannot remove founder
 *       404:
 *         description: Member not found
 */
router.delete(
  "/:id/members/:userId",
  validateParams(idParamSchema.extend({ userId: idParamSchema.shape.id })),
  requireClubMembership("ADMIN", "id"),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id, userId } = req.params;

    if (userId === session.user.id) {
      return ApiResponse.error(
        res,
        "You cannot remove yourself. Use the leave endpoint instead.",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId } },
    });

    if (!membership) {
      return ApiResponse.notFound(res, "Member not found");
    }

    if (membership.role === "FOUNDER") {
      return ApiResponse.forbidden(res, "Cannot remove the club founder");
    }

    await prisma.clubMember.delete({
      where: { clubId_userId: { clubId: id, userId } },
    });

    // Update member count
    await prisma.club.update({
      where: { id },
      data: { memberCount: { decrement: 1 } },
    });

    ApiResponse.success(res, null, "Member removed successfully");
  }),
);

export default router;
