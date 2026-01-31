import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../config/auth.js";

const router = Router();

// All marketplace routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/marketplace:
 *   get:
 *     summary: Get all marketplace listings
 *     description: Retrieve a paginated list of active marketplace listings with optional filters
 *     tags: [Marketplace]
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
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: List of marketplace listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MarketplaceListing'
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
    const category = req.query.category as string;
    const minPrice = req.query.minPrice
      ? parseFloat(req.query.minPrice as string)
      : undefined;
    const maxPrice = req.query.maxPrice
      ? parseFloat(req.query.maxPrice as string)
      : undefined;
    const skip = (page - 1) * limit;

    const where: any = { status: "ACTIVE" };
    if (category) where.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

/**
 * @swagger
 * /api/marketplace/my-listings:
 *   get:
 *     summary: Get current user's listings
 *     description: Retrieve a paginated list of marketplace listings created by the current user
 *     tags: [Marketplace]
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
 *         description: List of user's listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MarketplaceListing'
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
router.get("/my-listings", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where = { sellerId: session.user.id };

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my listings error:", error);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

/**
 * @swagger
 * /api/marketplace/{id}:
 *   get:
 *     summary: Get listing by ID
 *     description: Retrieve a single marketplace listing by its unique identifier
 *     tags: [Marketplace]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID
 *     responses:
 *       200:
 *         description: Listing details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listing:
 *                   $ref: '#/components/schemas/MarketplaceListing'
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

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json({ listing });
  } catch (error) {
    console.error("Get listing error:", error);
    res.status(500).json({ error: "Failed to get listing" });
  }
});

/**
 * @swagger
 * /api/marketplace:
 *   post:
 *     summary: Create a new listing
 *     description: Create a new marketplace listing with the provided details
 *     tags: [Marketplace]
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
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *                 example: Carbon Road Bike
 *               description:
 *                 type: string
 *                 example: Excellent condition, barely used
 *               price:
 *                 type: number
 *                 example: 2500.00
 *               currency:
 *                 type: string
 *                 default: USD
 *                 example: USD
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 example: ["https://example.com/bike1.jpg"]
 *               category:
 *                 type: string
 *                 example: Bikes
 *               condition:
 *                 type: string
 *                 example: Like New
 *     responses:
 *       201:
 *         description: Listing created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Listing created successfully
 *                 listing:
 *                   $ref: '#/components/schemas/MarketplaceListing'
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
    const { title, description, price, currency, images, category, condition } =
      req.body;

    if (!title || price === undefined) {
      return res.status(400).json({ error: "Title and price are required" });
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        title,
        description,
        price,
        currency: currency || "USD",
        images: images || [],
        category,
        condition,
        sellerId: session.user.id,
      },
    });

    res.status(201).json({
      message: "Listing created successfully",
      listing,
    });
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

/**
 * PATCH /api/marketplace/:id
 * Update a listing
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;
    const {
      title,
      description,
      price,
      currency,
      images,
      category,
      condition,
      status,
    } = req.body;

    // Check if listing exists and user is the seller
    const existingListing = await prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!existingListing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (existingListing.sellerId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only update your own listings" });
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(currency !== undefined && { currency }),
        ...(images !== undefined && { images }),
        ...(category !== undefined && { category }),
        ...(condition !== undefined && { condition }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({
      message: "Listing updated successfully",
      listing,
    });
  } catch (error) {
    console.error("Update listing error:", error);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

/**
 * DELETE /api/marketplace/:id
 * Delete a listing
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { id } = req.params;

    // Check if listing exists and user is the seller
    const existingListing = await prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!existingListing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (existingListing.sellerId !== session.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own listings" });
    }

    await prisma.marketplaceListing.delete({
      where: { id },
    });

    res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

export default router;
