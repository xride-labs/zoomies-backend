import { z } from "zod";

// ─── Conversation Schemas ────────────────────────────────────────────────────

export const conversationTypeEnum = z.enum([
  "direct",
  "ride",
  "club",
  "marketplace",
]);

export const createConversationSchema = z
  .object({
    type: conversationTypeEnum,
    participantIds: z
      .array(z.string().min(1))
      .min(1, "At least one participant is required"),
    relatedEntityId: z.string().optional(),
    metadata: z
      .object({
        name: z.string().max(100).optional(),
        avatar: z.string().url().optional(),
        description: z.string().max(500).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // Direct chats must have exactly 1 other participant (self is auto-added)
      if (data.type === "direct") return data.participantIds.length === 1;
      return true;
    },
    { message: "Direct conversations require exactly 1 other participant" },
  )
  .refine(
    (data) => {
      // Entity-linked chats must provide relatedEntityId
      if (["ride", "club", "marketplace"].includes(data.type)) {
        return !!data.relatedEntityId;
      }
      return true;
    },
    {
      message:
        "relatedEntityId is required for ride, club, and marketplace chats",
    },
  );

export const conversationQuerySchema = z.object({
  type: conversationTypeEnum.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
});

export const updateConversationMetadataSchema = z.object({
  name: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
  description: z.string().max(500).optional(),
});

export const muteConversationSchema = z.object({
  mute: z.boolean(),
});

// ─── Message Schemas ─────────────────────────────────────────────────────────

export const messageTypeEnum = z.enum([
  "text",
  "image",
  "voice",
  "video",
  "file",
  "system",
]);

export const attachmentSchema = z.object({
  url: z.string().url(),
  publicId: z.string().optional(),
  type: z.enum(["image", "video", "audio", "file"]),
  filename: z.string().optional(),
  size: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  thumbnailUrl: z.string().url().optional(),
});

export const sendMessageSchema = z
  .object({
    text: z.string().max(5000).optional(),
    messageType: messageTypeEnum.optional().default("text"),
    attachments: z.array(attachmentSchema).max(10).optional(),
    replyTo: z.string().optional(),
  })
  .refine(
    (data) => {
      // Must have text or attachments
      return (
        (data.text && data.text.trim().length > 0) ||
        (data.attachments && data.attachments.length > 0)
      );
    },
    { message: "Message must contain text or at least one attachment" },
  );

export const editMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

export const messageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
  direction: z.enum(["before", "after"]).optional().default("before"),
});

// ─── Reaction Schema ─────────────────────────────────────────────────────────

export const reactionSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(8)
    .regex(/^\p{Emoji}/u, "Must be a valid emoji"),
});

// ─── Param Schemas ───────────────────────────────────────────────────────────

export const conversationIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid conversation ID"),
});

export const messageIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid conversation ID"),
  messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid message ID"),
});

// ─── Participant Schema ──────────────────────────────────────────────────────

export const addParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["member", "admin"]).optional().default("member"),
});

export const removeParticipantSchema = z.object({
  userId: z.string().min(1),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type MessageQuery = z.infer<typeof messageQuerySchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;
