import { NotificationType } from "@prisma/client";
import prisma from "./prisma.js";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  relatedType?: string;
  relatedId?: string;
  sentViaEmail?: boolean;
  sentViaPush?: boolean;
};

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: input.sentViaPush ?? false,
    },
  });
}

export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (!inputs.length) {
    return;
  }

  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      sentViaEmail: input.sentViaEmail ?? false,
      sentViaPush: input.sentViaPush ?? false,
    })),
  });
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
