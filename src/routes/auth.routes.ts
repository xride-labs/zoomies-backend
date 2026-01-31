import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import {
  generateOTP,
  sendOTPViaSMS,
  isValidPhoneNumber,
} from "../lib/twilio.js";
import { requireAuth, getCurrentSession } from "../config/auth.js";

const router = Router();

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
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
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
        createdAt: true,
      },
    });

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

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
router.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({
        error:
          "Invalid phone number format. Use E.164 format (e.g., +1234567890)",
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
      return res.status(500).json({ error: "Failed to send OTP" });
    }

    res.json({
      message: "OTP sent successfully",
      expiresAt,
      // Only include OTP in development for testing
      ...(process.env.NODE_ENV === "development" && { otp }),
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

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
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ error: "Phone number and OTP are required" });
    }

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
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Don't delete the token here - it will be used during sign-in
    res.json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * PATCH /api/auth/me
 * Update current user profile
 */
router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const { name, bio, location, image } = req.body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(image !== undefined && { image }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phone: true,
        bio: true,
        location: true,
        updatedAt: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const session = (req as any).session;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Current password and new password are required" });
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user || !user.password) {
        return res
          .status(400)
          .json({ error: "User does not have a password set" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  },
);

export default router;
