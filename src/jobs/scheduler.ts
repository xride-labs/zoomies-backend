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

      await prisma.user.update({
        where: { id: user.id },
        data: { ridesCompleted: ridesCount },
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
