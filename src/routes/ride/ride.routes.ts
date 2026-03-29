import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { requireAuth } from "../../config/auth.js";
import { ApiResponse, ErrorCode } from "../../lib/utils/apiResponse.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  asyncHandler,
} from "../../middlewares/validation.js";
import {
  requireOwnershipOrAdmin,
  requireRole,
  UserRole,
} from "../../middlewares/rbac.js";
import {
  createRideSchema,
  updateRideSchema,
  rideQuerySchema,
  idParamSchema,
  joinRideSchema,
  updateParticipantStatusSchema,
} from "../../validators/schemas.js";
import { sendRideJoinRequestEmail } from "../../lib/mailer.js";
import { ElevationService } from "../../services/elevation.service.js";

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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title, description or start location
 *       - in: query
 *         name: experienceLevel
 *         schema:
 *           type: string
 *           enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
 *         description: Filter by experience level
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter rides scheduled on or after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter rides scheduled on or before this date
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
    const { page, limit, status, experienceLevel, startDate, endDate, search } =
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
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { startLocation: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { id: true, name: true, avatar: true },
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
    const session = (req as any).session;
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatar: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
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

    // Include current user's participant status and pending request count for the creator
    let participantStatus: string | null = null;
    let pendingRequestCount = 0;

    if (session?.user?.id) {
      const myParticipation = ride.participants.find(
        (p: any) => p.user?.id === session.user.id,
      );
      participantStatus = myParticipation?.status || null;

      if (ride.creatorId === session.user.id) {
        pendingRequestCount = ride.participants.filter(
          (p: any) => p.status === "REQUESTED",
        ).length;
      }
    }

    ApiResponse.success(res, { ride, participantStatus, pendingRequestCount });
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
          select: { id: true, name: true, avatar: true },
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
 * @swagger
 * /api/rides/{id}:
 *   patch:
 *     summary: Update a ride
 *     description: Update ride details. Must be the ride creator or admin.
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startLocation:
 *                 type: string
 *               endLocation:
 *                 type: string
 *               distance:
 *                 type: number
 *               duration:
 *                 type: integer
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Ride updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not ride owner or admin
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    ApiResponse.success(res, { ride }, "Ride updated successfully");
  }),
);

/**
 * @swagger
 * /api/rides/{id}:
 *   delete:
 *     summary: Delete a ride
 *     description: Delete a ride. Must be the ride creator or admin.
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
 *     responses:
 *       200:
 *         description: Ride deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not ride owner or admin
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 * @swagger
 * /api/rides/{id}/join:
 *   post:
 *     summary: Request to join a ride
 *     description: Request to join a ride as a participant. Creates a REQUESTED status that needs to be approved by the ride creator.
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Optional message to ride creator
 *     responses:
 *       201:
 *         description: Join request submitted
 *       400:
 *         description: Ride already started or ended
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Already requested to join
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
      include: {
        creator: {
          select: { id: true, name: true, email: true },
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
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // if (ride.creator?.email && ride.creator.id !== session.user.id) {
    //   const requesterName = participant.user?.name || "A rider";
    //   try {
    //     await sendRideJoinRequestEmail({
    //       to: ride.creator.email,
    //       rideTitle: ride.title,
    //       requesterName,
    //       message: req.body?.message,
    //     });
    //   } catch (error) {
    //     console.warn("[Email] Ride join request email failed:", error);
    //   }
    // }

    ApiResponse.created(res, { participant }, "Join request submitted");
  }),
);

/**
 * @swagger
 * /api/rides/{id}/participants/{userId}:
 *   patch:
 *     summary: Update participant status
 *     description: Accept or decline a ride join request. Must be ride creator or admin.
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
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, DECLINED, CANCELLED]
 *     responses:
 *       200:
 *         description: Participant status updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Not ride owner or admin
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
          select: { id: true, name: true, avatar: true },
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
 * @swagger
 * /api/rides/{id}/leave:
 *   delete:
 *     summary: Leave a ride
 *     description: Leave a ride you have joined.
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
 *         description: Left ride successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Not a participant in this ride
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

/**
 * @swagger
 * /api/rides/{id}/tracking:
 *   post:
 *     summary: Upsert ride tracking metrics
 *     description: Stores or updates ride tracking data. Elevation gain is calculated server-side from route coordinates if not explicitly provided.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actualStartTime:
 *                 type: string
 *                 format: date-time
 *               actualEndTime:
 *                 type: string
 *                 format: date-time
 *               totalDurationMin:
 *                 type: integer
 *               totalDistanceKm:
 *                 type: number
 *               maxSpeedKmh:
 *                 type: number
 *               avgSpeedKmh:
 *                 type: number
 *               elevationGainM:
 *                 type: number
 *               routeGeoJson:
 *                 type: string
 *                 description: GeoJSON LineString payload as string
 *     responses:
 *       200:
 *         description: Tracking data saved
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Only creator/admin/participant can update tracking
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/tracking",
  validateParams(idParamSchema),
  validateBody(
    z.object({
      actualStartTime: z.string().datetime().optional().nullable(),
      actualEndTime: z.string().datetime().optional().nullable(),
      totalDurationMin: z.number().int().min(0).optional(),
      totalDistanceKm: z.number().min(0).optional(),
      maxSpeedKmh: z.number().min(0).optional(),
      avgSpeedKmh: z.number().min(0).optional(),
      elevationGainM: z.number().min(0).optional().nullable(),
      routeGeoJson: z.string().optional().nullable(),
      weatherNotes: z.string().max(500).optional(),
      riderNotes: z.string().max(5000).optional(),
      conditions: z.string().max(200).optional(),
    }),
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id },
      select: {
        id: true,
        creatorId: true,
        participants: {
          where: { userId: session.user.id },
          select: { status: true },
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

    const isCreator = ride.creatorId === session.user.id;
    const isAcceptedParticipant = ride.participants.some(
      (p: { status: string }) => p.status === "ACCEPTED",
    );

    if (!isCreator && !isAcceptedParticipant) {
      return ApiResponse.forbidden(
        res,
        "Only ride participants can update tracking",
      );
    }

    const resolvedElevationGain = ElevationService.resolveElevationGain({
      elevationGainM: req.body.elevationGainM,
      routeGeoJson: req.body.routeGeoJson,
    });

    const trackingData = await prisma.rideTrackingData.upsert({
      where: { rideId: id },
      create: {
        rideId: id,
        actualStartTime: req.body.actualStartTime
          ? new Date(req.body.actualStartTime)
          : null,
        actualEndTime: req.body.actualEndTime
          ? new Date(req.body.actualEndTime)
          : null,
        totalDurationMin: req.body.totalDurationMin,
        totalDistanceKm: req.body.totalDistanceKm,
        maxSpeedKmh: req.body.maxSpeedKmh,
        avgSpeedKmh: req.body.avgSpeedKmh,
        elevationGainM: resolvedElevationGain,
        routeGeoJson: req.body.routeGeoJson,
        weatherNotes: req.body.weatherNotes,
        riderNotes: req.body.riderNotes,
        conditions: req.body.conditions,
      },
      update: {
        actualStartTime: req.body.actualStartTime
          ? new Date(req.body.actualStartTime)
          : undefined,
        actualEndTime: req.body.actualEndTime
          ? new Date(req.body.actualEndTime)
          : undefined,
        totalDurationMin: req.body.totalDurationMin,
        totalDistanceKm: req.body.totalDistanceKm,
        maxSpeedKmh: req.body.maxSpeedKmh,
        avgSpeedKmh: req.body.avgSpeedKmh,
        elevationGainM: resolvedElevationGain ?? undefined,
        routeGeoJson: req.body.routeGeoJson,
        weatherNotes: req.body.weatherNotes,
        riderNotes: req.body.riderNotes,
        conditions: req.body.conditions,
      },
    });

    ApiResponse.success(res, {
      trackingData,
      elevationComputed: req.body.elevationGainM == null,
    });
  }),
);

/**
 * @swagger
 * /api/rides/{id}/invite:
 *   post:
 *     summary: Invite users to a ride
 *     description: Send invitations to multiple users for a specific ride. Only the ride creator can invite. Creates REQUESTED RideParticipant records and sends Notifications.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to invite
 *               message:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional custom invitation message
 *     responses:
 *       200:
 *         description: Invitations sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invitations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RideParticipant'
 *                 notificationsSent:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Only ride creator can send invitations
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/:id/invite",
  validateParams(idParamSchema),
  validateBody(
    z.object({
      userIds: z.array(z.string()).min(1).max(50),
      message: z.string().max(500).optional(),
    }),
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;
    const { userIds, message } = req.body as {
      userIds: string[];
      message?: string;
    };

    // Verify ride exists and user is creator
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    if (!ride) {
      return ApiResponse.notFound(
        res,
        "Ride not found",
        ErrorCode.RIDE_NOT_FOUND,
      );
    }

    if (ride.creatorId !== session.user.id) {
      return ApiResponse.forbidden(
        res,
        "Only the ride creator can send invitations",
      );
    }

    if (ride.status !== "PLANNED") {
      return ApiResponse.error(
        res,
        "Cannot invite users to a ride that has already started",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Create REQUESTED RideParticipant records for each user
    const invitations = await Promise.all(
      userIds.map((userId) =>
        prisma.rideParticipant.upsert({
          where: { rideId_userId: { rideId: id, userId } },
          create: {
            rideId: id,
            userId,
            status: "REQUESTED",
          },
          update: {
            status: "REQUESTED", // Resend if previously declined
          },
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        }),
      ),
    );

    // Create Notification records for each invited user
    const notifications = await Promise.all(
      userIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: "RIDE_INVITE",
            title: `You're invited to ${ride.title}`,
            message:
              message || `${session.user.name} invited you to join their ride`,
            relatedType: "ride",
            relatedId: id,
            sentViaPush: true,
          },
        }),
      ),
    );

    // Emit Socket.IO event to invited users (if IO instance available)
    const io = (req as any).io;
    if (io) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("ride-invite-received", {
          rideId: id,
          rideName: ride.title,
          creatorName: session.user.name,
          creatorAvatar: session.user.avatar,
          message,
          timestamp: new Date().toISOString(),
        });
      });
    }

    ApiResponse.success(res, {
      invitations,
      notificationsSent: notifications.length,
    });
  }),
);

export default router;
