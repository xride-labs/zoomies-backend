/**
 * Expo Push Notification delivery.
 *
 * Why Expo's push service instead of raw FCM/APNs:
 *   - The mobile app is built on Expo, so device tokens come as ExpoPushTokens.
 *   - Expo handles the FCM v1 / APNs translation for us — one HTTP endpoint,
 *     no service-account JWT signing, no APNs cert wrangling.
 *   - For production scale, point EXPO_ACCESS_TOKEN at a paid Expo workspace
 *     to bypass anonymous rate limits.
 */
import prisma from "./prisma.js";
import type { NotificationType } from "@prisma/client";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH = 100; // Expo's documented per-request limit.

export interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Maps to Android channel + iOS sound. Defaults to "default". */
  sound?: "default" | null;
  /** Override Android channel id. Useful for high-priority chat / SOS. */
  channelId?: string;
  badge?: number;
  /**
   * Time to live in seconds. Lets the OS drop stale notifications when the
   * device is offline (e.g. "ride starts soon" for an already-started ride).
   */
  ttl?: number;
  /**
   * Notification category that maps to action buttons registered on the
   * mobile client (reply, accept, decline, SOS, etc.).
   * Expo: "categoryId" field. iOS: UNNotificationCategory identifier.
   */
  categoryIdentifier?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoSendResponse {
  data?: ExpoTicket[];
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Look up active device tokens for the given users and POST a single push
 * notification to each. Failed tokens (DeviceNotRegistered etc.) are pruned
 * from the database so we stop sending to dead installs.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: uniqueUserIds } },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) return;

  // Expo push tokens look like ExponentPushToken[xxx...] — drop anything else
  // so we don't waste an HTTP round-trip on garbage.
  const validTokens = tokens.filter(
    (t) =>
      typeof t.token === "string" &&
      (t.token.startsWith("ExponentPushToken[") ||
        t.token.startsWith("ExpoPushToken[")),
  );

  if (validTokens.length === 0) return;

  // Chunk into batches of MAX_BATCH so we stay under Expo's request size cap.
  for (let i = 0; i < validTokens.length; i += MAX_BATCH) {
    const slice = validTokens.slice(i, i + MAX_BATCH);
    await deliverBatch(slice, payload).catch((err) => {
      console.error("[push] Batch delivery failed:", err?.message ?? err);
    });
  }
}

async function deliverBatch(
  tokens: { id: string; token: string }[],
  payload: PushPayload,
): Promise<void> {
  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound ?? "default",
    channelId: payload.channelId ?? "default",
    badge: payload.badge,
    ttl: payload.ttl,
    priority: "high" as const,
    // Expo push API field for notification categories (action buttons)
    ...(payload.categoryIdentifier ? { categoryId: payload.categoryIdentifier } : {}),
  }));

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  let response: Response;
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("[push] Network error reaching Expo push:", err);
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[push] Expo push HTTP error:", response.status, text);
    return;
  }

  const json = (await response.json().catch(() => null)) as ExpoSendResponse | null;
  if (!json) return;

  if (json.errors && json.errors.length > 0) {
    console.error("[push] Expo push errors:", json.errors);
  }

  if (!Array.isArray(json.data)) return;

  // Tickets come back in input order. Match each ticket to its token so we
  // know which device tokens to retire on DeviceNotRegistered errors.
  const deadTokenIds: string[] = [];
  for (let i = 0; i < json.data.length; i += 1) {
    const ticket = json.data[i];
    if (ticket.status !== "error") continue;
    const errCode = ticket.details?.error;
    if (
      errCode === "DeviceNotRegistered" ||
      errCode === "InvalidCredentials"
    ) {
      const tokenRecord = tokens[i];
      if (tokenRecord) deadTokenIds.push(tokenRecord.id);
    } else {
      console.warn(
        `[push] Ticket error for token ${tokens[i]?.token?.slice(-8)}:`,
        ticket.message,
        ticket.details,
      );
    }
  }

  if (deadTokenIds.length > 0) {
    await prisma.deviceToken
      .deleteMany({ where: { id: { in: deadTokenIds } } })
      .catch((err) =>
        console.error("[push] Failed to prune dead tokens:", err),
      );
  }
}

/**
 * Helper that converts an in-app NotificationType into the right channel id.
 * Lets Android show heads-up notifications for chat/SOS while keeping
 * marketing-style notifications quiet.
 */
export function channelForType(type: NotificationType): string {
  const t = String(type);
  if (
    t.includes("MESSAGE") ||
    t.includes("CHAT") ||
    t.includes("SOS") ||
    t.includes("EMERGENCY")
  ) {
    return "messages";
  }
  if (t.includes("RIDE")) return "rides";
  return "default";
}

/**
 * Returns the notification category identifier for the given type.
 * Category IDs must match those registered via setNotificationCategoryAsync
 * on the mobile client — they control which action buttons appear.
 */
export function categoryForType(type: NotificationType): string | undefined {
  const t = String(type);
  if (t === "MESSAGE") return "message";
  if (t === "RIDE_INVITE") return "ride_invite";
  if (t === "FRIEND_REQUEST") return "friend_request";
  // SOS / emergency alerts get the SOS category with a direct "Call 112" button
  if (t.includes("SOS") || t.includes("EMERGENCY")) return "sos";
  return undefined;
}
