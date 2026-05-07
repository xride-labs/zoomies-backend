import { NotificationType } from "@prisma/client";
import prisma from "./prisma.js";
import { sendPushToUsers, channelForType } from "./push.js";
import { getIO } from "./socket.js";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  relatedType?: string;
  relatedId?: string;
  sentViaEmail?: boolean;
  sentViaPush?: boolean;
  /** Skip the push delivery for this notification (default: send). */
  skipPush?: boolean;
};

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  const record = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: input.skipPush ? false : true,
    },
  });

  // Real-time in-app delivery — emit to the user's personal socket room
  // so any open screen can prepend the notification without polling.
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

  if (!input.skipPush) {
    // Fire-and-forget — push delivery must never block the in-app
    // notification from being created.
    sendPushToUsers([input.userId], {
      title: input.title,
      body: input.message,
      channelId: channelForType(input.type),
      data: {
        notificationType: input.type,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    }).catch((err) =>
      console.error("[notifications] push send failed:", err),
    );
  }
}

export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (!inputs.length) {
    return;
  }

  const io = getIO();
  const now = new Date();

  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: input.skipPush ? false : true,
    })),
  });

  // Emit real-time socket event to each recipient's personal room.
  if (io) {
    for (const input of inputs) {
      io.to(`user:${input.userId}`).emit("notification:new", {
        id: `bulk_${Date.now()}_${input.userId}`,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        isRead: false,
        createdAt: now.toISOString(),
        relatedId: input.relatedId ?? null,
        relatedType: input.relatedType ?? null,
      });
    }
  }

  // Group by (title, message, type) so we send one push per fan-out instead
  // of one per recipient — Expo accepts batched recipients per request.
  const groups = new Map<
    string,
    { input: NotificationInput; userIds: string[] }
  >();
  for (const input of inputs) {
    if (input.skipPush) continue;
    const key = `${input.type}::${input.title}::${input.message ?? ""}::${input.relatedType ?? ""}::${input.relatedId ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.userIds.push(input.userId);
    } else {
      groups.set(key, { input, userIds: [input.userId] });
    }
  }

  for (const { input, userIds } of groups.values()) {
    sendPushToUsers(userIds, {
      title: input.title,
      body: input.message,
      channelId: channelForType(input.type),
      data: {
        notificationType: input.type,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    }).catch((err) =>
      console.error("[notifications] push send failed:", err),
    );
  }
}

export async function notifyUsers(
  userIds: string[],
  payload: Omit<NotificationInput, "userId">,
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) {
    return;
  }

  await createNotifications(
    uniqueUserIds.map((userId) => ({
      ...payload,
      userId,
    })),
  );
}
