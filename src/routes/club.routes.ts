import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../config/auth.js";

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
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      prisma.club.findMany({
        where: { isPublic: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.club.count({ where: { isPublic: true } }),
    ]);

    res.json({
      clubs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get clubs error:", error);
    res.status(500).json({ error: "Failed to get clubs" });
  }
});

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
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
    });

    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }

    res.json({ club });
  } catch (error) {
    console.error("Get club error:", error);
    res.status(500).json({ error: "Failed to get club" });
  }
});

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
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { name, description, image, isPublic } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Club name is required" });
    }

    const club = await prisma.club.create({
      data: {
        name,
        description,
        image,
        isPublic: isPublic ?? true,
        ownerId: session.user.id,
      },
    });

    res.status(201).json({
      message: "Club created successfully",
      club,
    });
  } catch (error) {
    console.error("Create club error:", error);
    res.status(500).json({ error: "Failed to create club" });
  }
});

/**
 * PATCH /api/clubs/:id
 * Update a club
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;
    const { name, description, image, isPublic } = req.body;

    // Check if club exists and user is the owner
    const existingClub = await prisma.club.findUnique({
      where: { id },
    });

    if (!existingClub) {
      return res.status(404).json({ error: "Club not found" });
    }

    if (existingClub.ownerId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only update your own clubs" });
    }

    const club = await prisma.club.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    res.json({
      message: "Club updated successfully",
      club,
    });
  } catch (error) {
    console.error("Update club error:", error);
    res.status(500).json({ error: "Failed to update club" });
  }
});

/**
 * DELETE /api/clubs/:id
 * Delete a club
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;

    // Check if club exists and user is the owner
    const existingClub = await prisma.club.findUnique({
      where: { id },
    });

    if (!existingClub) {
      return res.status(404).json({ error: "Club not found" });
    }

    if (existingClub.ownerId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own clubs" });
    }

    await prisma.club.delete({
      where: { id },
    });

    res.json({ message: "Club deleted successfully" });
  } catch (error) {
    console.error("Delete club error:", error);
    res.status(500).json({ error: "Failed to delete club" });
  }
});

export default router;
