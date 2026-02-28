/**
 * Audio Storage Client - S3-compatible object storage for audio files
 * Supports AWS S3 and Cloudflare R2 via env var configuration.
 * Resolves #332
 */

import logger from "@/lib/logger";
import {
  createS3ClientFromConfig,
  getStorageConfig,
} from "@/lib/storage/r2-client";
import { tryCatch } from "@/lib/try-catch";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Global type declaration for development caching
declare global {
  var __audioR2Client: S3Client | undefined;
  var __audioR2BucketName: string | undefined;
}

// Audio-specific constants
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB max
const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/m4a",
  "audio/x-m4a",
];

// Audio bucket checks S3_AUDIO_BUCKET_NAME first, then falls back to default
const AUDIO_BUCKET_ENV_KEYS = [
  "S3_AUDIO_BUCKET_NAME",
  "CLOUDFLARE_R2_AUDIO_BUCKET_NAME",
];

function getAudioR2Client(): S3Client {
  // In development, always create fresh client to pick up env changes
  if (process.env.NODE_ENV === "development") {
    return createS3ClientFromConfig(getStorageConfig(AUDIO_BUCKET_ENV_KEYS));
  }

  // Production: use global cache
  if (!global.__audioR2Client) {
    const config = getStorageConfig(AUDIO_BUCKET_ENV_KEYS);
    global.__audioR2Client = createS3ClientFromConfig(config);
    global.__audioR2BucketName = config.bucket;
  }
  return global.__audioR2Client;
}

function getAudioBucketName(): string {
  if (process.env.NODE_ENV === "development") {
    return getStorageConfig(AUDIO_BUCKET_ENV_KEYS).bucket;
  }

  if (!global.__audioR2BucketName) {
    global.__audioR2BucketName = getStorageConfig(AUDIO_BUCKET_ENV_KEYS).bucket;
  }
  return global.__audioR2BucketName;
}

/**
 * Generate R2 key for an audio track
 * Pattern: users/{userId}/audio-projects/{projectId}/tracks/{trackId}.{format}
 */
export function generateAudioKey(
  userId: string,
  projectId: string,
  trackId: string,
  format: string,
): string {
  return `users/${userId}/audio-projects/${projectId}/tracks/${trackId}.${format}`;
}


interface UploadAudioParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

interface UploadAudioResult {
  success: boolean;
  key: string;
  url: string;
  sizeBytes: number;
  error?: string;
}

interface DeleteAudioResult {
  success: boolean;
  key: string;
  error?: string;
}

interface AudioMetadata {
  key: string;
  size: number;
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Validate audio file before upload
 */
function validateAudioFile(
  buffer: Buffer,
  contentType: string,
): { valid: boolean; error?: string; } {
  if (buffer.length > MAX_AUDIO_SIZE_BYTES) {
    return {
      valid: false,
      error:
        `File size ${buffer.length} exceeds maximum allowed size of ${MAX_AUDIO_SIZE_BYTES} bytes (500MB)`,
    };
  }

  if (!ALLOWED_AUDIO_MIME_TYPES.includes(contentType.toLowerCase())) {
    return {
      valid: false,
      error: `Content type '${contentType}' is not allowed. Allowed types: ${
        ALLOWED_AUDIO_MIME_TYPES.join(", ")
      }`,
    };
  }

  return { valid: true };
}

/**
 * Upload an audio file to object storage (S3 / R2)
 */
export async function uploadAudioToR2(
  params: UploadAudioParams,
): Promise<UploadAudioResult> {
  const { key, buffer, contentType, metadata } = params;

  // Validate before upload
  const validation = validateAudioFile(buffer, contentType);
  if (!validation.valid) {
    return {
      success: false,
      key,
      url: "",
      sizeBytes: 0,
      ...(validation.error !== undefined ? { error: validation.error } : {}),
    };
  }

  const client = getAudioR2Client();
  const bucket = getAudioBucketName();

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    },
  });

  const { error } = await tryCatch(upload.done());
  if (error) {
    logger.error("Error uploading audio to object storage", { error });
    return {
      success: false,
      key,
      url: "",
      sizeBytes: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Construct the public URL
  const publicUrl = (
    process.env.S3_AUDIO_PUBLIC_URL
    || process.env.CLOUDFLARE_R2_AUDIO_PUBLIC_URL
    || process.env.S3_PUBLIC_URL
    || process.env.CLOUDFLARE_R2_PUBLIC_URL
  )?.trim();
  if (!publicUrl) {
    return {
      success: false,
      key,
      url: "",
      sizeBytes: 0,
      error: "S3_AUDIO_PUBLIC_URL (or CLOUDFLARE_R2_AUDIO_PUBLIC_URL) is not configured",
    };
  }
  const url = `${publicUrl}/${key}`;

  return {
    success: true,
    key,
    url,
    sizeBytes: buffer.length,
  };
}

/**
 * Download an audio file from object storage (S3 / R2)
 */
export async function downloadAudioFromR2(key: string): Promise<Buffer | null> {
  const client = getAudioR2Client();
  const bucket = getAudioBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const { data: response, error } = await tryCatch(client.send(command));
  if (error) {
    logger.error("Error downloading audio from object storage", { error });
    return null;
  }

  const chunks: Uint8Array[] = [];

  if (response.Body) {
    const { error: streamError } = await tryCatch(
      (async () => {
        for await (const chunk of response.Body! as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      })(),
    );
    if (streamError) {
      logger.error("Error streaming audio from object storage", {
        error: streamError,
      });
      return null;
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Delete an audio file from object storage (S3 / R2)
 */
export async function deleteAudioFromR2(
  key: string,
): Promise<DeleteAudioResult> {
  const client = getAudioR2Client();
  const bucket = getAudioBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const { error } = await tryCatch(client.send(command));
  if (error) {
    logger.error("Error deleting audio from object storage", { error });
    return {
      success: false,
      key,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return {
    success: true,
    key,
  };
}

/**
 * Get metadata for an audio file
 */
export async function getAudioMetadata(
  key: string,
): Promise<AudioMetadata | null> {
  const client = getAudioR2Client();
  const bucket = getAudioBucketName();

  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const { data: response, error } = await tryCatch(client.send(command));
  if (error) {
    // NotFound is expected for cache misses - don't log
    if (error.name !== "NotFound") {
      logger.error("Error getting audio metadata from object storage", {
        error,
      });
    }
    return null;
  }

  return {
    key,
    size: response.ContentLength || 0,
    ...(response.LastModified !== undefined ? { lastModified: response.LastModified } : {}),
    ...(response.ContentType !== undefined ? { contentType: response.ContentType } : {}),
    ...(response.Metadata !== undefined ? { metadata: response.Metadata } : {}),
  };
}

/**
 * Check if audio object storage (S3 / R2) is properly configured
 */
export function isAudioStorageConfigured(): boolean {
  const hasS3 = !!(
    process.env.S3_ACCESS_KEY_ID
    && process.env.S3_SECRET_ACCESS_KEY
    && (process.env.S3_AUDIO_PUBLIC_URL || process.env.S3_PUBLIC_URL
      || process.env.CLOUDFLARE_R2_AUDIO_PUBLIC_URL
      || process.env.CLOUDFLARE_R2_PUBLIC_URL)
  );
  const hasR2 = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID
    && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
    && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    && process.env.CLOUDFLARE_R2_ENDPOINT
    && (process.env.CLOUDFLARE_R2_AUDIO_PUBLIC_URL
      || process.env.CLOUDFLARE_R2_PUBLIC_URL)
  );
  return hasS3 || hasR2;
}

/**
 * Get the public URL for an audio file
 */
export function getAudioPublicUrl(key: string): string {
  const publicUrl = (
    process.env.S3_AUDIO_PUBLIC_URL
    || process.env.CLOUDFLARE_R2_AUDIO_PUBLIC_URL
    || process.env.S3_PUBLIC_URL
    || process.env.CLOUDFLARE_R2_PUBLIC_URL
  )?.trim();
  if (!publicUrl) {
    throw new Error(
      "S3_AUDIO_PUBLIC_URL (or CLOUDFLARE_R2_AUDIO_PUBLIC_URL) is not configured",
    );
  }
  return `${publicUrl}/${key}`;
}
