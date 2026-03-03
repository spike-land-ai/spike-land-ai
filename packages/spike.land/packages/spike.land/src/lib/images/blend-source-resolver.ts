import prisma from "@/lib/prisma";
import { processAndUploadImage } from "@/lib/storage/upload-handler";
import { tryCatch } from "@/lib/try-catch";

/**
 * Resolved blend source data ready for enhancement
 */
export interface BlendSourceResult {
  base64: string;
  mimeType: string;
  sourceImageId: string;
}

/**
 * Input for blend source resolution
 */
export interface BlendSourceInput {
  /** Image ID of stored image (Option A) */
  imageId?: string;
  /** Base64-encoded image data (Option B) */
  base64?: string;
  /** MIME type for base64 data */
  mimeType?: string;
}

/**
 * Error types for blend source resolution
 */
export type BlendSourceErrorCode =
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "FETCH_FAILED"
  | "UPLOAD_FAILED"
  | "INVALID_INPUT";

/**
 * Error result from blend source resolution
 */
export interface BlendSourceError {
  code: BlendSourceErrorCode;
  message: string;
  suggestion: string;
}

/**
 * Success result from blend source resolution
 */
interface BlendSourceSuccess {
  success: true;
  data: BlendSourceResult;
}

/**
 * Failure result from blend source resolution
 */
interface BlendSourceFailure {
  success: false;
  error: BlendSourceError;
}

export type ResolveBlendSourceResult = BlendSourceSuccess | BlendSourceFailure;

/**
 * Resolves a blend source input to base64 data
 *
 * Handles two scenarios:
 * 1. Stored image by ID: Fetches from R2, converts to base64
 * 2. Uploaded base64: Uploads to R2, creates DB record, returns data
 *
 * @param input - The blend source input (imageId or base64/mimeType)
 * @param userId - The authenticated user's ID (for ownership verification)
 * @param targetImageId - The target image ID (for logging context)
 * @returns Resolved blend source or error
 */
export async function resolveBlendSource(
  input: BlendSourceInput,
  userId: string,
  _targetImageId: string,
): Promise<ResolveBlendSourceResult> {
  // Option A: Resolve stored image by ID
  if (input.imageId) {
    return resolveStoredImage(input.imageId, userId);
  }

  // Option B: Process uploaded base64 data
  if (input.base64 && input.mimeType) {
    return processUploadedBlendSource(input.base64, input.mimeType, userId);
  }

  // Neither option provided - should be caught by Zod validation
  return {
    success: false,
    error: {
      code: "INVALID_INPUT",
      message: "Invalid blend source",
      suggestion: "Please provide either an image ID or base64 data.",
    },
  };
}

/**
 * Resolves a stored image by ID
 */
async function resolveStoredImage(
  imageId: string,
  userId: string,
): Promise<ResolveBlendSourceResult> {
  const { data: sourceImage, error: sourceError } = await tryCatch(
    prisma.enhancedImage.findUnique({
      where: { id: imageId },
      select: {
        id: true,
        userId: true,
        originalUrl: true,
        originalFormat: true,
      },
    }),
  );

  if (sourceError || !sourceImage) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Blend source image not found",
        suggestion: "The selected image may have been deleted.",
      },
    };
  }

  // Verify user owns the source image
  if (sourceImage.userId !== userId) {
    return {
      success: false,
      error: {
        code: "ACCESS_DENIED",
        message: "Access denied to blend source image",
        suggestion: "You can only blend with your own images.",
      },
    };
  }

  // Fetch the image from R2 and convert to base64
  const { data: fetchResponse, error: fetchError } = await tryCatch(
    fetch(sourceImage.originalUrl, {
      headers: { Accept: "image/*" },
    }),
  );

  if (fetchError || !fetchResponse || !fetchResponse.ok) {
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: "Failed to load blend source image",
        suggestion: "Please try again or select a different image.",
      },
    };
  }

  const { data: arrayBuffer, error: bufferError } = await tryCatch(
    fetchResponse.arrayBuffer(),
  );

  if (bufferError || !arrayBuffer) {
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: "Failed to process blend source image",
        suggestion: "Please try again or select a different image.",
      },
    };
  }

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = fetchResponse.headers.get("content-type")
    || `image/${sourceImage.originalFormat || "jpeg"}`;

  return {
    success: true,
    data: {
      base64,
      mimeType,
      sourceImageId: sourceImage.id,
    },
  };
}

/**
 * Processes an uploaded base64 blend source
 */
async function processUploadedBlendSource(
  base64: string,
  mimeType: string,
  userId: string,
): Promise<ResolveBlendSourceResult> {
  // Upload blend source to R2 and create EnhancedImage record
  const buffer = Buffer.from(base64, "base64");
  const extension = mimeType.split("/")[1] || "jpg";

  const { data: uploadResult, error: uploadError } = await tryCatch(
    processAndUploadImage({
      buffer,
      originalFilename: `blend-source-${Date.now()}.${extension}`,
      userId,
    }),
  );

  if (uploadError || !uploadResult?.success) {
    return {
      success: false,
      error: {
        code: "UPLOAD_FAILED",
        message: "Failed to save blend source image",
        suggestion: "Please try again with the same image.",
      },
    };
  }

  // Create EnhancedImage record for the blend source
  const { data: blendSourceImage, error: createError } = await tryCatch(
    prisma.enhancedImage.create({
      data: {
        userId,
        name: "Blend Source",
        originalUrl: uploadResult.url,
        originalR2Key: uploadResult.r2Key,
        originalWidth: uploadResult.width,
        originalHeight: uploadResult.height,
        originalSizeBytes: uploadResult.sizeBytes,
        originalFormat: uploadResult.format,
        isPublic: false,
      },
    }),
  );

  if (createError || !blendSourceImage) {
    return {
      success: false,
      error: {
        code: "UPLOAD_FAILED",
        message: "Failed to save blend source image",
        suggestion: "Please try again.",
      },
    };
  }

  return {
    success: true,
    data: {
      base64,
      mimeType,
      sourceImageId: blendSourceImage.id,
    },
  };
}

/**
 * Maps error codes to HTTP status codes
 */
export function getHttpStatusForError(code: BlendSourceErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "ACCESS_DENIED":
      return 403;
    case "INVALID_INPUT":
      return 400;
    case "FETCH_FAILED":
    case "UPLOAD_FAILED":
      return 500;
    default:
      return 500;
  }
}
