import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

// Load environment variables
dotenv.config();

import { auth } from "./config/auth.js";
import { CORS_OPTIONS } from "./config/trustedOrigins.js";
import { toNodeHandler } from "better-auth/node";
import { connectMongoDB } from "./lib/mongodb.js";
import { setupSwagger } from "./config/swagger.js";
import {
  accountRoutes,
  userRoutes,
  rideRoutes,
  clubRoutes,
  marketplaceRoutes,
  adminRoutes,
  mediaRoutes,
  feedRoutes,
  discoveryRoutes,
  chatRoutes,
  locationRoutes,
  friendGroupRoutes,
  friendshipRoutes,
} from "./routes/index.js";
import {
  initializeScheduledJobs,
  initializeSelfPing,
} from "./jobs/scheduler.js";
import { ApiResponse, ErrorCode } from "./lib/utils/apiResponse.js";
import { metricsHandler, metricsMiddleware } from "./lib/metrics.js";
import { requireMonitoringAccess } from "./middlewares/monitoring.js";
import { createSocketServer } from "./lib/socket.js";
import { connectPostgres } from "./lib/prisma.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Trust proxy (required for secure cookies behind reverse proxies)
app.set("trust proxy", true);

// Apply CORS configuration
app.use(cors(CORS_OPTIONS));

// Metrics middleware
app.use(metricsMiddleware);

// Log auth origin headers in dev to diagnose Better Auth origin checks
app.use("/api/auth", (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== "production") {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const referer = req.headers.referer;
    console.log("[AUTH] Origin check", { origin, host, referer });
    if (!origin && host) {
      req.headers.origin = `http://${host}`;
    }
  }
  next();
});

// Better Auth handler — MUST be mounted BEFORE express.json()
// See: https://www.better-auth.com/docs/integrations/express
app.all("/api/auth/*", toNodeHandler(auth));

// Body parsing middleware (AFTER Better Auth)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Swagger/OpenAPI documentation
setupSwagger(app);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Monitoring endpoint (Prometheus scrape target)
app.get("/api/admin/metrics", requireMonitoringAccess, metricsHandler);

// Account routes (profile, verify-email, change-password)
app.use("/api/account", accountRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/posts", feedRoutes);
app.use("/api/discover", discoveryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/friend-groups", friendGroupRoutes);
app.use("/api/friends", friendshipRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  ApiResponse.notFound(res, "Endpoint not found", ErrorCode.NOT_FOUND);
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  ApiResponse.internalError(res, "An unexpected error occurred", err);
});

// Start server
async function startServer() {
  try {
    console.log("[SERVER] Starting Zoomies Backend Server...");

    // Connect to PostgreSQL (required for auth and core APIs)
    await connectPostgres();

    // Connect to MongoDB (required for chat)
    try {
      await connectMongoDB();
    } catch (mongoError) {
      console.warn(
        "⚠️  MongoDB connection failed, chat features will be unavailable",
      );
    }

    // Initialize Socket.io for real-time chat
    const io = createSocketServer(httpServer);
    console.log("[SERVER] Socket.io chat server initialized");

    // Initialize scheduled background jobs
    console.log("[SERVER] Initializing scheduled jobs...");
    initializeScheduledJobs();

    // Keep the backend warm on free-tier hosts with periodic self-pings.
    initializeSelfPing(Number(PORT));

    httpServer.listen(PORT, () => {
      const baseUrl =
        process.env.BETTER_AUTH_BASE_URL || `http://localhost:${PORT}`;
      const isProduction = process.env.NODE_ENV === "production";

      if (isProduction) {
        console.log("[SERVER] Zoomies backend started successfully");
        console.log(`[SERVER] Environment: production`);
        console.log(`[SERVER] Base URL: ${baseUrl}`);
        console.log(`[SERVER] Health: ${baseUrl}/health`);
        return;
      }

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Zoomies Backend Server (Better Auth)
║
║   Server running on: ${baseUrl}
║   Environment: ${process.env.NODE_ENV || "development"}
║
║   📚 API Documentation:
║   - Swagger UI: ${baseUrl}/api-docs
║   - ReDoc:      ${baseUrl}/redoc
║   - OpenAPI:    ${baseUrl}/api-docs.json
║
║   Better Auth endpoints (handled automatically):           ║
║   - POST /api/auth/sign-up/email                           ║
║   - POST /api/auth/sign-in/email                           ║
║   - POST /api/auth/sign-in/social                          ║
║   - POST /api/auth/sign-out                                ║
║   - GET  /api/auth/session                                 ║
║   - POST /api/auth/phone-number/send-otp                   ║
║   - POST /api/auth/phone-number/verify                     ║
║                                                            ║
║   Custom API endpoints:                                    ║
║   - GET  /api/account/me                                   ║
║   - POST /api/account/verify-email                         ║
║   - POST /api/account/change-password                      ║
║   - GET  /api/users                                        ║
║   - GET  /api/rides                                        ║
║   - GET  /api/clubs                                        ║
║   - GET  /api/marketplace                                  ║
║   - GET  /api/admin (requires admin role)                  ║
║   - POST /api/media (file uploads)                         ║
║                                                            ║
║   Chat endpoints:                                          ║
║   - GET  /api/chat/conversations                           ║
║   - POST /api/chat/conversations                           ║
║   - GET  /api/chat/conversations/:id/messages              ║
║   - POST /api/chat/conversations/:id/messages              ║
║   - GET  /api/chat/unread                                  ║
║   - WebSocket: ws://localhost:${PORT}
║                                                            ║
║   Location endpoints (Snapchat-style map):                 ║
║   - POST /api/location                                     ║
║   - GET  /api/location/friends                             ║
║   - GET  /api/location/settings                            ║
║   - POST /api/location/ghost-mode                          ║
║   - GET  /api/location/ride/:rideId                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
