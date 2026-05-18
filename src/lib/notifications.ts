import { NotificationType } from "@prisma/client";
import prisma from "./prisma.js";
import { sendPushToUsers, channelForType, categoryForType } from "./push.js";
import { getIO, isUserOnline } from "./socket.js";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  relatedType?: string;
  relatedId?: string;
  sentViaEmail?: boolean;
  sentViaPush?: boolean;
  /** Skip push delivery for this notification (default: send push). */
  skipPush?: boolean;
};

// ─── Push Preference Cache ────────────────────────────────────────────────────
// Caches UserPreferences.pushNotifications per userId for 60 seconds so we
// don't hit the DB on every notification creation. Invalidated explicitly
// when the user updates their preferences via PATCH /account/preferences.

interface PrefCacheEntry {
  value: boolean;
  expiresAt: number;
}

const pushPrefCache = new Map<string, PrefCacheEntry>();

/** Call this from the preferences-update route to invalidate immediately. */
export function invalidatePushPrefCache(userId: string): void {
  pushPrefCache.delete(userId);
}

async function getPushEnabled(userId: string): Promise<boolean> {
  const cached = pushPrefCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { pushNotifications: true },
  });
  const value = prefs?.pushNotifications ?? true;
  pushPrefCache.set(userId, { value, expiresAt: Date.now() + 60_000 });
  return value;
}

/**
 * Batch-fetch push preferences for multiple users in a single DB query.
 * Cache misses are resolved together to avoid N parallel queries on cold cache.
 */
async function getPushEnabledBatch(
  userIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const uncachedIds: string[] = [];

  for (const userId of userIds) {
    const cached = pushPrefCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      result.set(userId, cached.value);
    } else {
      uncachedIds.push(userId);
    }
  }

  if (uncachedIds.length > 0) {
    const rows = await prisma.userPreferences.findMany({
      where: { userId: { in: uncachedIds } },
      select: { userId: true, pushNotifications: true },
    });
    const rowMap = new Map(rows.map((r) => [r.userId, r.pushNotifications]));

    for (const userId of uncachedIds) {
      const value = rowMap.get(userId) ?? true; // default: push enabled
      pushPrefCache.set(userId, { value, expiresAt: Date.now() + 60_000 });
      result.set(userId, value);
    }
  }

  return result;
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

/**
 * Create a single persistent notification and deliver it:
 *   - Always emits `notification:new` via Socket.IO to the user's personal room.
 *   - Sends a push notification ONLY when the user is offline AND their push
 *     preference is enabled, OR when the type is SOS_ALERT (safety-critical:
 *     push regardless of online status).
 *
 * Push delivery is fire-and-forget and must never block the DB write.
 */
export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  // Persist first — record always exists regardless of delivery outcome.
  const record = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: false, // updated to true below only if push actually fires
    },
  });

  // Real-time in-app delivery — use the real DB id so the client can call
  // PATCH /notifications/:id/read correctly.
  getIO()?.to(`user:${input.userId}`).emit("notification:new", {
    id: record.id,
    type: record.type,
    title: record.title,
    message: record.message ?? null,
    isRead: false,
    createdAt: record.createdAt.toISOString(),
    relatedId: record.relatedId ?? null,
    relatedType: record.relatedType ?? null,
  });

  if (input.skipPush) return;

  // SOS_ALERT is safety-critical: push even if the user is online.
  // All other types: push only if the user is offline (socket not connected).
  const isSos = input.type === NotificationType.SOS_ALERT;
  const userOnline = !isSos && isUserOnline(input.userId);

  if (userOnline) return;

  // Respect the user's push-notification preference (cached 60 s).
  const pushEnabled = await getPushEnabled(input.userId);
  if (!pushEnabled) return;

  // Flip sentViaPush before the network call so a DB crash doesn't leave a
  // false-false record; best-effort update (non-critical).
  prisma.notification
    .update({ where: { id: record.id }, data: { sentViaPush: true } })
    .catch(() => {});

  sendPushToUsers([input.userId], {
    title: input.title,
    body: input.message,
    channelId: channelForType(input.type),
    categoryIdentifier: categoryForType(input.type),
    data: {
      notificationType: input.type,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
    },
  }).catch((err) => console.error("[notifications] push failed:", err));
}

/**
 * Create multiple notifications in a single DB round-trip and deliver each.
 * Uses createManyAndReturn (Prisma ≥5.14, PostgreSQL) to get real IDs so
 * the socket payloads are correct — previously fake IDs broke mark-as-read.
 *
 * Push fan-out uses a single batch per unique (type, title, message) group so
 * Expo receives one request for a ride-start notification to 30 participants
 * rather than 30 individual requests.
 */
export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (!inputs.length) return;

  const io = getIO();

  // One DB round-trip that returns all created rows including their real IDs.
  const records = await prisma.notification.createManyAndReturn({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: false,
    })),
  });

  // Emit real-time events with real DB IDs.
  if (io) {
    for (const record of records) {
      io.to(`user:${record.userId}`).emit("notification:new", {
        id: record.id,
        type: record.type,
        title: record.title,
        message: record.message ?? null,
        isRead: false,
        createdAt: record.createdAt.toISOString(),
        relatedId: record.relatedId ?? null,
        relatedType: record.relatedType ?? null,
      });
    }
  }

  // Build a map of userId → notificationId for sentViaPush tracking.
  const recordIdByUserId = new Map<string, string>(
    records.map((r) => [r.userId, r.id]),
  );

  // Determine which users should receive a push:
  // • SOS_ALERT bypasses the online check (safety-critical).
  // • All other types: push only if user is offline.
  // • Always respect the per-user push preference.
  const pushCandidateInputs = inputs.filter((input) => {
    if (input.skipPush) return false;
    const isSos = input.type === NotificationType.SOS_ALERT;
    return isSos || !isUserOnline(input.userId);
  });

  if (!pushCandidateInputs.length) return;

  // Batch-fetch push preferences in a single query for all candidates.
  const candidateIds = pushCandidateInputs.map((i) => i.userId);
  const pushPrefs = await getPushEnabledBatch(candidateIds);

  const eligibleInputs = pushCandidateInputs.filter(
    (input) => pushPrefs.get(input.userId) !== false,
  );

  if (!eligibleInputs.length) return;

  // Group by (type, title, message, relatedType, relatedId) for Expo batching.
  const groups = new Map<string, { input: NotificationInput; userIds: string[] }>();
  for (const input of eligibleInputs) {
    const key = `${input.type}::${input.title}::${input.message ?? ""}::${input.relatedType ?? ""}::${input.relatedId ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.userIds.push(input.userId);
    } else {
      groups.set(key, { input, userIds: [input.userId] });
    }
  }

  // IDs to mark sentViaPush = true after push fires.
  const pushedIds: string[] = [];

  for (const { input, userIds } of groups.values()) {
    for (const uid of userIds) {
      const id = recordIdByUserId.get(uid);
      if (id) pushedIds.push(id);
    }

    sendPushToUsers(userIds, {
      title: input.title,
      body: input.message,
      channelId: channelForType(input.type),
      categoryIdentifier: categoryForType(input.type),
      data: {
        notificationType: input.type,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    }).catch((err) =>
      console.error("[notifications] push send failed:", err),
    );
  }

  // Batch-mark all pushed notifications (fire-and-forget; non-critical path).
  if (pushedIds.length) {
    prisma.notification
      .updateMany({
        where: { id: { in: pushedIds } },
        data: { sentViaPush: true },
      })
      .catch(() => {});
  }
}

/**
 * Fan-out helper: notify a list of users with the same payload.
 * Deduplicates userIds before dispatching.
 */
export async function notifyUsers(
  userIds: string[],
  payload: Omit<NotificationInput, "userId">,
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) return;

  await createNotifications(
    uniqueUserIds.map((userId) => ({ ...payload, userId })),
  );
}
