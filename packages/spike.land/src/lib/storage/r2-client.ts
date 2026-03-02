import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Global type declaration for development caching
declare global {
  var __r2Client: S3Client | undefined;
  var __r2BucketName: string | undefined;
}

export interface StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  region: string;
}

/**
 * Get storage configuration from environment variables.
 * Reads S3_* vars first (AWS S3), falling back to CLOUDFLARE_R2_* vars (R2).
 * Pass bucketEnvKeys to check additional env vars for the bucket name.
 */
export function getStorageConfig(bucketEnvKeys?: string[]): StorageConfig {
  const accessKeyId = (
    process.env.S3_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  )?.trim();
  const secretAccessKey = (
    process.env.S3_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  )?.trim();

  // Check additional bucket env keys first, then fall back to defaults
  let bucket: string | undefined;
  if (bucketEnvKeys) {
    for (const key of bucketEnvKeys) {
      bucket = process.env[key]?.trim();
      if (bucket) break;
    }
  }
  if (!bucket) {
    bucket = (process.env.S3_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME)?.trim();
  }

  // Endpoint is optional for native AWS S3, required for R2 / LocalStack
  const endpoint = (process.env.S3_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT)?.trim();
  const region = process.env.S3_REGION || process.env.AWS_REGION || "auto";

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Object storage credentials are not configured. " +
        "Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME " +
        "(or CLOUDFLARE_R2_* equivalents).",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    ...(endpoint !== undefined ? { endpoint } : {}),
    region,
  };
}

/**
 * Create an S3Client from a StorageConfig. Reusable by other storage modules.
 */
export function createS3ClientFromConfig(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    // forcePathStyle is required for S3-compatible providers (R2, LocalStack)
    forcePathStyle: !!config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function getR2Client(): S3Client {
  // In development, always create fresh client to pick up env changes
  // In production, use cached client for performance
  if (process.env.NODE_ENV === "development") {
    return createS3ClientFromConfig(getStorageConfig());
  }

  // Production: use global cache to survive hot reloads
  if (!global.__r2Client) {
    const config = getStorageConfig();
    global.__r2Client = createS3ClientFromConfig(config);
    global.__r2BucketName = config.bucket;
  }
  return global.__r2Client;
}

function getBucketName(): string {
  if (process.env.NODE_ENV === "development") {
    return getStorageConfig().bucket;
  }

  if (!global.__r2BucketName) {
    global.__r2BucketName = getStorageConfig().bucket;
  }
  return global.__r2BucketName;
}

/**
 * Generate a presigned URL for uploading to object storage (S3 / R2)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
): Promise<string> {
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = getR2Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export interface UploadImageParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadImageResult {
  success: boolean;
  key: string;
  url: string;
  error?: string;
}

export interface DeleteImageResult {
  success: boolean;
  key: string;
  error?: string;
}

/**
 * Upload a file to object storage (S3 / R2)
 */
export async function uploadToR2(params: UploadImageParams): Promise<UploadImageResult> {
  const { key, buffer, contentType, metadata } = params;

  const uploadOperation = async () => {
    const client = getR2Client();
    const bucket = getBucketName();

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

    await upload.done();

    // Construct the public URL
    const publicUrl = (process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL)?.trim();
    if (!publicUrl) {
      throw new Error("S3_PUBLIC_URL (or CLOUDFLARE_R2_PUBLIC_URL) is not configured");
    }
    return `${publicUrl}/${key}`;
  };

  const { data: url, error } = await tryCatch(uploadOperation());

  if (error) {
    logger.error("Error uploading to object storage", { error });
    return {
      success: false,
      key,
      url: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return {
    success: true,
    key,
    url,
  };
}

/**
 * Download a file from object storage (S3 / R2)
 */
export async function downloadFromR2(key: string): Promise<Buffer | null> {
  const downloadOperation = async () => {
    const client = getR2Client();
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    const chunks: Uint8Array[] = [];

    if (response.Body) {
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    }

    return Buffer.concat(chunks);
  };

  const { data, error } = await tryCatch(downloadOperation());

  if (error) {
    logger.error("Error downloading from object storage", { error });
    return null;
  }

  return data;
}

/**
 * Delete a file from object storage (S3 / R2)
 */
export async function deleteFromR2(key: string): Promise<DeleteImageResult> {
  const deleteOperation = async () => {
    const client = getR2Client();
    const bucket = getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  };

  const { error } = await tryCatch(deleteOperation());

  if (error) {
    logger.error("Error deleting from object storage", { error });
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
 * Check if object storage (S3 / R2) is properly configured
 */
export function isStorageConfigured(): boolean {
  const hasS3 = !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME &&
    (process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL)
  );
  const hasR2 = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME &&
    process.env.CLOUDFLARE_R2_ENDPOINT &&
    process.env.CLOUDFLARE_R2_PUBLIC_URL
  );
  return hasS3 || hasR2;
}

export interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  averageSizeBytes: number;
  byFileType: Record<string, { count: number; sizeBytes: number }>;
}

export interface ListStorageResult {
  success: boolean;
  stats: StorageStats | null;
  truncated?: boolean;
  error?: string;
}

/**
 * List all objects in the storage bucket and calculate statistics
 */
export async function listR2StorageStats(): Promise<ListStorageResult> {
  const listOperation = async () => {
    const client = getR2Client();
    const bucket = getBucketName();

    const stats: StorageStats = {
      totalFiles: 0,
      totalSizeBytes: 0,
      averageSizeBytes: 0,
      byFileType: {},
    };

    let continuationToken: string | undefined;
    let hasMore = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Cap at 100 pages (100k objects) to prevent timeout/OOM

    // Paginate through all objects
    while (hasMore && iterations < MAX_ITERATIONS) {
      iterations++;
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          const size = object.Size || 0;
          stats.totalFiles++;
          stats.totalSizeBytes += size;

          // Extract file extension
          const key = object.Key || "";
          const ext = key.includes(".")
            ? key.split(".").pop()?.toLowerCase() || "unknown"
            : "unknown";

          if (!stats.byFileType[ext]) {
            stats.byFileType[ext] = { count: 0, sizeBytes: 0 };
          }
          stats.byFileType[ext].count++;
          stats.byFileType[ext].sizeBytes += size;
        }
      }

      continuationToken = response.NextContinuationToken;
      hasMore = response.IsTruncated === true;
    }

    // Calculate average
    if (stats.totalFiles > 0) {
      stats.averageSizeBytes = Math.round(stats.totalSizeBytes / stats.totalFiles);
    }

    const truncated = hasMore && iterations >= MAX_ITERATIONS;
    return { stats, truncated };
  };

  const { data, error } = await tryCatch(listOperation());

  if (error) {
    logger.error("Error listing storage objects", { error });
    return {
      success: false,
      stats: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  return {
    success: true,
    stats: data.stats,
    truncated: data.truncated,
  };
}
