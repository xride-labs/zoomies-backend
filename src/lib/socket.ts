import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { ChatService } from "../services/chat.service.js";
import { LocationService } from "../services/location.service.js";
import { MessageType } from "../models/chat.model.js";
import type { IAttachment } from "../models/chat.model.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
}

interface SendMessagePayload {
  conversationId: string;
  text?: string;
  messageType?: string;
  attachments?: IAttachment[];
  replyTo?: string;
}

interface TypingPayload {
  conversationId: string;
}

interface MarkReadPayload {
  conversationId: string;
}

interface JoinConversationPayload {
  conversationId: string;
}

interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  battery?: number;
  isMoving?: boolean;
  isOnRide?: boolean;
  rideId?: string;
}

interface JoinRidePayload {
  rideId: string;
}

// ── Track online users (in-memory; Redis-backed in production) ────────────
const onlineUsers = new Map<string, Set<string>>(); // userId → Set<socketId>
// Track users subscribed to location updates
const locationSubscribers = new Map<string, Set<string>>(); // rideId → Set<socketId>

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        process.env.MOBILE_APP_URL || "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:8081",
      ],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    transports: ["websocket", "polling"],
  });

  // ── Optional Redis adapter for horizontal scaling ────────────────────────

  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) =>
        console.error("[SOCKET] Redis pub error:", err.message),
      );
      subClient.on("error", (err) =>
        console.error("[SOCKET] Redis sub error:", err.message),
      );

      io.adapter(createAdapter(pubClient, subClient));
      console.log("[SOCKET] Redis adapter attached for scaling");
    } catch (err) {
      console.warn("[SOCKET] Redis adapter failed, using in-memory:", err);
    }
  }

  // ─── Authentication Middleware ──────────────────────────────────────────

  io.use(async (socket, next) => {
    try {
      // Try to authenticate via cookie or Authorization header
      const cookie = socket.handshake.headers.cookie ?? "";
      const authHeader =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization ??
        "";

      // Build pseudo-headers for better-auth to parse
      const headers: Record<string, string> = {};
      if (cookie) headers.cookie = cookie;
      if (authHeader) {
        headers.authorization = authHeader.startsWith("Bearer ")
          ? authHeader
          : `Bearer ${authHeader}`;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers as any),
      });

      if (!session?.user?.id) {
        return next(new Error("Authentication required"));
      }

      // Attach user info to socket
      (socket as AuthenticatedSocket).userId = session.user.id;
      (socket as AuthenticatedSocket).userName = session.user.name ?? "Unknown";

      next();
    } catch (err) {
      console.error("[SOCKET] Auth middleware error:", err);
      next(new Error("Authentication failed"));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────

  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, userName } = socket;

    console.log(`[SOCKET] User connected: ${userId} (${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Auto-join the user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // ── join_conversation ──────────────────────────────────────────────

    socket.on(
      "join_conversation",
      async (payload: JoinConversationPayload, ack?: (...args: any[]) => void) => {
        try {
          const { conversationId } = payload;

          // Verify participation
          const allowed = await ChatService.isParticipant(
            conversationId,
            userId,
          );
          if (!allowed) {
            socket.emit("error", {
              event: "join_conversation",
              message: "Access denied",
            });
            ack?.({ success: false, error: "Access denied" });
            return;
          }

          socket.join(`conversation:${conversationId}`);

          // Mark messages as delivered
          const { messages } = await ChatService.getMessages(conversationId, {
            limit: 1,
          });
          if (messages.length) {
            await ChatService.markAsDelivered(
              messages[0]._id.toString(),
              userId,
            );
          }

          console.log(
            `[SOCKET] ${userId} joined conversation ${conversationId}`,
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] join_conversation error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── leave_conversation ─────────────────────────────────────────────

    socket.on(
      "leave_conversation",
      (payload: JoinConversationPayload, ack?: (...args: any[]) => void) => {
        socket.leave(`conversation:${payload.conversationId}`);
        ack?.({ success: true });
      },
    );

    // ── send_message ───────────────────────────────────────────────────

    socket.on(
      "send_message",
      async (payload: SendMessagePayload, ack?: (...args: any[]) => void) => {
        try {
          const { conversationId, text, messageType, attachments, replyTo } =
            payload;

          // Verify participation
          const allowed = await ChatService.isParticipant(
            conversationId,
            userId,
          );
          if (!allowed) {
            ack?.({ success: false, error: "Access denied" });
            return;
          }

          // Validate content
          if (!text?.trim() && (!attachments || !attachments.length)) {
            ack?.({
              success: false,
              error: "Message must have text or attachments",
            });
            return;
          }

          const message = await ChatService.sendMessage({
            conversationId,
            senderId: userId,
            senderName: userName,
            text,
            messageType: (messageType as MessageType) ?? MessageType.TEXT,
            attachments,
            replyTo,
          });

          // Broadcast to all participants in the conversation room
          io.to(`conversation:${conversationId}`).emit("new_message", {
            message: message.toObject(),
            conversationId,
          });

          // Also notify users not currently in the room via their personal rooms
          const conversation =
            await ChatService.getConversationById(conversationId);
          if (conversation) {
            for (const p of conversation.participants) {
              if (p.userId !== userId) {
                io.to(`user:${p.userId}`).emit("conversation_updated", {
                  conversationId,
                  lastMessage: {
                    text: (text ?? "").slice(0, 200) || "Attachment",
                    senderId: userId,
                    senderName: userName,
                    sentAt: message.createdAt,
                    messageType: messageType ?? "text",
                  },
                });
              }
            }
          }

          // Deliver acknowledgement
          ack?.({ success: true, messageId: message._id.toString() });

          // Emit delivery status back to sender
          socket.emit("message_delivered", {
            messageId: message._id.toString(),
            conversationId,
            deliveredAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("[SOCKET] send_message error:", err);
          ack?.({ success: false, error: "Failed to send message" });
        }
      },
    );

    // ── typing_start ───────────────────────────────────────────────────

    socket.on("typing_start", (payload: TypingPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("user_typing", {
        conversationId: payload.conversationId,
        userId,
        userName,
        isTyping: true,
      });
    });

    // ── typing_stop ────────────────────────────────────────────────────

    socket.on("typing_stop", (payload: TypingPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("user_typing", {
        conversationId: payload.conversationId,
        userId,
        userName,
        isTyping: false,
      });
    });

    // ── mark_read ──────────────────────────────────────────────────────

    socket.on("mark_read", async (payload: MarkReadPayload, ack?: (...args: any[]) => void) => {
      try {
        const { conversationId } = payload;

        const allowed = await ChatService.isParticipant(conversationId, userId);
        if (!allowed) {
          ack?.({ success: false, error: "Access denied" });
          return;
        }

        await ChatService.markAsRead(conversationId, userId);

        // Notify sender that their messages were read
        socket.to(`conversation:${conversationId}`).emit("message_read", {
          conversationId,
          userId,
          readAt: new Date().toISOString(),
        });

        ack?.({ success: true });
      } catch (err) {
        console.error("[SOCKET] mark_read error:", err);
        ack?.({ success: false, error: "Internal error" });
      }
    });

    // ── edit_message (real-time broadcast) ─────────────────────────────

    socket.on(
      "edit_message",
      async (
        payload: { conversationId: string; messageId: string; text: string },
        ack?: (...args: any[]) => void,
      ) => {
        try {
          const message = await ChatService.editMessage(
            payload.messageId,
            userId,
            payload.text,
          );
          if (!message) {
            ack?.({ success: false, error: "Message not found" });
            return;
          }

          io.to(`conversation:${payload.conversationId}`).emit(
            "message_edited",
            {
              conversationId: payload.conversationId,
              messageId: payload.messageId,
              text: payload.text,
              editedAt: message.editedAt?.toISOString(),
            },
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] edit_message error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── delete_message (real-time broadcast) ───────────────────────────

    socket.on(
      "delete_message",
      async (
        payload: { conversationId: string; messageId: string },
        ack?: (...args: any[]) => void,
      ) => {
        try {
          const message = await ChatService.deleteMessage(
            payload.messageId,
            userId,
          );
          if (!message) {
            ack?.({ success: false, error: "Message not found" });
            return;
          }

          io.to(`conversation:${payload.conversationId}`).emit(
            "message_deleted",
            {
              conversationId: payload.conversationId,
              messageId: payload.messageId,
            },
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] delete_message error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── add_reaction (real-time broadcast) ─────────────────────────────

    socket.on(
      "add_reaction",
      async (
        payload: { conversationId: string; messageId: string; emoji: string },
        ack?: (...args: any[]) => void,
      ) => {
        try {
          await ChatService.addReaction(
            payload.messageId,
            userId,
            payload.emoji,
          );

          io.to(`conversation:${payload.conversationId}`).emit(
            "reaction_updated",
            {
              conversationId: payload.conversationId,
              messageId: payload.messageId,
              userId,
              emoji: payload.emoji,
              action: "add",
            },
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] add_reaction error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── remove_reaction ────────────────────────────────────────────────

    socket.on(
      "remove_reaction",
      async (
        payload: { conversationId: string; messageId: string },
        ack?: (...args: any[]) => void,
      ) => {
        try {
          await ChatService.removeReaction(payload.messageId, userId);

          io.to(`conversation:${payload.conversationId}`).emit(
            "reaction_updated",
            {
              conversationId: payload.conversationId,
              messageId: payload.messageId,
              userId,
              emoji: null,
              action: "remove",
            },
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] remove_reaction error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ─────────────────────────────────────────────────────────────────────
    // ── LOCATION SHARING EVENTS (Snapchat-style map) ────────────────────
    // ─────────────────────────────────────────────────────────────────────

    // ── update_location ────────────────────────────────────────────────

    socket.on(
      "update_location",
      async (payload: LocationUpdatePayload, ack?: (...args: any[]) => void) => {
        try {
          // Save to database
          await LocationService.updateLocation({
            userId,
            ...payload,
          });

          // Broadcast to friends who are subscribed
          // (They join a room like `friends:${userId}` to receive updates)
          socket.to(`friends:${userId}`).emit("friend_location_updated", {
            userId,
            userName,
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
            speed: payload.speed,
            isMoving: payload.isMoving,
            isOnRide: payload.isOnRide,
            rideId: payload.rideId,
            timestamp: new Date().toISOString(),
          });

          // If on a ride, broadcast to ride participants
          if (payload.isOnRide && payload.rideId) {
            socket.to(`ride:${payload.rideId}`).emit("rider_location_updated", {
              userId,
              userName,
              latitude: payload.latitude,
              longitude: payload.longitude,
              heading: payload.heading,
              speed: payload.speed,
              isMoving: payload.isMoving,
              timestamp: new Date().toISOString(),
            });
          }

          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] update_location error:", err);
          ack?.({ success: false, error: "Failed to update location" });
        }
      },
    );

    // ── subscribe_to_friend_locations ──────────────────────────────────

    socket.on(
      "subscribe_to_friend_locations",
      async (payload: { friendIds: string[] }, ack?: (...args: any[]) => void) => {
        try {
          // Join rooms to receive location updates from these friends
          for (const friendId of payload.friendIds) {
            socket.join(`friends:${friendId}`);
          }
          console.log(
            `[SOCKET] ${userId} subscribed to ${payload.friendIds.length} friend locations`,
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] subscribe_to_friend_locations error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── unsubscribe_from_friend_locations ──────────────────────────────

    socket.on(
      "unsubscribe_from_friend_locations",
      (payload: { friendIds: string[] }, ack?: (...args: any[]) => void) => {
        for (const friendId of payload.friendIds) {
          socket.leave(`friends:${friendId}`);
        }
        ack?.({ success: true });
      },
    );

    // ── join_ride_tracking ─────────────────────────────────────────────

    socket.on(
      "join_ride_tracking",
      async (payload: JoinRidePayload, ack?: (...args: any[]) => void) => {
        try {
          socket.join(`ride:${payload.rideId}`);
          console.log(
            `[SOCKET] ${userId} joined ride tracking for ${payload.rideId}`,
          );
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] join_ride_tracking error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── leave_ride_tracking ────────────────────────────────────────────

    socket.on(
      "leave_ride_tracking",
      (payload: JoinRidePayload, ack?: (...args: any[]) => void) => {
        socket.leave(`ride:${payload.rideId}`);
        ack?.({ success: true });
      },
    );

    // ── request_friend_locations ───────────────────────────────────────
    // Get all friend locations once (for initial map load)

    socket.on(
      "request_friend_locations",
      async (payload: Record<string, never>, ack?: (...args: any[]) => void) => {
        try {
          const locations = await LocationService.getFriendLocations(userId);
          ack?.({ success: true, locations });
        } catch (err) {
          console.error("[SOCKET] request_friend_locations error:", err);
          ack?.({ success: false, error: "Internal error", locations: [] });
        }
      },
    );

    // ── toggle_ghost_mode ──────────────────────────────────────────────

    socket.on(
      "toggle_ghost_mode",
      async (
        payload: { enabled: boolean; durationMinutes?: number },
        ack?: (...args: any[]) => void,
      ) => {
        try {
          if (payload.enabled) {
            await LocationService.enableGhostMode(
              userId,
              payload.durationMinutes,
            );
          } else {
            await LocationService.disableGhostMode(userId);
          }
          ack?.({ success: true });
        } catch (err) {
          console.error("[SOCKET] toggle_ghost_mode error:", err);
          ack?.({ success: false, error: "Internal error" });
        }
      },
    );

    // ── disconnect ─────────────────────────────────────────────────────

    socket.on("disconnect", (reason) => {
      console.log(
        `[SOCKET] User disconnected: ${userId} (${socket.id}) — ${reason}`,
      );

      onlineUsers.get(userId)?.delete(socket.id);
      if (onlineUsers.get(userId)?.size === 0) {
        onlineUsers.delete(userId);
      }
    });
  });

  console.log("[SOCKET] Chat & Location socket server initialized");
  return io;
}

/**
 * Utility: check if a user is currently online.
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
}

/**
 * Utility: get all online user IDs.
 */
export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}
