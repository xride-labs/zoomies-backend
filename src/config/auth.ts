import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber } from "better-auth/plugins";
import prisma from "../lib/prisma.js";
import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
// import { sendVerificationEmail } from "../lib/mailer.js"; // TODO: Enable when email is configured

// User roles enum (sync with Prisma schema)
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  CLUB_OWNER = "CLUB_OWNER",
  USER = "USER",
  RIDER = "RIDER",
  SELLER = "SELLER",
}

// Session interface (attached to request)
export interface AuthSession {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    phone: string | null;
    roles: string[];
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: AuthSession;
    }
  }
}

/**
 * Better Auth configuration
 */
export const auth = betterAuth({
  // Secret for signing tokens/cookies
  secret: process.env.BETTER_AUTH_SECRET,

  // Base URL for callbacks and redirects
  baseURL:
    process.env.BETTER_AUTH_BASE_URL ||
    process.env.AUTH_URL ||
    "http://localhost:5000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Base path for auth endpoints
  basePath: "/api/auth",

  // Trust host for production
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    process.env.MOBILE_APP_URL || "http://localhost:8081",
  ],

  // Enable email and password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // Set to true in production
    // Send verification email on signup
    sendResetPassword: async ({ user, url }) => {
      console.log(
        `[AUTH] Password reset requested for ${user.email}, URL: ${url}`,
      );
    },
  },

  // Email verification configuration
  // NOTE: Email sending is disabled until SMTP is configured.
  // Verification tokens are still created; check server logs for the token.
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      console.log(`[AUTH] Verification email for ${user.email}`);
      console.log(`[AUTH] Verification URL: ${url}`);
      console.log(`[AUTH] Verification token: ${token}`);
      // TODO: Enable when email SMTP is configured
      // const { sendVerificationEmail } = await import("../lib/mailer.js");
      // await sendVerificationEmail({ to: user.email, name: user.name, token });
    },
    sendOnSignUp: true,
  },

  // Database hooks for custom logic on user creation
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-assign USER role on signup
          try {
            await prisma.userRoleAssignment.create({
              data: { userId: user.id, role: "USER" },
            });
            console.log(`[AUTH] USER role assigned to ${user.id}`);
          } catch (error) {
            console.warn(`[AUTH] Failed to assign USER role:`, error);
          }
        },
      },
    },
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    },
  },

  // Session configuration
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Custom user fields
  user: {
    modelName: "User",
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
      phoneVerified: {
        type: "date",
        required: false,
      },
      username: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      location: {
        type: "string",
        required: false,
      },
      bikeType: {
        type: "string",
        required: false,
      },
      bikeOwned: {
        type: "string",
        required: false,
      },
      experienceLevel: {
        type: "string",
        required: false,
      },
      bloodType: {
        type: "string",
        required: false,
      },
    },
  },

  // Account configuration
  account: {
    modelName: "Account",
  },

  // Plugins
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
        // Use existing Twilio integration
        const { sendOTPViaSMS } = await import("../lib/twilio.js");
        const sent = await sendOTPViaSMS(phone, code);
        if (!sent && process.env.NODE_ENV !== "development") {
          throw new Error("Failed to send OTP");
        }
        // In development, log the OTP
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] OTP for ${phone}: ${code}`);
        }
      },
    }),
  ],
});

// Type for auth instance
export type Auth = typeof auth;

/**
 * Get the current session from request headers (no role enrichment).
 */
export async function getCurrentSession(
  req: Request,
): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session || !session.user) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
      phone: session.user.phone ?? null,
      roles: [],
    },
    session: {
      id: session.session.id,
      token: session.session.token,
      expiresAt: session.session.expiresAt,
    },
  };
}

/**
 * Middleware to protect routes - requires authentication
 * Supports Better Auth session
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    console.log("[AUTH] requireAuth middleware - Checking session");
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    console.log("[AUTH] requireAuth - Session retrieved", {
      hasSession: !!session,
      userId: session?.user?.id,
    });

    if (!session || !session.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
        error: {
          code: "UNAUTHORIZED",
          details: {
            hint: "Include session cookie or Bearer token in your request",
          },
        },
      });
      return;
    }

    // Get user roles from database
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { userId: session.user.id },
      select: { role: true },
    });

    const roles = assignments.map((a) => a.role);
    if (!roles.includes(UserRole.USER)) {
      roles.push(UserRole.USER);
    }
    console.log("[AUTH] requireAuth - Roles loaded", {
      userId: session.user.id,
      roles,
    });

    // Attach session to request
    req.session = {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
        phone: (session.user as any).phone || null,
        roles,
      },
      session: {
        id: session.session.id,
        token: session.session.token,
        expiresAt: session.session.expiresAt,
      },
    };
    console.log("[AUTH] requireAuth - Session attached to request", {
      userId: session.user.id,
    });

    next();
  } catch (error) {
    console.error("[Auth] Session error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid or expired session",
      error: {
        code: "SESSION_EXPIRED",
        details: {
          hint: "Please sign in again",
        },
      },
    });
  }
}

/**
 * Optional auth middleware - extracts session if provided, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user) {
      const assignments = await prisma.userRoleAssignment.findMany({
        where: { userId: session.user.id },
        select: { role: true },
      });

      const roles = assignments.map((a) => a.role);
      if (!roles.includes(UserRole.USER)) {
        roles.push(UserRole.USER);
      }

      req.session = {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image ?? null,
          phone: (session.user as any).phone || null,
          roles,
        },
        session: {
          id: session.session.id,
          token: session.session.token,
          expiresAt: session.session.expiresAt,
        },
      };
    }
  } catch {
    // Ignore errors for optional auth
  }

  next();
}

/**
 * Middleware to require specific roles
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: { code: "UNAUTHORIZED" },
      });
      return;
    }

    const userRoles = req.session.user.roles;
    const hasRequiredRole = allowedRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasRequiredRole) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        error: {
          code: "FORBIDDEN",
          details: {
            required: allowedRoles,
            current: userRoles,
          },
        },
      });
      return;
    }

    next();
  };
}
