import { Router, Request, Response } from "express";
import { requireAuth } from "../config/auth.js";
import { ApiResponse, ErrorCode } from "../lib/utils/apiResponse.js";
import { validateBody, asyncHandler } from "../middlewares/validation.js";
import { uploadMediaSchema } from "../validators/schemas.js";
import { z } from "zod";
import {
  uploadProfileImage,
  uploadClubLogo,
  uploadClubCover,
  uploadRideMedia,
  uploadListingImage,
  uploadPostMedia,
  deleteMedia,
  generateUploadSignature,
  MediaFolder,
  MediaType,
} from "../lib/cloudinary.js";

const router = Router();

// All media routes require authentication
router.use(requireAuth);

/**
 * POST /api/media/upload
 * Upload a media file (base64 or URL)
 */
router.post(
  "/upload",
  validateBody(
    uploadMediaSchema.extend({
      file: z.string().min(1, "File is required"),
      resourceId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { type, folder, file, resourceId } = req.body;

    try {
      let result;

      switch (folder) {
        case "profiles":
          result = await uploadProfileImage(file, session.user.id);
          break;
        case "clubs":
          if (!resourceId) {
            return ApiResponse.error(
              res,
              "Resource ID is required for club uploads",
              400,
              ErrorCode.MISSING_REQUIRED_FIELD,
            );
          }
          result = await uploadClubLogo(file, resourceId);
          break;
        case "rides":
          if (!resourceId) {
            return ApiResponse.error(
              res,
              "Resource ID is required for ride uploads",
              400,
              ErrorCode.MISSING_REQUIRED_FIELD,
            );
          }
          result = await uploadRideMedia(
            file,
            resourceId,
            type === "video" ? MediaType.VIDEO : MediaType.IMAGE,
          );
          break;
        case "listings":
          if (!resourceId) {
            return ApiResponse.error(
              res,
              "Resource ID is required for listing uploads",
              400,
              ErrorCode.MISSING_REQUIRED_FIELD,
            );
          }
          result = await uploadListingImage(file, resourceId);
          break;
        case "posts":
          if (!resourceId) {
            return ApiResponse.error(
              res,
              "Resource ID is required for post uploads",
              400,
              ErrorCode.MISSING_REQUIRED_FIELD,
            );
          }
          result = await uploadPostMedia(
            file,
            resourceId,
            type === "video" ? MediaType.VIDEO : MediaType.IMAGE,
          );
          break;
        default:
          return ApiResponse.error(
            res,
            "Invalid folder",
            400,
            ErrorCode.INVALID_INPUT,
          );
      }

      ApiResponse.success(
        res,
        { media: result },
        "Media uploaded successfully",
      );
    } catch (error) {
      console.error("Media upload error:", error);
      return ApiResponse.error(
        res,
        "Failed to upload media",
        500,
        ErrorCode.UPLOAD_FAILED,
        {
          message: (error as Error).message,
        },
      );
    }
  }),
);

/**
 * POST /api/media/upload/profile
 * Upload profile image
 */
router.post(
  "/upload/profile",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { file } = req.body;

    if (!file) {
      return ApiResponse.error(
        res,
        "File is required",
        400,
        ErrorCode.MISSING_REQUIRED_FIELD,
      );
    }

    try {
      const result = await uploadProfileImage(file, session.user.id);

      // Update user's image in database
      const prisma = (await import("../lib/prisma.js")).default;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { image: result.secureUrl },
      });

      ApiResponse.success(
        res,
        {
          media: result,
          imageUrl: result.secureUrl,
        },
        "Profile image uploaded successfully",
      );
    } catch (error) {
      console.error("Profile upload error:", error);
      return ApiResponse.error(
        res,
        "Failed to upload profile image",
        500,
        ErrorCode.UPLOAD_FAILED,
      );
    }
  }),
);

/**
 * POST /api/media/upload/club/:clubId
 * Upload club logo or cover image
 */
router.post(
  "/upload/club/:clubId",
  asyncHandler(async (req: Request, res: Response) => {
    const session = (req as any).session;
    const { clubId } = req.params;
    const { file, type = "logo" } = req.body; // type: "logo" or "cover"

    if (!file) {
      return ApiResponse.error(
        res,
        "File is required",
        400,
        ErrorCode.MISSING_REQUIRED_FIELD,
      );
    }

    // Verify ownership
    const prisma = (await import("../lib/prisma.js")).default;
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { ownerId: true },
    });

    if (!club) {
      return ApiResponse.notFound(
        res,
        "Club not found",
        ErrorCode.CLUB_NOT_FOUND,
      );
    }

    if (club.ownerId !== session.user.id) {
      return ApiResponse.forbidden(
        res,
        "You don't have permission to upload images for this club",
      );
    }

    try {
      let result;
      if (type === "cover") {
        result = await uploadClubCover(file, clubId);
        await prisma.club.update({
          where: { id: clubId },
          data: { coverImage: result.secureUrl },
        });
      } else {
        result = await uploadClubLogo(file, clubId);
        await prisma.club.update({
          where: { id: clubId },
          data: { image: result.secureUrl },
        });
      }

      ApiResponse.success(
        res,
        {
          media: result,
          imageUrl: result.secureUrl,
        },
        `Club ${type} uploaded successfully`,
      );
    } catch (error) {
      console.error("Club upload error:", error);
      return ApiResponse.error(
        res,
        `Failed to upload club ${type}`,
        500,
        ErrorCode.UPLOAD_FAILED,
      );
    }
  }),
);

/**
 * DELETE /api/media/:publicId
 * Delete a media file
 */
router.delete(
  "/:publicId",
  asyncHandler(async (req: Request, res: Response) => {
    const { publicId } = req.params;
    const { resourceType = "image" } = req.query as any;

    try {
      const success = await deleteMedia(publicId, resourceType);

      if (success) {
        ApiResponse.success(res, null, "Media deleted successfully");
      } else {
        ApiResponse.error(
          res,
          "Failed to delete media",
          500,
          ErrorCode.INTERNAL_ERROR,
        );
      }
    } catch (error) {
      console.error("Media delete error:", error);
      return ApiResponse.error(
        res,
        "Failed to delete media",
        500,
        ErrorCode.INTERNAL_ERROR,
      );
    }
  }),
);

/**
 * POST /api/media/signature
 * Generate upload signature for direct client uploads
 */
router.post(
  "/signature",
  asyncHandler(async (req: Request, res: Response) => {
    const { folder } = req.body;

    const validFolders: Record<string, MediaFolder> = {
      profiles: MediaFolder.PROFILES,
      clubs: MediaFolder.CLUBS,
      rides: MediaFolder.RIDES,
      listings: MediaFolder.LISTINGS,
      posts: MediaFolder.POSTS,
    };

    if (!folder || !validFolders[folder]) {
      return ApiResponse.error(
        res,
        "Valid folder is required",
        400,
        ErrorCode.INVALID_INPUT,
      );
    }

    const signature = generateUploadSignature(validFolders[folder]);

    ApiResponse.success(res, { signature }, "Upload signature generated");
  }),
);

export default router;
