import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import { ApiResponse, ErrorCode } from "../../lib/utils/apiResponse.js";
import { asyncHandler, validateParams } from "../../middlewares/validation.js";
import { z } from "zod";

const router = Router();

const idParam = z.object({ id: z.string().min(1) });

/**
 * GET /api/public/rides/:id
 * Unauthenticated ride preview for web share pages.
 */
router.get(
  "/rides/:id",
  validateParams(idParam),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        startLocation: true,
        scheduledAt: true,
        images: true,
        status: true,
        _count: { select: { participants: true } },
      },
    });
    if (!ride) {
      return ApiResponse.notFound(res, "Ride not found", ErrorCode.NOT_FOUND);
    }
    return ApiResponse.success(res, {
      id: ride.id,
      title: ride.title,
      startLocation: ride.startLocation,
      scheduledAt: ride.scheduledAt,
      bannerImage: ride.images[0] ?? null,
      participantCount: ride._count.participants,
      status: ride.status,
    });
  })
);

/**
 * GET /api/public/marketplace/:id
 * Unauthenticated listing preview for web share pages.
 */
router.get(
  "/marketplace/:id",
  validateParams(idParam),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        condition: true,
        images: true,
        category: true,
        status: true,
      },
    });
    if (!listing) {
      return ApiResponse.notFound(res, "Listing not found", ErrorCode.NOT_FOUND);
    }
    return ApiResponse.success(res, {
      id: listing.id,
      title: listing.title,
      price: listing.price,
      currency: listing.currency,
      condition: listing.condition ?? null,
      image: listing.images[0] ?? null,
      category: listing.category ?? null,
      status: listing.status,
    });
  })
);

/**
 * GET /api/public/clubs/:id
 * Unauthenticated club preview for web share pages.
 */
router.get(
  "/clubs/:id",
  validateParams(idParam),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const club = await prisma.club.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        location: true,
        memberCount: true,
        isPublic: true,
      },
    });
    if (!club) {
      return ApiResponse.notFound(res, "Club not found", ErrorCode.NOT_FOUND);
    }
    if (!club.isPublic) {
      return ApiResponse.notFound(res, "Club not found", ErrorCode.NOT_FOUND);
    }
    return ApiResponse.success(res, {
      id: club.id,
      name: club.name,
      description: club.description ?? null,
      image: club.image ?? null,
      location: club.location ?? null,
      memberCount: club.memberCount,
      isPublic: club.isPublic,
    });
  })
);

export default router;
