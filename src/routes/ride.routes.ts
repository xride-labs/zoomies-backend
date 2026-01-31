import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../config/auth.js";

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
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where = status ? { status: status as any } : {};

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ride.count({ where }),
    ]);

    res.json({
      rides,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get rides error:", error);
    res.status(500).json({ error: "Failed to get rides" });
  }
});

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
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ride = await prisma.ride.findUnique({
      where: { id },
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    res.json({ ride });
  } catch (error) {
    console.error("Get ride error:", error);
    res.status(500).json({ error: "Failed to get ride" });
  }
});

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
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const {
      title,
      description,
      startLocation,
      endLocation,
      distance,
      duration,
      scheduledAt,
    } = req.body;

    if (!title || !startLocation) {
      return res
        .status(400)
        .json({ error: "Title and start location are required" });
    }

    const ride = await prisma.ride.create({
      data: {
        title,
        description,
        startLocation,
        endLocation,
        distance,
        duration,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        creatorId: session.user.id,
      },
    });

    res.status(201).json({
      message: "Ride created successfully",
      ride,
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({ error: "Failed to create ride" });
  }
});

/**
 * PATCH /api/rides/:id
 * Update a ride
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;
    const {
      title,
      description,
      startLocation,
      endLocation,
      distance,
      duration,
      scheduledAt,
      status,
    } = req.body;

    // Check if ride exists and user is the creator
    const existingRide = await prisma.ride.findUnique({
      where: { id },
    });

    if (!existingRide) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (existingRide.creatorId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only update your own rides" });
    }

    const ride = await prisma.ride.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startLocation !== undefined && { startLocation }),
        ...(endLocation !== undefined && { endLocation }),
        ...(distance !== undefined && { distance }),
        ...(duration !== undefined && { duration }),
        ...(scheduledAt !== undefined && {
          scheduledAt: new Date(scheduledAt),
        }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({
      message: "Ride updated successfully",
      ride,
    });
  } catch (error) {
    console.error("Update ride error:", error);
    res.status(500).json({ error: "Failed to update ride" });
  }
});

/**
 * DELETE /api/rides/:id
 * Delete a ride
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;

    // Check if ride exists and user is the creator
    const existingRide = await prisma.ride.findUnique({
      where: { id },
    });

    if (!existingRide) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (existingRide.creatorId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own rides" });
    }

    await prisma.ride.delete({
      where: { id },
    });

    res.json({ message: "Ride deleted successfully" });
  } catch (error) {
    console.error("Delete ride error:", error);
    res.status(500).json({ error: "Failed to delete ride" });
  }
});

export default router;
