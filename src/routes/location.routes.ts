import { Router, Request, Response } from "express";
import { requireAuth } from "../config/auth.js";
import {
  validateBody,
  validateParams,
  asyncHandler,
} from "../middlewares/validation.js";
import { z } from "zod";
import { LocationService } from "../services/location.service.js";
import { ApiResponse } from "../lib/utils/apiResponse.js";

const router = Router();

// All location routes require authentication
router.use(requireAuth);

// ─── Validation Schemas ──────────────────────────────────────────────────────

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  accuracy: z.number().min(0).optional(),
  battery: z.number().min(0).max(100).optional(),
  isMoving: z.boolean().optional(),
  isOnRide: z.boolean().optional(),
  rideId: z.string().optional(),
});

const updateSettingsSchema = z.object({
  sharingEnabled: z.boolean().optional(),
  shareWithAll: z.boolean().optional(),
  ghostMode: z.boolean().optional(),
  expiresInMinutes: z.number().min(1).max(1440).optional(), // Max 24 hours
});

const setPermissionSchema = z.object({
  friendId: z.string(),
  canSee: z.boolean(),
  canSeeSpeed: z.boolean().optional(),
  canSeeBattery: z.boolean().optional(),
});

const ghostModeSchema = z.object({
  enabled: z.boolean(),
  durationMinutes: z.number().min(1).max(1440).optional(),
});

const friendIdParamSchema = z.object({
  friendId: z.string(),
});

const rideIdParamSchema = z.object({
  rideId: z.string(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/location:
 *   post:
 *     summary: Update current user's live location
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               altitude:
 *                 type: number
 *               heading:
 *                 type: number
 *               speed:
 *                 type: number
 *               accuracy:
 *                 type: number
 *               battery:
 *                 type: number
 *               isMoving:
 *                 type: boolean
 *               isOnRide:
 *                 type: boolean
 *               rideId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Location updated
 */
router.post(
  "/",
  validateBody(updateLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    await LocationService.updateLocation({
      userId,
      ...req.body,
    });
    ApiResponse.success(res, null, "Location updated");
  }),
);

/**
 * @swagger
 * /api/location/settings:
 *   get:
 *     summary: Get location sharing settings
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sharing settings
 */
router.get(
  "/settings",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const settings = await LocationService.getSharingSettings(userId);
    ApiResponse.success(res, settings);
  }),
);

/**
 * @swagger
 * /api/location/settings:
 *   patch:
 *     summary: Update location sharing settings
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sharingEnabled:
 *                 type: boolean
 *               shareWithAll:
 *                 type: boolean
 *               ghostMode:
 *                 type: boolean
 *               expiresInMinutes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.patch(
  "/settings",
  validateBody(updateSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { expiresInMinutes, ...rest } = req.body;

    const expiresAt = expiresInMinutes
      ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
      : undefined;

    await LocationService.updateSharingSettings(userId, {
      ...rest,
      expiresAt,
    });

    ApiResponse.success(res, null, "Settings updated");
  }),
);

/**
 * @swagger
 * /api/location/friends:
 *   get:
 *     summary: Get friend locations for map (Snapchat-style)
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friend locations
 */
router.get(
  "/friends",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const locations = await LocationService.getFriendLocations(userId);
    ApiResponse.success(res, { friends: locations });
  }),
);

/**
 * @swagger
 * /api/location/friends/{friendId}:
 *   get:
 *     summary: Get a specific friend's location
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Friend location
 *       404:
 *         description: Location not available
 */
router.get(
  "/friends/:friendId",
  validateParams(friendIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { friendId } = req.params;

    const location = await LocationService.getFriendLocation(userId, friendId);

    if (!location) {
      return ApiResponse.notFound(res, "Location not available");
    }

    ApiResponse.success(res, location);
  }),
);

/**
 * @swagger
 * /api/location/permissions:
 *   get:
 *     summary: Get all location sharing permissions
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions
 */
router.get(
  "/permissions",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const permissions = await LocationService.getAllPermissions(userId);
    ApiResponse.success(res, { permissions });
  }),
);

/**
 * @swagger
 * /api/location/permissions:
 *   post:
 *     summary: Set location sharing permission for a friend
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [friendId, canSee]
 *             properties:
 *               friendId:
 *                 type: string
 *               canSee:
 *                 type: boolean
 *               canSeeSpeed:
 *                 type: boolean
 *               canSeeBattery:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permission updated
 */
router.post(
  "/permissions",
  validateBody(setPermissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    try {
      await LocationService.setFriendPermission(userId, req.body);
      ApiResponse.success(res, null, "Permission updated");
    } catch (err: any) {
      ApiResponse.error(res, err.message, 400);
    }
  }),
);

/**
 * @swagger
 * /api/location/ghost-mode:
 *   post:
 *     summary: Toggle ghost mode (hide from everyone)
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *               durationMinutes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Ghost mode toggled
 */
router.post(
  "/ghost-mode",
  validateBody(ghostModeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { enabled, durationMinutes } = req.body;

    if (enabled) {
      await LocationService.enableGhostMode(userId, durationMinutes);
      ApiResponse.success(res, null, "Ghost mode enabled");
    } else {
      await LocationService.disableGhostMode(userId);
      ApiResponse.success(res, null, "Ghost mode disabled");
    }
  }),
);

/**
 * @swagger
 * /api/location/ride/{rideId}:
 *   get:
 *     summary: Get locations of ride participants
 *     tags: [Location]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participant locations
 */
router.get(
  "/ride/:rideId",
  validateParams(rideIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { rideId } = req.params;

    try {
      const locations = await LocationService.getRideParticipantLocations(
        rideId,
        userId,
      );
      ApiResponse.success(res, { participants: locations });
    } catch (err: any) {
      ApiResponse.error(res, err.message, 400);
    }
  }),
);

export default router;
