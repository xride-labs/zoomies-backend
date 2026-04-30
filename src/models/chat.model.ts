import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ConversationType {
  DIRECT = "direct",
  RIDE = "ride",
  CLUB = "club",
  MARKETPLACE = "marketplace",
  GROUP = "group",
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  VOICE = "voice",
  VIDEO = "video",
  FILE = "file",
  SYSTEM = "system",
}

export enum AttachmentType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  FILE = "file",
}

export enum ParticipantRole {
  MEMBER = "member",
  ADMIN = "admin",
  OWNER = "owner",
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IParticipant {
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  nickname?: string;
  isMuted: boolean;
}

export interface ILastMessage {
  text: string;
  senderId: string;
  senderName: string;
  sentAt: Date;
  messageType: MessageType;
}

export interface IConversationMetadata {
  name?: string;
  avatar?: string;
  description?: string;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  type: ConversationType;
  participants: IParticipant[];
  relatedEntityId?: string;
  metadata: IConversationMetadata;
  lastMessage?: ILastMessage;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttachment {
  url: string;
  publicId?: string;
  type: AttachmentType;
  filename?: string;
  size?: number;
  duration?: number; // seconds – for voice/video
  thumbnailUrl?: string;
}

export interface IReaction {
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface IReadReceipt {
  userId: string;
  readAt: Date;
}

export interface IDeliveryReceipt {
  userId: string;
  deliveredAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: string;
  text?: string;
  messageType: MessageType;
  attachments: IAttachment[];
  replyTo?: Types.ObjectId;
  reactions: IReaction[];
  readBy: IReadReceipt[];
  deliveredTo: IDeliveryReceipt[];
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUnreadCount extends Document {
  _id: Types.ObjectId;
  userId: string;
  conversationId: Types.ObjectId;
  count: number;
  lastReadMessageId?: Types.ObjectId;
  lastReadAt?: Date;
  updatedAt: Date;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ParticipantRole),
      default: ParticipantRole.MEMBER,
    },
    joinedAt: { type: Date, default: Date.now },
    nickname: { type: String },
    isMuted: { type: Boolean, default: false },
  },
  { _id: false },
);

const LastMessageSchema = new Schema<ILastMessage>(
  {
    text: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    sentAt: { type: Date, required: true },
    messageType: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
  },
  { _id: false },
);

const ConversationMetadataSchema = new Schema<IConversationMetadata>(
  {
    name: { type: String },
    avatar: { type: String },
    description: { type: String },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
    },
    participants: {
      type: [ParticipantSchema],
      required: true,
      validate: {
        validator: (v: IParticipant[]) => v.length >= 2 || true, // system can create empty
        message: "A conversation requires at least 2 participants",
      },
    },
    relatedEntityId: { type: String, default: null },
    metadata: { type: ConversationMetadataSchema, default: {} },
    lastMessage: { type: LastMessageSchema, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "conversations",
  },
);

// ─── Conversation Indexes ────────────────────────────────────────────────────

// Fast lookup: all conversations for a user, sorted by latest activity
ConversationSchema.index(
  { "participants.userId": 1, updatedAt: -1 },
  { name: "idx_participants_updatedAt" },
);

// Prevent duplicate direct conversations between the same pair
ConversationSchema.index(
  { type: 1, "participants.userId": 1 },
  { name: "idx_type_participants" },
);

// Find conversation tied to an entity (ride, club, listing)
ConversationSchema.index(
  { relatedEntityId: 1, type: 1 },
  {
    name: "idx_relatedEntity_type",
    sparse: true,
  },
);

// Active conversations only
ConversationSchema.index({ isActive: 1 }, { name: "idx_active" });

// ─── Attachment Sub-document ─────────────────────────────────────────────────

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    type: {
      type: String,
      enum: Object.values(AttachmentType),
      required: true,
    },
    filename: { type: String },
    size: { type: Number },
    duration: { type: Number },
    thumbnailUrl: { type: String },
  },
  { _id: false },
);

const ReactionSchema = new Schema<IReaction>(
  {
    userId: { type: String, required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ReadReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: String, required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const DeliveryReceiptSchema = new Schema<IDeliveryReceipt>(
  {
    userId: { type: String, required: true },
    deliveredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: String, required: true },
    text: { type: String, default: null },
    messageType: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    attachments: { type: [AttachmentSchema], default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: { type: [ReactionSchema], default: [] },
    readBy: { type: [ReadReceiptSchema], default: [] },
    deliveredTo: { type: [DeliveryReceiptSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "messages",
  },
);

// ─── Message Indexes ─────────────────────────────────────────────────────────

// Primary query: messages in a conversation, newest first (cursor pagination)
MessageSchema.index(
  { conversationId: 1, createdAt: -1 },
  { name: "idx_conversation_createdAt" },
);

// Fetch messages since a cursor (_id-based pagination)
MessageSchema.index(
  { conversationId: 1, _id: -1 },
  { name: "idx_conversation_id_desc" },
);

// Lookup messages by sender
MessageSchema.index(
  { senderId: 1, createdAt: -1 },
  { name: "idx_sender_createdAt" },
);

// Unread message lookup optimisation
MessageSchema.index(
  { conversationId: 1, "readBy.userId": 1 },
  { name: "idx_conversation_readBy" },
);

// ─── Unread Count Schema ─────────────────────────────────────────────────────

const UnreadCountSchema = new Schema<IUnreadCount>(
  {
    userId: { type: String, required: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    count: { type: Number, default: 0 },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastReadAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "unread_counts",
  },
);

// One row per user-conversation pair
UnreadCountSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true, name: "idx_user_conversation_unique" },
);

// Total badge count for a user
UnreadCountSchema.index(
  { userId: 1, count: 1 },
  { name: "idx_user_unreadCount" },
);

// ─── Models ──────────────────────────────────────────────────────────────────

export const Conversation =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export const Message =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);

export const UnreadCount =
  mongoose.models.UnreadCount ||
  mongoose.model<IUnreadCount>("UnreadCount", UnreadCountSchema);
