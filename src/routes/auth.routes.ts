import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import {
  generateOTP,
  sendOTPViaSMS,
  isValidPhoneNumber,
} from "../lib/twilio.js";
import { requireAuth, getCurrentSession } from "../config/auth.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import { validateBody, asyncHandler } from "../middlewares/validation.js";
import {
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  updateProfileSchema,
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
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: securePassword123
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return ApiResponse.conflict(
        res,
        "User with this email already exists",
        ErrorCode.ALREADY_EXISTS,
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    ApiResponse.created(res, { user }, "User registered successfully");
  }),
);

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP via SMS
 *     description: Send a one-time password to a phone number for verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/send-otp",
  validateBody(sendOtpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!isValidPhoneNumber(phone)) {
      return ApiResponse.validationError(res, {
        phone: [
          "Invalid phone number format. Use E.164 format (e.g., +1234567890)",
        ],
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTP for this phone
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: phone,
        type: "sms",
      },
    });

    // Store OTP in database
    await prisma.verificationToken.create({
      data: {
        identifier: phone,
        token: otp,
        expires: expiresAt,
        type: "sms",
      },
    });

    // Send OTP via SMS
    const sent = await sendOTPViaSMS(phone, otp);

    if (!sent && process.env.NODE_ENV !== "development") {
      return ApiResponse.error(
        res,
        "Failed to send OTP",
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
      );
    }

    ApiResponse.success(
      res,
      {
        expiresAt,
        // Only include OTP in development for testing
        ...(process.env.NODE_ENV === "development" && { otp }),
      },
      "OTP sent successfully",
    );
  }),
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP code
 *     description: Verify a one-time password without signing in (for phone verification)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: "+1234567890"
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully
 *                 verified:
 *                   type: boolean
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/verify-otp",
  validateBody(verifyOtpSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: phone,
        token: otp,
        type: "sms",
        expires: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return ApiResponse.error(
        res,
        "Invalid or expired OTP",
        400,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    // Don't delete the token here - it will be used during sign-in
    ApiResponse.success(res, { verified: true }, "OTP verified successfully");
  }),
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        phoneVerified: true,
        emailVerified: true,
        bio: true,
        location: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return ApiResponse.notFound(
        res,
        "User not found",
        ErrorCode.USER_NOT_FOUND,
      );
    }

    ApiResponse.success(res, { user });
  }),
);

/**
 * PATCH /api/auth/me
 * Update current user profile
 */
router.patch(
  "/me",
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const {
      name,
      bio,
      location,
      bikeType,
      bikeOwned,
      experienceLevel,
      levelOfActivity,
      bloodType,
    } = req.body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(bikeType !== undefined && { bikeType }),
        ...(bikeOwned !== undefined && { bikeOwned }),
        ...(experienceLevel !== undefined && { experienceLevel }),
        ...(levelOfActivity !== undefined && { levelOfActivity }),
        ...(bloodType !== undefined && { bloodType }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        bio: true,
        location: true,
        bikeType: true,
        bikeOwned: true,
        experienceLevel: true,
        levelOfActivity: true,
        bloodType: true,
        updatedAt: true,
      },
    });

    ApiResponse.success(res, { user }, "Profile updated successfully");
  }),
);

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.password) {
      return ApiResponse.error(
        res,
        "User does not have a password set",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return ApiResponse.error(
        res,
        "Current password is incorrect",
        400,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    ApiResponse.success(res, null, "Password changed successfully");
  }),
);

export default router;
