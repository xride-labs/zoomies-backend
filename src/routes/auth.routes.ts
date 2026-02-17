import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { auth, requireAuth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import { validateBody, asyncHandler } from "../middlewares/validation.js";
import {
  updateProfileSchema,
  verifyEmailSchema,
} from "../validators/schemas.js";
import { z } from "zod";

const router = Router();

// Change password schema (local to this file)
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

/**
 * @swagger
 * /api/account/verify-email:
 *   post:
 *     summary: Verify email address
 *     description: |
 *       Confirms email ownership using the verification token sent during registration.
 *       Use this before attempting sign-in if email verification is enabled.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               token:
 *                 type: string
 *                 example: 1a2b3c4d5e6f...
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post(
  "/verify-email",
  validateBody(verifyEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, token } = req.body;
    console.log("[AUTH] POST /verify-email", { email });

    // Better Auth uses JWT tokens for email verification (signed with BETTER_AUTH_SECRET).
    // Decode and verify the JWT instead of looking up a DB record.
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      console.error("[AUTH] BETTER_AUTH_SECRET is not set");
      return ApiResponse.error(
        res,
        "Server configuration error",
        500,
        ErrorCode.INTERNAL_ERROR,
      );
    }

    let decoded: { email?: string };
    try {
      decoded = jwt.verify(token, secret) as { email?: string };
    } catch (err: any) {
      console.warn(
        "[AUTH] Verify-email - JWT verification failed:",
        err.message,
      );
      return ApiResponse.error(
        res,
        "Invalid or expired verification token",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Ensure the email in the JWT matches the email in the request body
    if (decoded.email !== email) {
      console.warn("[AUTH] Verify-email - Email mismatch", {
        tokenEmail: decoded.email,
        bodyEmail: email,
      });
      return ApiResponse.error(
        res,
        "Token does not match the provided email",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return ApiResponse.error(res, "User not found", 404, ErrorCode.NOT_FOUND);
    }

    if (user.emailVerified) {
      return ApiResponse.success(res, null, "Email is already verified");
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    console.log("[AUTH] Verify-email - User updated", { email });

    ApiResponse.success(res, null, "Email verified successfully");
  }),
);

/**
 * @swagger
 * /api/account/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the authenticated user and role assignments.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    console.log("[AUTH] GET /me", { userId: session.user.id });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        userRoles: { select: { role: true } },
        bikes: true,
        badges: { include: { badge: true } },
        emergencyContacts: true,
        preferences: true,
        rideStats: true,
        clubMemberships: { include: { club: true } },
        _count: {
          select: {
            followers: true,
            following: true,
            friendsInitiated: true,
            friendsReceived: true,
          },
        },
      },
    });

    if (!user) {
      return ApiResponse.notFound(
        res,
        "User not found",
        ErrorCode.USER_NOT_FOUND,
      );
    }

    const roles = user.userRoles?.map((r) => r.role) ?? [];
    const xpPoints = user.xpPoints ?? 0;
    const nextLevelXp = (user.level + 1) * 250;
    const progressPercent = nextLevelXp
      ? Math.min(100, Math.round((xpPoints / nextLevelXp) * 100))
      : 0;
    const friendsCount =
      (user._count?.friendsInitiated ?? 0) +
      (user._count?.friendsReceived ?? 0);

    const response = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      dob: user.dob,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phone: user.phone,
      coverImage: user.coverImage,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      bloodType: user.bloodType,
      ridesCompleted: user.rideStats?.totalRides ?? 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
      experience: {
        xpPoints,
        level: user.level,
        levelTitle: user.levelTitle,
        nextLevelXp,
        progressPercent,
        reputationScore: user.reputationScore ?? 0,
        activityLevel: user.activityLevel,
      },
      bikes:
        user.bikes?.map((bike) => ({
          id: bike.id,
          make: bike.make,
          model: bike.model,
          year: bike.year,
          type: bike.type,
          engineCc: bike.engineCc,
          color: bike.color,
          odo: bike.odo,
          ownerSince: bike.ownerSince,
          modifications: bike.modifications,
          isPrimary: bike.isPrimary,
        })) ?? [],
      clubs:
        user.clubMemberships?.map((membership) => ({
          id: membership.club.id,
          name: membership.club.name,
          role: membership.role,
          joinedAt: membership.joinedAt,
          memberCount: membership.club.memberCount,
          logo: membership.club.image,
        })) ?? [],
      rideStats: user.rideStats
        ? {
            totalDistanceKm: user.rideStats.totalDistanceKm,
            longestRideKm: user.rideStats.longestRideKm,
            nightRides: user.rideStats.nightRides,
            weekendRides: user.rideStats.weekendRides,
          }
        : null,
      badges:
        user.badges?.map((userBadge) => ({
          id: userBadge.badge.id,
          title: userBadge.badge.title,
          auraPoints: userBadge.badge.auraPoints,
          icon: userBadge.badge.icon,
          earnedAt: userBadge.earnedAt,
        })) ?? [],
      social: {
        followers: user._count?.followers ?? 0,
        following: user._count?.following ?? 0,
        friends: friendsCount,
      },
      safety: {
        emergencyContacts: {
          count: user.emergencyContacts?.length ?? 0,
          items: user.emergencyContacts ?? [],
        },
        helmetVerified: user.helmetVerified,
        lastSafetyCheck: user.lastSafetyCheck,
      },
      preferences: user.preferences,
    };
    console.log("[AUTH] GET /me - Returning user", {
      userId: user.id,
      roles: response.roles,
    });

    ApiResponse.success(res, { user: response });
  }),
);

/**
 * @swagger
 * /api/account/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Updates profile fields for the authenticated user.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               bikeType:
 *                 type: string
 *               bikeOwned:
 *                 type: string
 *               experienceLevel:
 *                 type: string
 *               levelOfActivity:
 *                 type: string
 *               bloodType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch(
  "/me",
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    console.log("[AUTH] PATCH /me", {
      userId: session.user.id,
      fields: Object.keys(req.body),
    });
    const { name, bio, location, dob, bloodType, avatar, coverImage } =
      req.body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(dob !== undefined && { dob: new Date(dob) }),
        ...(bloodType !== undefined && { bloodType }),
        ...(avatar !== undefined && { avatar }),
        ...(coverImage !== undefined && { coverImage }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        coverImage: true,
        phone: true,
        bio: true,
        location: true,
        bloodType: true,
        dob: true,
        updatedAt: true,
      },
    });
    console.log("[AUTH] PATCH /me - Profile updated", { userId: user.id });

    ApiResponse.success(res, { user }, "Profile updated successfully");
  }),
);

/**
 * @swagger
 * /api/account/change-password:
 *   post:
 *     summary: Change user password
 *     description: Updates the password for the authenticated user.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { currentPassword, newPassword } = req.body;
    console.log("[AUTH] POST /change-password", { userId: session.user.id });

    try {
      // Use Better Auth's built-in changePassword API
      // It verifies the current password and hashes the new one correctly
      await auth.api.changePassword({
        headers: fromNodeHeaders(req.headers),
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        },
      });

      console.log("[AUTH] POST /change-password - Password updated", {
        userId: session.user.id,
      });

      ApiResponse.success(res, null, "Password changed successfully");
    } catch (error: any) {
      console.warn("[AUTH] POST /change-password - Failed", {
        userId: session.user.id,
        error: error.message,
      });
      return ApiResponse.error(
        res,
        error.body?.message || "Current password is incorrect",
        400,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }
  }),
);

export default router;
