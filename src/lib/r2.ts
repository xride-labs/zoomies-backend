import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { UploadResult } from "./cloudinary.js";

const R2_REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const missingR2Env = R2_REQUIRED_ENV.filter((key) => !process.env[key]);
export const R2_CONFIGURED = missingR2Env.length === 0;

if (!R2_CONFIGURED) {
  console.warn(
    `[R2] Missing env vars: ${missingR2Env.join(", ")}. R2 fallback uploads will be unavailable.`,
  );
}

const r2Client = R2_CONFIGURED
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

/**
 * Returns true when a Cloudinary error is a storage / quota / plan-limit error
 * — these are the only cases where we want to fall back to R2.
 */
export function isCloudinaryStorageLimitError(error: unknown): boolean {
  const err = error as any;
  const httpCode: number = err?.http_code ?? err?.statusCode ?? 0;
  const message: string = (err?.message ?? "").toLowerCase();

  // Cloudinary uses 420 for "Resource limits exceeded"
  if (httpCode === 420) return true;

  // Some account-level quota errors come back as 400
  if (
    httpCode === 400 &&
    (message.includes("storage") ||
      message.includes("quota") ||
      message.includes("limit exceeded") ||
      message.includes("upgrade") ||
      message.includes("plan"))
  ) {
    return true;
  }

  // Catch-all for any message that looks like a quota error regardless of code
  return (
    message.includes("storage is full") ||
    message.includes("storage quota") ||
    message.includes("quota exceeded") ||
    message.includes("plan exceeded") ||
    message.includes("account storage")
  );
}

/**
 * Upload a base64 data URL to Cloudflare R2.
 * Used only as a fallback when Cloudinary's storage limit is hit.
 *
 * @param dataUrl  - Normalised "data:<mime>;base64,<payload>" string
 * @param folder   - Mirrors the Cloudinary MediaFolder path (e.g. "zoomies/marketplace")
 * @param mimeType - e.g. "image/jpeg"
 */
export async function uploadToR2(
  dataUrl: string,
  folder: string,
  mimeType: string,
): Promise<UploadResult> {
  if (!r2Client) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL.",
    );
  }

  const base64Payload = dataUrl.split(",")[1];
  if (!base64Payload) throw new Error("Invalid data URL passed to uploadToR2");

  const buffer = Buffer.from(base64Payload, "base64");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const key = `${folder}/${uniqueSuffix}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Cache for 1 year — objects are immutable (unique key per upload)
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const publicUrl = `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;

  console.info(`[R2] Uploaded fallback asset: ${publicUrl}`);

  return {
    publicId: key,
    url: publicUrl,
    secureUrl: publicUrl,
    format: ext,
    bytes: buffer.byteLength,
    resourceType: mimeType.startsWith("video/") ? "video" : "image",
    createdAt: new Date().toISOString(),
  };
}
