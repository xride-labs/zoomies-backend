import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma.js";
import { requireAuth } from "../../config/auth.js";
import { ApiResponse } from "../../lib/utils/apiResponse.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  asyncHandler,
} from "../../middlewares/validation.js";
import { requireAdmin } from "../../middlewares/rbac.js";

/**.
 * These give the admin panel full read/write access without forcing each
 * action to go through the user-facing endpoints (which gate by ownership
 * and verification status).
 */

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

const idParamSchema = z.object({ id: z.string().min(1) });

const websiteUrlSchema = z
  .preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }, z.string().url())
  .optional()
  .nullable();

// ─── Businesses ─────────────────────────────────────────────────────────────

const businessQuerySchema = z.object({
  status: z.enum(["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  category: z
    .enum([
      "BRAND",
      "GEAR_SELLER",
      "HELMET_SELLER",
      "PARTS_SELLER",
      "MARKETPLACE_SELLER",
      "CLUB",
      "SERVICE_STORE",
      "MECHANIC",
      "CONSULTATION",
    ])
    .optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const adminBusinessUpdateSchema = z.object({
  category: businessQuerySchema.shape.category.optional(),
  displayName: z.string().min(2).max(100).optional(),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  websiteUrl: websiteUrlSchema,
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  pricingTier: z.enum(["BASIC", "PRO", "ENTERPRISE"]).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
  verification: businessQuerySchema.shape.status.optional(),
  verificationNotes: z.string().max(1000).optional().nullable(),
});

router.get(
  "/businesses",
  validateQuery(businessQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, category, search, page, limit } =
      req.query as unknown as z.infer<typeof businessQuerySchema>;

    const where: any = {};
    if (status) where.verification = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.businessProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { id: true, name: true, email: true } } },
      }),
      prisma.businessProfile.count({ where }),
    ]);

    ApiResponse.paginated(res, items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

router.get(
  "/businesses/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const business = await prisma.businessProfile.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        campaigns: { orderBy: { createdAt: "desc" } },
        discounts: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!business) return ApiResponse.notFound(res, "Business not found");
    ApiResponse.success(res, business);
  }),
);

router.patch(
  "/businesses/:id",
  validateParams(idParamSchema),
  validateBody(adminBusinessUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = await prisma.businessProfile.update({
      where: { id },
      data: req.body,
    });
    ApiResponse.success(res, updated, "Business updated");
  }),
);

router.delete(
  "/businesses/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // Cascade rules on the schema drop campaigns + discounts automatically.
    await prisma.businessProfile.delete({ where: { id } });
    ApiResponse.success(res, null, "Business deleted");
  }),
);

// ─── Ad campaigns ──────────────────────────────────────────────────────────

const adQuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "PENDING_APPROVAL",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "REJECTED",
    ])
    .optional(),
  businessId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const adminAdUpdateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  ctaLabel: z.string().min(1).max(40).optional(),
  ctaUrl: z.string().url().optional().nullable(),
  deepLink: z.string().max(200).optional().nullable(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  budgetPaise: z.number().int().min(0).optional(),
  status: adQuerySchema.shape.status.optional(),
  slots: z
    .array(
      z.enum([
        "HOME_FEED",
        "DISCOVER_TOP",
        "MARKETPLACE_INLINE",
        "CHAT_LIST_TOP",
        "POST_RIDE_SUMMARY",
      ]),
    )
    .optional(),
  targetTags: z.array(z.string().max(40)).max(20).optional(),
  impressionCap: z.number().int().min(1).optional().nullable(),
  reviewNotes: z.string().max(2000).optional().nullable(),
});

const reviewActionSchema = z.object({
  notes: z.string().max(2000).optional(),
});

router.get(
  "/ad-campaigns",
  validateQuery(adQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, businessId, search, page, limit } =
      req.query as unknown as z.infer<typeof adQuerySchema>;

    const where: any = {};
    if (status) where.status = status;
    if (businessId) where.businessId = businessId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { ctaLabel: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: { id: true, displayName: true, slug: true, logoUrl: true },
          },
        },
      }),
      prisma.adCampaign.count({ where }),
    ]);

    ApiResponse.paginated(res, items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

router.patch(
  "/ad-campaigns/:id",
  validateParams(idParamSchema),
  validateBody(adminAdUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data: any = { ...req.body };
    if (req.body.startsAt) data.startsAt = new Date(req.body.startsAt);
    if (req.body.endsAt) data.endsAt = new Date(req.body.endsAt);
    const updated = await prisma.adCampaign.update({ where: { id }, data });
    ApiResponse.success(res, updated, "Campaign updated");
  }),
);

router.post(
  "/ad-campaigns/:id/approve",
  validateParams(idParamSchema),
  validateBody(reviewActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = await prisma.adCampaign.update({
      where: { id },
      data: { status: "ACTIVE", reviewNotes: req.body.notes ?? null },
    });
    ApiResponse.success(res, updated, "Campaign approved");
  }),
);

router.post(
  "/ad-campaigns/:id/reject",
  validateParams(idParamSchema),
  validateBody(reviewActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = await prisma.adCampaign.update({
      where: { id },
      data: { status: "REJECTED", reviewNotes: req.body.notes ?? null },
    });
    ApiResponse.success(res, updated, "Campaign rejected");
  }),
);

router.post(
  "/ad-campaigns/:id/pause",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = await prisma.adCampaign.update({
      where: { id },
      data: { status: "PAUSED" },
    });
    ApiResponse.success(res, updated, "Campaign paused");
  }),
);

router.delete(
  "/ad-campaigns/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.adCampaign.delete({ where: { id } });
    ApiResponse.success(res, null, "Campaign deleted");
  }),
);

// ─── Discounts ──────────────────────────────────────────────────────────────

const discountQuerySchema = z.object({
  businessId: z.string().optional(),
  isFeatured: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const adminDiscountUpdateSchema = z.object({
  code: z.string().max(40).optional().nullable(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  percentOff: z.number().int().min(1).max(100).optional().nullable(),
  amountOffPaise: z.number().int().min(1).optional().nullable(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  appliesTo: z.any().optional().nullable(),
  isFeatured: z.boolean().optional(),
});

router.get(
  "/discounts",
  validateQuery(discountQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { businessId, isFeatured, search, page, limit } =
      req.query as unknown as z.infer<typeof discountQuerySchema>;

    const where: any = {};
    if (businessId) where.businessId = businessId;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: { id: true, displayName: true, slug: true, logoUrl: true },
          },
        },
      }),
      prisma.discount.count({ where }),
    ]);

    ApiResponse.paginated(res, items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

router.patch(
  "/discounts/:id",
  validateParams(idParamSchema),
  validateBody(adminDiscountUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data: any = { ...req.body };
    if (req.body.validFrom) data.validFrom = new Date(req.body.validFrom);
    if (req.body.validUntil) data.validUntil = new Date(req.body.validUntil);
    const updated = await prisma.discount.update({ where: { id }, data });
    ApiResponse.success(res, updated, "Discount updated");
  }),
);

router.delete(
  "/discounts/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.discount.delete({ where: { id } });
    ApiResponse.success(res, null, "Discount deleted");
  }),
);

export default router;
