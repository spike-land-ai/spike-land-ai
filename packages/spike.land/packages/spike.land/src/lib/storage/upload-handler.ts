import { tryCatch } from "@/lib/try-catch";
import crypto from "crypto";
import { uploadToR2 } from "./r2-client";
import { logger } from "@/lib/logger";

/**
 * Parameters for processing and uploading an image.
 * Images should be pre-processed client-side (resized, converted to WebP).
 */
interface ProcessImageParams {
  /** The image data as a Buffer */
  buffer: Buffer;
  /** Original filename for metadata */
  originalFilename: string;
  /** User ID for organizing storage */
  userId: string;
  /** Pre-calculated width (from client-side processing) */
  width?: number;
  /** Pre-calculated height (from client-side processing) */
  height?: number;
  /** Content type (default: image/webp) */
  contentType?: string;
}

interface ProcessImageResult {
  success: boolean;
  imageId: string;
  r2Key: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
  error?: string;
}

const DEFAULT_CONTENT_TYPE = "image/webp";

/**
 * Create an error result object
 */
function createErrorResult(errorMessage: string): ProcessImageResult {
  return {
    success: false,
    imageId: "",
    r2Key: "",
    url: "",
    width: 0,
    height: 0,
    sizeBytes: 0,
    format: "",
    error: errorMessage,
  };
}

/**
 * Process and upload an image to R2 storage.
 *
 * **Important:** Images should be pre-processed on the client side using
 * `client-image-processor.ts` before upload. This function now simply
 * stores the image without server-side resizing.
 *
 * For backwards compatibility, if width/height are not provided,
 * the function assumes the image is already properly sized.
 */
export async function processAndUploadImage(
  params: ProcessImageParams,
): Promise<ProcessImageResult> {
  const { buffer, originalFilename, userId } = params;
  const width = params.width ?? 0;
  const height = params.height ?? 0;
  const contentType = params.contentType ?? DEFAULT_CONTENT_TYPE;

  // Validate that we have dimensions for proper metadata
  if (width === 0 || height === 0) {
    logger.warn(
      "Image dimensions not provided. Client should pre-process images with client-image-processor.ts",
    );
  }

  // Generate unique image ID and R2 key
  const imageId = crypto.randomUUID();
  const extension = contentType === "image/webp" ? "webp" : "jpg";
  const r2Key = `users/${userId}/originals/${imageId}.${extension}`;

  // Upload to R2
  const { data: uploadResult, error: uploadError } = await tryCatch(
    uploadToR2({
      key: r2Key,
      buffer,
      contentType: contentType || DEFAULT_CONTENT_TYPE,
      metadata: {
        userId,
        originalFilename,
        originalWidth: String(width),
        originalHeight: String(height),
        processedWidth: String(width),
        processedHeight: String(height),
      },
    }),
  );

  if (uploadError) {
    logger.error("Error uploading image:", uploadError);
    return createErrorResult(
      uploadError instanceof Error ? uploadError.message : "Unknown error",
    );
  }

  if (!uploadResult.success) {
    return createErrorResult(uploadResult.error ?? "Upload failed");
  }

  return {
    success: true,
    imageId,
    r2Key,
    url: uploadResult.url,
    width,
    height,
    sizeBytes: buffer.length,
    format: extension,
  };
}

/**
 * Validate image file size
 */
export function validateImageFile(
  file: File | Buffer,
  maxSizeBytes = 50 * 1024 * 1024, // 50MB
): { valid: boolean; error?: string; } {
  const size = Buffer.isBuffer(file) ? file.length : (file as File).size;

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSizeBytes / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}


