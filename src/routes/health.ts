import { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import mongoose from "../lib/mongodb.js";

export async function healthHandler(_req: Request, res: Response) {
  const requestStart = process.hrtime.bigint();

  const postgresStart = process.hrtime.bigint();
  let postgresStatus: "up" | "down" = "up";
  let postgresError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    postgresStatus = "down";
    postgresError = (error as Error).message;
  }

  const postgresLatencyMs =
    Number(process.hrtime.bigint() - postgresStart) / 1_000_000;

  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  const mongoStart = process.hrtime.bigint();
  let mongoStatus: "up" | "down" | "not_configured" = mongoConfigured
    ? "up"
    : "not_configured";
  let mongoError: string | null = null;
  const mongoReadyState = mongoConfigured
    ? mongoose.connection.readyState
    : null;

  if (mongoConfigured) {
    try {
      await mongoose.connection.db?.admin().ping();
      if (!mongoose.connection.db) {
        throw new Error("MongoDB is not connected");
      }
    } catch (error) {
      mongoStatus = "down";
      mongoError = (error as Error).message;
    }
  }

  const mongoLatencyMs =
    mongoStatus === "not_configured"
      ? null
      : Number(process.hrtime.bigint() - mongoStart) / 1_000_000;

  const overallStatus: "ok" | "degraded" | "down" =
    postgresStatus === "down"
      ? "down"
      : mongoStatus === "down"
        ? "degraded"
        : "ok";

  const responseLatencyMs =
    Number(process.hrtime.bigint() - requestStart) / 1_000_000;

  res.status(overallStatus === "down" ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    latencyMs: Number(responseLatencyMs.toFixed(2)),
    checks: {
      postgres: {
        status: postgresStatus,
        latencyMs: Number(postgresLatencyMs.toFixed(2)),
        error: postgresError,
      },
      mongodb: {
        status: mongoStatus,
        latencyMs:
          mongoLatencyMs === null ? null : Number(mongoLatencyMs.toFixed(2)),
        readyState: mongoReadyState,
        error: mongoError,
      },
    },
  });
}
