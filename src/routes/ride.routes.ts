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
  requireRole,
  UserRole,
} from "../middlewares/rbac.js";
import {
  createRideSchema,
  updateRideSchema,
  rideQuerySchema,
  idParamSchema,
  joinRideSchema,
  updateParticipantStatusSchema,
} from "../validators/schemas.js";

const router = Router();

// All ride routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/rides:
 *   get:
 *     summary: Get all rides
 *     description: Retrieve a paginated list of rides with optional status filter
 *     tags: [Rides]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNED, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: Filter by ride status
 *     responses:
 *       200:
 *         description: List of rides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rides:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ride'
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
  validateQuery(rideQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, experienceLevel, startDate, endDate } =
      req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (experienceLevel) where.experienceLevel = experienceLevel;
    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { participants: true } },
        },
      }),
      prisma.ride.count({ where }),
    ]);

    ApiResponse.paginated(res, rides, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

/**
 * @swagger
 * /api/rides/{id}:
 *   get:
 *     summary: Get ride by ID
 *     description: Retrieve a single ride by its unique identifier
 *     tags: [Rides]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ride ID
 *     responses:
 *       200:
 *         description: Ride details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ride:
 *                   $ref: '#/components/schemas/Ride'
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

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, image: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });

    if (!ride) {
      return ApiResponse.notFound(
        res,
        "Ride not found",
        ErrorCode.RIDE_NOT_FOUND,
      );
    }

    ApiResponse.success(res, { ride });
  }),
);

/**
 * @swagger
 * /api/rides:
 *   post:
 *     summary: Create a new ride
 *     description: Create a new ride with the provided details
 *     tags: [Rides]
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
 *               - title
 *               - startLocation
 *             properties:
 *               title:
 *                 type: string
 *                 example: Morning Coastal Ride
 *               description:
 *                 type: string
 *                 example: A beautiful morning ride along the coast
 *               startLocation:
 *                 type: string
 *                 example: San Francisco, CA
 *               endLocation:
 *                 type: string
 *                 example: Half Moon Bay, CA
 *               distance:
 *                 type: number
 *                 example: 45.5
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes
 *                 example: 120
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Ride created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ride created successfully
 *                 ride:
 *                   $ref: '#/components/schemas/Ride'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/",
  validateBody(createRideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const {
      title,
      description,
      startLocation,
      endLocation,
      experienceLevel,
      xpRequired,
      pace,
      distance,
      duration,
      scheduledAt,
      keepPermanently,
    } = req.body;

    const ride = await prisma.ride.create({
      data: {
        title,
        description,
        startLocation,
        endLocation,
        experienceLevel,
        xpRequired,
        pace,
        distance,
        duration,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        keepPermanently: keepPermanently || false,
        creatorId: session.user.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Automatically add creator as participant
    await prisma.rideParticipant.create({
      data: {
        rideId: ride.id,
        userId: session.user.id,
        status: "ACCEPTED",
      },
    });

    ApiResponse.created(res, { ride }, "Ride created successfully");
  }),
);

/**
 * PATCH /api/rides/:id
 * Update a ride
 */
router.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(updateRideSchema),
  requireOwnershipOrAdmin("ride"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      title,
      description,
      startLocation,
      endLocation,
      experienceLevel,
      xpRequired,
      pace,
      distance,
      duration,
      scheduledAt,
      keepPermanently,
    } = req.body;

    const ride = await prisma.ride.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startLocation !== undefined && { startLocation }),
        ...(endLocation !== undefined && { endLocation }),
        ...(experienceLevel !== undefined && { experienceLevel }),
        ...(xpRequired !== undefined && { xpRequired }),
        ...(pace !== undefined && { pace }),
        ...(distance !== undefined && { distance }),
        ...(duration !== undefined && { duration }),
        ...(scheduledAt !== undefined && {
          scheduledAt: new Date(scheduledAt),
        }),
        ...(keepPermanently !== undefined && { keepPermanently }),
      },
      include: {
        creator: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    ApiResponse.success(res, { ride }, "Ride updated successfully");
  }),
);

/**
 * DELETE /api/rides/:id
 * Delete a ride
 */
router.delete(
  "/:id",
  validateParams(idParamSchema),
  requireOwnershipOrAdmin("ride"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Delete participants first
    await prisma.rideParticipant.deleteMany({
      where: { rideId: id },
    });

    await prisma.ride.delete({
      where: { id },
    });

    ApiResponse.success(res, null, "Ride deleted successfully");
  }),
);

/**
 * POST /api/rides/:id/join
 * Request to join a ride
 */
router.post(
  "/:id/join",
  validateParams(idParamSchema),
  validateBody(joinRideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id },
    });

    if (!ride) {
      return ApiResponse.notFound(
        res,
        "Ride not found",
        ErrorCode.RIDE_NOT_FOUND,
      );
    }

    if (ride.status !== "PLANNED") {
      return ApiResponse.error(
        res,
        "Cannot join a ride that has already started or ended",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Check if already a participant
    const existing = await prisma.rideParticipant.findUnique({
      where: { rideId_userId: { rideId: id, userId: session.user.id } },
    });

    if (existing) {
      return ApiResponse.conflict(
        res,
        "You have already requested to join this ride",
      );
    }

    const participant = await prisma.rideParticipant.create({
      data: {
        rideId: id,
        userId: session.user.id,
        status: "REQUESTED",
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    ApiResponse.created(res, { participant }, "Join request submitted");
  }),
);

/**
 * PATCH /api/rides/:id/participants/:userId
 * Update participant status (accept/decline)
 */
router.patch(
  "/:id/participants/:userId",
  validateParams(idParamSchema.extend({ userId: idParamSchema.shape.id })),
  validateBody(updateParticipantStatusSchema),
  requireOwnershipOrAdmin("ride"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id, userId } = req.params;
    const { status } = req.body;

    const participant = await prisma.rideParticipant.update({
      where: { rideId_userId: { rideId: id, userId } },
      data: { status },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    ApiResponse.success(
      res,
      { participant },
      `Participant ${status.toLowerCase()}`,
    );
  }),
);

/**
 * DELETE /api/rides/:id/leave
 * Leave a ride
 */
router.delete(
  "/:id/leave",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const participant = await prisma.rideParticipant.findUnique({
      where: { rideId_userId: { rideId: id, userId: session.user.id } },
    });

    if (!participant) {
      return ApiResponse.notFound(
        res,
        "You are not a participant in this ride",
      );
    }

    await prisma.rideParticipant.delete({
      where: { rideId_userId: { rideId: id, userId: session.user.id } },
    });

    ApiResponse.success(res, null, "Left ride successfully");
  }),
);

export default router;
