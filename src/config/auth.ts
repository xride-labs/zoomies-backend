import { ExpressAuth, getSession } from "@auth/express";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/express/providers/google";
import Credentials from "@auth/express/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import type { Request, Response, NextFunction } from "express";
import type { ExpressAuthConfig } from "@auth/express";

// Auth.js configuration
export const authConfig: ExpressAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google OAuth Provider
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),

    // Email/Password Credentials Provider
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "email@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // Phone OTP Credentials Provider
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: {
          label: "Phone Number",
          type: "tel",
          placeholder: "+1234567890",
        },
        otp: { label: "OTP Code", type: "text", placeholder: "123456" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Phone number and OTP are required");
        }

        const phone = credentials.phone as string;
        const otp = credentials.otp as string;

        // Find and verify the OTP token
        const verificationToken = await prisma.verificationToken.findFirst({
          where: {
            identifier: phone,
            token: otp,
            type: "sms",
            expires: { gt: new Date() },
          },
        });

        if (!verificationToken) {
          throw new Error("Invalid or expired OTP");
        }

        // Delete the used token
        await prisma.verificationToken.delete({
          where: { id: verificationToken.id },
        });

        // Find or create user by phone
        let user = await prisma.user.findUnique({
          where: { phone },
        });

        if (!user) {
          // Create new user with phone
          user = await prisma.user.create({
            data: {
              phone,
              phoneVerified: new Date(),
            },
          });
        } else if (!user.phoneVerified) {
          // Mark phone as verified
          user = await prisma.user.update({
            where: { id: user.id },
            data: { phoneVerified: new Date() },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
};

// Express Auth middleware
export const authHandler = ExpressAuth(authConfig);

// Middleware to get current session
export async function getCurrentSession(req: Request) {
  const session = await getSession(req, authConfig);
  return session;
}

// Middleware to protect routes
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await getCurrentSession(req);

  if (!session || !session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Attach session to request
  (req as any).session = session;
  next();
}
