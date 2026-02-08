import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Media type enum
 */
export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
}

/**
 * Media folder paths for organization
 */
export enum MediaFolder {
  PROFILES = "zoomies/profiles",
  CLUBS = "zoomies/clubs",
  CLUB_COVERS = "zoomies/clubs/covers",
  RIDES = "zoomies/rides",
  LISTINGS = "zoomies/marketplace",
  POSTS = "zoomies/posts",
}

/**
 * Upload result interface
 */
export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  duration?: number; // For videos
  resourceType: string;
  createdAt: string;
  thumbnailUrl?: string;
}

/**
 * Upload options interface
 */
export interface UploadOptions {
  folder: MediaFolder;
  publicId?: string;
  transformation?: any[];
  resourceType?: "image" | "video" | "auto";
  eager?: any[]; // For generating thumbnails/transformations on upload
  tags?: string[];
}

/**
 * Default image transformations
 */
const imageTransformations = {
  profile: [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ],
  clubLogo: [
    { width: 500, height: 500, crop: "fill" },
    { quality: "auto", fetch_format: "auto" },
  ],
  clubCover: [
    { width: 1200, height: 400, crop: "fill" },
    { quality: "auto", fetch_format: "auto" },
  ],
  ridePhoto: [
    { width: 1200, height: 800, crop: "limit" },
    { quality: "auto", fetch_format: "auto" },
  ],
  listingImage: [
    { width: 1000, height: 1000, crop: "limit" },
    { quality: "auto", fetch_format: "auto" },
  ],
  thumbnail: [
    { width: 200, height: 200, crop: "fill" },
    { quality: "auto", fetch_format: "auto" },
  ],
};

/**
 * Upload a file to Cloudinary from base64 or URL
 */
export async function uploadMedia(
  file: string, // Base64 string or URL
  options: UploadOptions,
): Promise<UploadResult> {
  const uploadOptions: UploadApiOptions = {
    folder: options.folder,
    resource_type: options.resourceType || "auto",
    unique_filename: true,
    overwrite: false,
    ...(options.publicId && { public_id: options.publicId }),
    ...(options.transformation && { transformation: options.transformation }),
    ...(options.tags && { tags: options.tags }),
    ...(options.eager && { eager: options.eager }),
  };

  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(
      file,
      uploadOptions,
    );

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration,
      resourceType: result.resource_type,
      createdAt: result.created_at,
      thumbnailUrl: result.eager?.[0]?.secure_url,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload media: ${(error as Error).message}`);
  }
}

/**
 * Upload profile image with face detection
 */
export async function uploadProfileImage(
  file: string,
  userId: string,
): Promise<UploadResult> {
  return uploadMedia(file, {
    folder: MediaFolder.PROFILES,
    publicId: `profile_${userId}`,
    transformation: imageTransformations.profile,
    eager: [imageTransformations.thumbnail],
  });
}

/**
 * Upload club logo
 */
export async function uploadClubLogo(
  file: string,
  clubId: string,
): Promise<UploadResult> {
  return uploadMedia(file, {
    folder: MediaFolder.CLUBS,
    publicId: `logo_${clubId}`,
    transformation: imageTransformations.clubLogo,
    eager: [imageTransformations.thumbnail],
  });
}

/**
 * Upload club cover image
 */
export async function uploadClubCover(
  file: string,
  clubId: string,
): Promise<UploadResult> {
  return uploadMedia(file, {
    folder: MediaFolder.CLUB_COVERS,
    publicId: `cover_${clubId}`,
    transformation: imageTransformations.clubCover,
  });
}

/**
 * Upload ride photos/videos
 */
export async function uploadRideMedia(
  file: string,
  rideId: string,
  type: MediaType = MediaType.IMAGE,
): Promise<UploadResult> {
  const options: UploadOptions = {
    folder: MediaFolder.RIDES,
    tags: [`ride_${rideId}`],
    resourceType: type === MediaType.VIDEO ? "video" : "image",
  };

  if (type === MediaType.IMAGE) {
    options.transformation = imageTransformations.ridePhoto;
    options.eager = [imageTransformations.thumbnail];
  } else {
    // Video transformations
    options.eager = [
      { format: "mp4", video_codec: "h264" },
      {
        format: "jpg",
        start_offset: "0",
        transformation: imageTransformations.thumbnail,
      },
    ];
  }

  return uploadMedia(file, options);
}

/**
 * Upload marketplace listing images
 */
export async function uploadListingImage(
  file: string,
  listingId: string,
): Promise<UploadResult> {
  return uploadMedia(file, {
    folder: MediaFolder.LISTINGS,
    tags: [`listing_${listingId}`],
    transformation: imageTransformations.listingImage,
    eager: [imageTransformations.thumbnail],
  });
}

/**
 * Upload post media
 */
export async function uploadPostMedia(
  file: string,
  postId: string,
  type: MediaType = MediaType.IMAGE,
): Promise<UploadResult> {
  return uploadMedia(file, {
    folder: MediaFolder.POSTS,
    tags: [`post_${postId}`],
    resourceType: type === MediaType.VIDEO ? "video" : "image",
    eager: [imageTransformations.thumbnail],
  });
}

/**
 * Delete media from Cloudinary
 */
export async function deleteMedia(
  publicId: string,
  resourceType: "image" | "video" = "image",
): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result.result === "ok";
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return false;
  }
}

/**
 * Delete multiple media files
 */
export async function deleteMultipleMedia(
  publicIds: string[],
  resourceType: "image" | "video" = "image",
): Promise<{ deleted: string[]; failed: string[] }> {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });
    const deleted = Object.keys(result.deleted).filter(
      (id) => result.deleted[id] === "deleted",
    );
    const failed = Object.keys(result.deleted).filter(
      (id) => result.deleted[id] !== "deleted",
    );
    return { deleted, failed };
  } catch (error) {
    console.error("Cloudinary bulk delete error:", error);
    return { deleted: [], failed: publicIds };
  }
}

/**
 * Get media URLs with transformations
 */
export function getOptimizedUrl(
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    format?: string;
  },
): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width: options?.width,
        height: options?.height,
        crop: options?.crop || "fill",
        fetch_format: options?.format || "auto",
        quality: "auto",
      },
    ],
  });
}

/**
 * Generate upload signature for direct client uploads
 */
export function generateUploadSignature(
  folder: MediaFolder,
  timestamp: number = Math.round(Date.now() / 1000),
): { signature: string; timestamp: number; cloudName: string; apiKey: string } {
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!,
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
  };
}

export default cloudinary;
