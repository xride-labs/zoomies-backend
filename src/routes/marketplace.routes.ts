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
import { requireOwnershipOrAdmin } from "../middlewares/rbac.js";
import {
  createListingSchema,
  updateListingSchema,
  listingQuerySchema,
  idParamSchema,
  createReviewSchema,
  paginationSchema,
} from "../validators/schemas.js";

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
router.get(
  "/",
  validateQuery(listingQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, category, minPrice, maxPrice, condition, status } =
      req.query as any;
    const skip = (page - 1) * limit;

    const where: any = { status: status || "ACTIVE" };
    if (category) where.category = category;
    if (condition) where.condition = condition;
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
        include: {
          seller: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    ApiResponse.paginated(res, listings, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

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
router.get(
  "/my-listings",
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { page, limit } = req.query as any;
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

    ApiResponse.paginated(res, listings, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

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
router.get(
  "/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, image: true, reputationScore: true },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, image: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!listing) {
      return ApiResponse.notFound(
        res,
        "Listing not found",
        ErrorCode.LISTING_NOT_FOUND,
      );
    }

    ApiResponse.success(res, { listing });
  }),
);

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
router.post(
  "/",
  validateBody(createListingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const {
      title,
      description,
      price,
      currency,
      images,
      category,
      subcategory,
      specifications,
      condition,
    } = req.body;

    const listing = await prisma.marketplaceListing.create({
      data: {
        title,
        description,
        price,
        currency: currency || "INR",
        images: images || [],
        category,
        subcategory,
        specifications,
        condition,
        sellerId: session.user.id,
      },
      include: {
        seller: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Ensure user has SELLER role
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: session.user.id, role: "SELLER" } },
      create: { userId: session.user.id, role: "SELLER" },
      update: {},
    });

    ApiResponse.created(res, { listing }, "Listing created successfully");
  }),
);

/**
 * PATCH /api/marketplace/:id
 * Update a listing
 */
router.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(updateListingSchema),
  requireOwnershipOrAdmin("listing"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      currency,
      images,
      category,
      subcategory,
      specifications,
      condition,
      status,
    } = req.body;

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(currency !== undefined && { currency }),
        ...(images !== undefined && { images }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(specifications !== undefined && { specifications }),
        ...(condition !== undefined && { condition }),
        ...(status !== undefined && { status }),
      },
      include: {
        seller: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    ApiResponse.success(res, { listing }, "Listing updated successfully");
  }),
);

/**
 * DELETE /api/marketplace/:id
 * Delete a listing
 */
router.delete(
  "/:id",
  validateParams(idParamSchema),
  requireOwnershipOrAdmin("listing"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Delete reviews first
    await prisma.review.deleteMany({
      where: { listingId: id },
    });

    await prisma.marketplaceListing.delete({
      where: { id },
    });

    ApiResponse.success(res, null, "Listing deleted successfully");
  }),
);

/**
 * POST /api/marketplace/:id/reviews
 * Add a review to a listing
 */
router.post(
  "/:id/reviews",
  validateParams(idParamSchema),
  validateBody(createReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Check if listing exists
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      return ApiResponse.notFound(
        res,
        "Listing not found",
        ErrorCode.LISTING_NOT_FOUND,
      );
    }

    // Can't review own listing
    if (listing.sellerId === session.user.id) {
      return ApiResponse.error(
        res,
        "You cannot review your own listing",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: {
        listingId_reviewerId: { listingId: id, reviewerId: session.user.id },
      },
    });

    if (existingReview) {
      return ApiResponse.conflict(
        res,
        "You have already reviewed this listing",
      );
    }

    const review = await prisma.review.create({
      data: {
        listingId: id,
        reviewerId: session.user.id,
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    ApiResponse.created(res, { review }, "Review added successfully");
  }),
);

export default router;
