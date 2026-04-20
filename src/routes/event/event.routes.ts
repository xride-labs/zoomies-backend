import { Router, Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "../../lib/utils/apiResponse.js";
import { requireAuth } from "../../config/auth.js";
import { validateBody, validateParams, asyncHandler } from "../../middlewares/validation.js";
import prisma from "../../lib/prisma.js";

const router = Router();
router.use(requireAuth);

const idParamSchema = z.object({ id: z.string().cuid() });

const createEventSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scheduledAt: z.string().datetime(),
  clubId: z.string().cuid().optional(),
  bannerImage: z.string().url().optional(),
  ticketUrl: z.string().url().optional(),
});

// Get all events (general feed / discovery)
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { clubId, isFeatured } = req.query;

    const events = await prisma.event.findMany({
      where: {
        ...(clubId ? { clubId: String(clubId) } : {}),
        ...(isFeatured === "true" ? { isFeatured: true } : {}),
        status: { not: "CANCELLED" },
        scheduledAt: { gte: new Date() }, // Only upcoming events by default
      },
      include: {
        creator: {
          select: { id: true, name: true, avatar: true, username: true },
        },
        club: { select: { id: true, name: true, image: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    });

    ApiResponse.success(res, events, "Events retrieved successfully");
  }),
);

// Host/Create an Event
router.post(
  "/",
  validateBody(createEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;

    if (data.clubId) {
      // Check if user is CLUB_OWNER or officer
      const clubMember = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: data.clubId, userId: req.session!.user.id } },
      });
      const club = await prisma.club.findUnique({ where: { id: data.clubId } });

      if (
        !club ||
        (club.ownerId !== req.session!.user.id && clubMember?.role !== "OFFICER")
      ) {
        return ApiResponse.forbidden(
          res,
          "Only club owners or officers can host an event for this club.",
        );
      }
    }

    const eventRecord = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        scheduledAt: new Date(data.scheduledAt),
        clubId: data.clubId,
        bannerImage: data.bannerImage,
        ticketUrl: data.ticketUrl,
        creatorId: req.session!.user.id,
      },
    });

    ApiResponse.created(res, eventRecord, "Event hosted successfully");
  }),
);

// Attend an Event
router.post(
  "/:id/attend",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const eventRecord = await prisma.event.findUnique({ where: { id } });
    if (!eventRecord) return ApiResponse.notFound(res, "Event not found");

    const participation = await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId: id, userId: req.session!.user.id } },
      create: { eventId: id, userId: req.session!.user.id, status: "ACCEPTED" }, // Auto-accepting for MVP
      update: { status: "ACCEPTED" },
    });

    ApiResponse.success(res, participation, "Joined event successfully");
  }),
);

export default router;
