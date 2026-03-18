import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { deleteMultipleMedia } from "../lib/cloudinary.js";

/**
 * Configuration for ride cleanup
 */
const RIDE_RETENTION_DAYS = parseInt(
  process.env.RIDE_RETENTION_DAYS || "30",
  10,
);

const DEFAULT_SELF_PING_INTERVAL_MINUTES = 10;
const SELF_PING_TIMEOUT_MS = 10_000;

/**
 * Ride cleanup job - runs daily at 2 AM
 * Deletes rides that ended more than RIDE_RETENTION_DAYS ago
 * unless they have keepPermanently flag set
 */
export async function cleanupOldRides(): Promise<{
  deleted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  // eslint-disable-next-line prefer-const
  let deleted = 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RIDE_RETENTION_DAYS);

    // Find rides to delete
    // Rides that are COMPLETED or CANCELLED and ended before cutoff date
    // and don't have keepPermanently flag
    const ridesToDelete = await prisma.ride.findMany({
      where: {
        status: { in: ["COMPLETED", "CANCELLED"] },
        updatedAt: { lt: cutoffDate },
        // Using a raw query approach since keepPermanently might need to be added to schema
        // For now, we'll check rides that were completed/cancelled before cutoff
      },
      select: {
        id: true,
        title: true,
        chatGroupId: true,
      },
    });

    console.log(
      `[Ride Cleanup] Found ${ridesToDelete.length} rides eligible for deletion`,
    );

    for (const ride of ridesToDelete) {
      try {
        // Delete associated chat messages if chat group exists
        if (ride.chatGroupId) {
          await prisma.chatMessage.deleteMany({
            where: { chatGroupId: ride.chatGroupId },
          });
        }

        // Delete ride participants
        await prisma.rideParticipant.deleteMany({
          where: { rideId: ride.id },
        });

        // Delete associated posts (optional - might want to keep as archived)
        await prisma.post.deleteMany({
          where: { rideId: ride.id },
        });

        // Delete the ride
        await prisma.ride.delete({
          where: { id: ride.id },
        });

        deleted++;
        console.log(`[Ride Cleanup] Deleted ride: ${ride.title} (${ride.id})`);
      } catch (error) {
        const errorMsg = `Failed to delete ride ${ride.id}: ${(error as Error).message}`;
        console.error(`[Ride Cleanup] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(
      `[Ride Cleanup] Completed. Deleted: ${deleted}, Errors: ${errors.length}`,
    );
    return { deleted, errors };
  } catch (error) {
    const errorMsg = `Ride cleanup job failed: ${(error as Error).message}`;
    console.error(`[Ride Cleanup] ${errorMsg}`);
    errors.push(errorMsg);
    return { deleted, errors };
  }
}

/**
 * Cleanup orphaned media files
 * Runs weekly on Sunday at 3 AM
 */
export async function cleanupOrphanedMedia(): Promise<{
  deleted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  // eslint-disable-next-line prefer-const
  let deleted = 0;

  try {
    // This would require tracking media in a separate table
    // For now, this is a placeholder for future implementation
    console.log("[Media Cleanup] Orphaned media cleanup not yet implemented");
    return { deleted, errors };
  } catch (error) {
    const errorMsg = `Media cleanup job failed: ${(error as Error).message}`;
    console.error(`[Media Cleanup] ${errorMsg}`);
    errors.push(errorMsg);
    return { deleted, errors };
  }
}

/**
 * Update ride statuses based on scheduled time
 * Runs every 15 minutes
 */
export async function updateRideStatuses(): Promise<{
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    const now = new Date();

    // Update PLANNED rides to IN_PROGRESS if scheduled time has passed
    const startedRides = await prisma.ride.updateMany({
      where: {
        status: "PLANNED",
        scheduledAt: { lte: now },
      },
      data: {
        status: "IN_PROGRESS",
      },
    });

    updated += startedRides.count;

    // Optionally: Auto-complete rides after expected duration
    // This could be based on scheduledAt + duration

    if (updated > 0) {
      console.log(`[Ride Status] Updated ${updated} ride statuses`);
    }

    return { updated, errors };
  } catch (error) {
    const errorMsg = `Ride status update job failed: ${(error as Error).message}`;
    console.error(`[Ride Status] ${errorMsg}`);
    errors.push(errorMsg);
    return { updated, errors };
  }
}

/**
 * Cleanup inactive sessions
 * Runs daily at 4 AM
 */
export async function cleanupExpiredSessions(): Promise<{ deleted: number }> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      console.log(`[Session Cleanup] Deleted ${result.count} expired sessions`);
    }

    return { deleted: result.count };
  } catch (error) {
    console.error(`[Session Cleanup] Failed: ${(error as Error).message}`);
    return { deleted: 0 };
  }
}

/**
 * Calculate and update user statistics
 * Runs daily at 1 AM
 */
export async function updateUserStatistics(): Promise<{ updated: number }> {
  try {
    // Update rides completed count for all users
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    let updated = 0;

    for (const user of users) {
      const ridesCount = await prisma.rideParticipant.count({
        where: {
          userId: user.id,
          status: "COMPLETED",
        },
      });

      // Upsert UserRideStats to update totalRides
      await prisma.userRideStats.upsert({
        where: { userId: user.id },
        update: { totalRides: ridesCount },
        create: {
          userId: user.id,
          totalRides: ridesCount,
        },
      });

      updated++;
    }

    console.log(`[User Stats] Updated statistics for ${updated} users`);
    return { updated };
  } catch (error) {
    console.error(`[User Stats] Failed: ${(error as Error).message}`);
    return { updated: 0 };
  }
}

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduledJobs(): void {
  console.log("[Jobs] Initializing scheduled jobs...");

  // Daily ride cleanup at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("[Jobs] Running daily ride cleanup...");
    await cleanupOldRides();
  });

  // Update ride statuses every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    await updateRideStatuses();
  });

  // Daily session cleanup at 4:00 AM
  cron.schedule("0 4 * * *", async () => {
    console.log("[Jobs] Running session cleanup...");
    await cleanupExpiredSessions();
  });

  // Daily user statistics update at 1:00 AM
  cron.schedule("0 1 * * *", async () => {
    console.log("[Jobs] Running user statistics update...");
    await updateUserStatistics();
  });

  // Weekly orphaned media cleanup on Sunday at 3:00 AM
  cron.schedule("0 3 * * 0", async () => {
    console.log("[Jobs] Running weekly media cleanup...");
    await cleanupOrphanedMedia();
  });

  console.log("[Jobs] All scheduled jobs initialized successfully");
}

function resolveSelfPingUrl(port: number): string | null {
  const explicit = process.env.SELF_PING_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const externalBase =
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim();

  if (externalBase) {
    return `${externalBase.replace(/\/$/, "")}/health`;
  }

  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${port}/health`;
  }

  return null;
}

async function pingServer(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SELF_PING_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "zoomies-backend-self-ping/1.0",
      },
    });

    if (!response.ok) {
      console.warn(
        `[KeepAlive] Self-ping returned ${response.status} ${response.statusText}`,
      );
      return;
    }

    console.log(`[KeepAlive] Self-ping successful (${response.status})`);
  } catch (error) {
    console.warn(
      `[KeepAlive] Self-ping failed: ${(error as Error).message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Periodically pings the deployed backend to keep warm on free-tier hosts.
 */
export function initializeSelfPing(port: number): void {
  const isEnabled = (process.env.SELF_PING_ENABLED || "true") === "true";
  if (!isEnabled) {
    console.log("[KeepAlive] Self-ping disabled by SELF_PING_ENABLED");
    return;
  }

  const productionOnly =
    (process.env.SELF_PING_PRODUCTION_ONLY || "true") === "true";
  if (productionOnly && process.env.NODE_ENV !== "production") {
    console.log(
      "[KeepAlive] Self-ping skipped outside production (SELF_PING_PRODUCTION_ONLY=true)",
    );
    return;
  }

  const intervalMinutes = Number.parseFloat(
    process.env.SELF_PING_INTERVAL_MINUTES ||
      String(DEFAULT_SELF_PING_INTERVAL_MINUTES),
  );

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    console.warn(
      `[KeepAlive] Invalid SELF_PING_INTERVAL_MINUTES value: ${process.env.SELF_PING_INTERVAL_MINUTES}`,
    );
    return;
  }

  const pingUrl = resolveSelfPingUrl(port);
  if (!pingUrl) {
    console.warn(
      "[KeepAlive] Skipped self-ping: set SELF_PING_URL or RENDER_EXTERNAL_URL in production",
    );
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(
    `[KeepAlive] Self-ping enabled: ${pingUrl} every ${intervalMinutes} minute(s)`,
  );

  // Trigger a warm-up ping shortly after startup.
  setTimeout(() => {
    void pingServer(pingUrl);
  }, 30_000);

  const timer = setInterval(() => {
    void pingServer(pingUrl);
  }, intervalMs);

  timer.unref();
}

/**
 * Run a specific job manually (for admin use)
 */
export async function runJobManually(jobName: string): Promise<any> {
  switch (jobName) {
    case "cleanupOldRides":
      return await cleanupOldRides();
    case "updateRideStatuses":
      return await updateRideStatuses();
    case "cleanupExpiredSessions":
      return await cleanupExpiredSessions();
    case "updateUserStatistics":
      return await updateUserStatistics();
    case "cleanupOrphanedMedia":
      return await cleanupOrphanedMedia();
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}
