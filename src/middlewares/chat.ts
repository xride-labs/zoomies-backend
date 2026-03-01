import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Conversation, ParticipantRole } from "../models/chat.model.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";

/**
 * Middleware: Ensure the authenticated user is a participant in the
 * conversation identified by `req.params.id`.
 *
 * Attaches `req.conversation` for downstream handlers.
 */
export async function requireConversationAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      ApiResponse.unauthorized(
        res,
        "Authentication required",
        ErrorCode.UNAUTHORIZED,
      );
      return;
    }

    const conversationId = req.params.id;
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      ApiResponse.validationError(
        res,
        "Invalid conversation ID",
        ErrorCode.VALIDATION_ERROR,
      );
      return;
    }

    const conversation = await Conversation.findOne({
      _id: new Types.ObjectId(conversationId),
      "participants.userId": userId,
      isActive: true,
    }).lean();

    if (!conversation) {
      ApiResponse.notFound(
        res,
        "Conversation not found or access denied",
        ErrorCode.NOT_FOUND,
      );
      return;
    }

    // Attach to request for downstream use
    (req as any).conversation = conversation;
    next();
  } catch (error) {
    ApiResponse.internalError(
      res,
      "Failed to verify conversation access",
      error as Error,
    );
  }
}

/**
 * Middleware: Ensure the authenticated user is an admin/owner of the
 * conversation (for group management operations).
 */
export async function requireConversationAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      ApiResponse.unauthorized(
        res,
        "Authentication required",
        ErrorCode.UNAUTHORIZED,
      );
      return;
    }

    const conversationId = req.params.id;
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      ApiResponse.validationError(
        res,
        "Invalid conversation ID",
        ErrorCode.VALIDATION_ERROR,
      );
      return;
    }

    const conversation = await Conversation.findOne({
      _id: new Types.ObjectId(conversationId),
      isActive: true,
      participants: {
        $elemMatch: {
          userId,
          role: { $in: [ParticipantRole.ADMIN, ParticipantRole.OWNER] },
        },
      },
    }).lean();

    if (!conversation) {
      ApiResponse.forbidden(
        res,
        "Admin or owner role required for this action",
        ErrorCode.INSUFFICIENT_PERMISSIONS,
      );
      return;
    }

    (req as any).conversation = conversation;
    next();
  } catch (error) {
    ApiResponse.internalError(
      res,
      "Failed to verify conversation admin access",
      error as Error,
    );
  }
}

/**
 * Validate that the current user is the sender of a message
 * (used for edit/delete operations).
 */
export async function requireMessageOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { default: mongoose } = await import("mongoose");
    const Message = mongoose.model("Message");

    const userId = req.session?.user?.id;
    if (!userId) {
      ApiResponse.unauthorized(
        res,
        "Authentication required",
        ErrorCode.UNAUTHORIZED,
      );
      return;
    }

    const { messageId } = req.params;
    if (!messageId || !Types.ObjectId.isValid(messageId)) {
      ApiResponse.validationError(
        res,
        "Invalid message ID",
        ErrorCode.VALIDATION_ERROR,
      );
      return;
    }

    const message = await Message.findOne({
      _id: new Types.ObjectId(messageId),
      senderId: userId,
      deletedAt: null,
    }).lean();

    if (!message) {
      ApiResponse.notFound(
        res,
        "Message not found or you are not the sender",
        ErrorCode.NOT_FOUND,
      );
      return;
    }

    (req as any).message = message;
    next();
  } catch (error) {
    ApiResponse.internalError(
      res,
      "Failed to verify message ownership",
      error as Error,
    );
  }
}
