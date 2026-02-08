import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { authHandler } from "./config/auth.js";
import { connectMongoDB } from "./lib/mongodb.js";
import { setupSwagger } from "./config/swagger.js";
import {
  authRoutes,
  userRoutes,
  rideRoutes,
  clubRoutes,
  marketplaceRoutes,
  adminRoutes,
  mediaRoutes,
} from "./routes/index.js";
import { initializeScheduledJobs } from "./jobs/scheduler.js";
import { ApiResponse, ErrorCode } from "./lib/utils/apiResponse.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (required for secure cookies behind reverse proxies)
app.set("trust proxy", true);

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    process.env.MOBILE_APP_URL || "exp://localhost:8081",
    "http://localhost:3000",
    "http://localhost:8081",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Body parsing middleware
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

// Auth.js middleware - handles /auth routes
app.use("/auth", authHandler);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/media", mediaRoutes);

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
    // Connect to MongoDB (optional, will warn if not configured)
    // Server will start even if MongoDB connection fails
    try {
      await connectMongoDB();
    } catch (mongoError) {
      console.warn("⚠️  MongoDB connection failed, continuing without MongoDB");
    }

    // Initialize scheduled background jobs
    initializeScheduledJobs();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Zoomies Backend Server                               ║
║                                                            ║
║   Server running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || "development"}    ║
║                                                            ║
║   📚 API Documentation:                                    ║
║   - Swagger UI: http://localhost:${PORT}/api-docs          ║
║   - ReDoc:      http://localhost:${PORT}/redoc             ║
║   - OpenAPI:    http://localhost:${PORT}/api-docs.json     ║
║                                                            ║
║   Auth endpoints:                                          ║
║   - GET  /auth/signin                                      ║
║   - GET  /auth/signout                                     ║
║   - GET  /auth/session                                     ║
║   - GET  /auth/csrf                                        ║
║   - GET  /auth/providers                                   ║
║                                                            ║
║   API endpoints:                                           ║
║   - POST /api/auth/register                                ║
║   - POST /api/auth/send-otp                                ║
║   - POST /api/auth/verify-otp                              ║
║   - GET  /api/auth/me                                      ║
║   - GET  /api/users                                        ║
║   - GET  /api/rides                                        ║
║   - GET  /api/clubs                                        ║
║   - GET  /api/marketplace                                  ║
║   - GET  /api/admin (requires admin role)                  ║
║   - POST /api/media (file uploads)                         ║
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
