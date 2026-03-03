import { type AspectRatio, detectAspectRatio } from "@/lib/ai/aspect-ratio";
import {
  generateImageWithGemini,
  modifyImageWithGemini,
} from "@/lib/ai/gemini-client";
import { WorkspaceCreditManager } from "@/lib/credits/workspace-credit-manager";
import { getImageDimensionsFromBuffer } from "@/lib/images/image-dimensions";
import prisma from "@/lib/prisma";
import { uploadToR2 } from "@/lib/storage/r2-client";
import { tryCatch } from "@/lib/try-catch";
import { JobStatus } from "@prisma/client";
import logger from "@/lib/logger";
import { classifyError as classifyErrorImpl } from "./error-classifier";
import type { ClassifiedError } from "./errors";

// Security: Maximum concurrent PROCESSING jobs per user to prevent burst attacks
export const MAX_CONCURRENT_JOBS_PER_USER = 3;

/**
 * Classifies errors into user-friendly messages with error codes.
 * Helps users understand what went wrong and how to fix it.
 *
 * Uses a robust classification approach that prioritizes:
 * 1. Error code/type properties (most reliable)
 * 2. HTTP status codes
 * 3. Error name/constructor
 * 4. Message patterns (fallback only)
 *
 * @param error - The error to classify
 * @returns Object with message, code, and retryable flag
 * @internal Exported for testing purposes
 */
export function classifyError(
  error: unknown,
): { message: string; code: string; retryable?: boolean; } {
  const classified: ClassifiedError = classifyErrorImpl(error);
  return {
    message: classified.message,
    code: classified.code,
    retryable: classified.retryable,
  };
}

/**
 * Check if user has too many concurrent processing jobs
 */
export async function checkConcurrentJobLimit(
  userId: string,
): Promise<boolean> {
  const processingCount = await prisma.mcpGenerationJob.count({
    where: {
      userId,
      status: JobStatus.PROCESSING,
    },
  });
  return processingCount < MAX_CONCURRENT_JOBS_PER_USER;
}

/**
 * Handle job failure - logs error, updates job status, and refunds tokens
 */
async function handleJobFailureWithLabel(
  label: string,
  jobId: string,
  error: Error,
): Promise<void> {
  logger.error(`${label} job ${jobId} failed`, { error });

  // Classify error for user-friendly message
  const classifiedError = classifyError(error);
  logger.info(
    `${label} job ${jobId} error classified as: ${classifiedError.code}`,
  );

  // Update job with failure
  await tryCatch(
    prisma.mcpGenerationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMessage: classifiedError.message,
        processingCompletedAt: new Date(),
      },
    }),
  );

  // Refund tokens
  const { data: job } = await tryCatch(
    prisma.mcpGenerationJob.findUnique({
      where: { id: jobId },
    }),
  );

  if (job) {
    await WorkspaceCreditManager.refundCredits(job.userId, job.creditsCost);

    await tryCatch(
      prisma.mcpGenerationJob.update({
        where: { id: jobId },
        data: { status: JobStatus.REFUNDED },
      }),
    );
  }
}

/**
 * Handle generation job failure
 */
export async function handleGenerationJobFailure(
  jobId: string,
  error: Error,
): Promise<void> {
  return handleJobFailureWithLabel("Generation", jobId, error);
}

/**
 * Handle modification job failure
 */
export async function handleModificationJobFailure(
  jobId: string,
  error: Error,
): Promise<void> {
  return handleJobFailureWithLabel("Modification", jobId, error);
}

/**
 * Process a generation job (runs in background)
 */
export async function processGenerationJob(
  jobId: string,
  params: {
    prompt: string;
    tier: "1K" | "2K" | "4K";
    negativePrompt?: string;
    aspectRatio?: AspectRatio;
    userId: string;
  },
): Promise<void> {
  const { data: imageBuffer, error: generateError } = await tryCatch(
    generateImageWithGemini({
      prompt: params.prompt,
      tier: params.tier,
      negativePrompt: params.negativePrompt,
      aspectRatio: params.aspectRatio,
    }),
  );

  if (generateError) {
    await handleGenerationJobFailure(jobId, generateError);
    return;
  }

  // Get image dimensions using lightweight header parsing (no native deps)
  const dimensions = getImageDimensionsFromBuffer(imageBuffer);
  const outputWidth = dimensions?.width || 1024;
  const outputHeight = dimensions?.height || 1024;

  const r2Key = `mcp-generated/${params.userId}/${jobId}.jpg`;
  const { data: uploadResult, error: uploadError } = await tryCatch(
    uploadToR2({
      key: r2Key,
      buffer: imageBuffer,
      contentType: "image/jpeg",
    }),
  );

  if (uploadError) {
    await handleGenerationJobFailure(jobId, uploadError);
    return;
  }

  const { error: updateError } = await tryCatch(
    prisma.mcpGenerationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        outputImageUrl: uploadResult.url,
        outputImageR2Key: r2Key,
        outputWidth,
        outputHeight,
        outputSizeBytes: imageBuffer.length,
        processingCompletedAt: new Date(),
      },
    }),
  );

  if (updateError) {
    await handleGenerationJobFailure(jobId, updateError);
    return;
  }

  logger.info(`Generation job ${jobId} completed successfully`);
}

/**
 * Process a modification job (runs in background)
 */
export async function processModificationJob(
  jobId: string,
  params: {
    prompt: string;
    tier: "1K" | "2K" | "4K";
    imageData: string;
    mimeType: string;
    userId: string;
  },
): Promise<void> {
  // Store input image in R2 for before/after comparison and retry capability
  const inputBuffer = Buffer.from(params.imageData, "base64");
  const inputExtension = params.mimeType.split("/")[1] || "jpg";
  const inputR2Key = `mcp-input/${params.userId}/${jobId}.${inputExtension}`;

  // Get input image dimensions using lightweight header parsing (no native deps)
  const inputDimensions = getImageDimensionsFromBuffer(inputBuffer);
  const inputWidth = inputDimensions?.width || 1024;
  const inputHeight = inputDimensions?.height || 1024;

  // Auto-detect aspect ratio from input image dimensions
  const detectedAspectRatio = detectAspectRatio(inputWidth, inputHeight);
  logger.info(
    `Modification job ${jobId}: detected aspect ratio ${detectedAspectRatio} from ${inputWidth}x${inputHeight}`,
  );

  const { data: inputUploadResult, error: inputUploadError } = await tryCatch(
    uploadToR2({
      key: inputR2Key,
      buffer: inputBuffer,
      contentType: params.mimeType,
    }),
  );

  if (inputUploadError) {
    await handleModificationJobFailure(jobId, inputUploadError);
    return;
  }

  // Update job with input image URL
  const { error: inputUpdateError } = await tryCatch(
    prisma.mcpGenerationJob.update({
      where: { id: jobId },
      data: {
        inputImageUrl: inputUploadResult.url,
        inputImageR2Key: inputR2Key,
      },
    }),
  );

  if (inputUpdateError) {
    await handleModificationJobFailure(jobId, inputUpdateError);
    return;
  }

  // Modify image with auto-detected aspect ratio
  const { data: imageBuffer, error: modifyError } = await tryCatch(
    modifyImageWithGemini({
      prompt: params.prompt,
      tier: params.tier,
      imageData: params.imageData,
      mimeType: params.mimeType,
      aspectRatio: detectedAspectRatio,
    }),
  );

  if (modifyError) {
    await handleModificationJobFailure(jobId, modifyError);
    return;
  }

  // Get output image dimensions using lightweight header parsing (no native deps)
  const outputDimensions = getImageDimensionsFromBuffer(imageBuffer);
  const outputWidth = outputDimensions?.width || 1024;
  const outputHeight = outputDimensions?.height || 1024;

  // Upload to R2
  const r2Key = `mcp-modified/${params.userId}/${jobId}.jpg`;
  const { data: uploadResult, error: uploadError } = await tryCatch(
    uploadToR2({
      key: r2Key,
      buffer: imageBuffer,
      contentType: "image/jpeg",
    }),
  );

  if (uploadError) {
    await handleModificationJobFailure(jobId, uploadError);
    return;
  }

  // Update job with success
  const { error: updateError } = await tryCatch(
    prisma.mcpGenerationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        outputImageUrl: uploadResult.url,
        outputImageR2Key: r2Key,
        outputWidth,
        outputHeight,
        outputSizeBytes: imageBuffer.length,
        processingCompletedAt: new Date(),
      },
    }),
  );

  if (updateError) {
    await handleModificationJobFailure(jobId, updateError);
    return;
  }

  logger.info(`Modification job ${jobId} completed successfully`);
}

/**
 * Helper to fetch and process a modification job rerun
 */
export async function fetchAndProcessModification(
  newJobId: string,
  originalJob: {
    inputImageUrl: string | null;
    prompt: string;
    tier: string;
    userId: string;
  },
): Promise<void> {
  if (!originalJob.inputImageUrl) {
    await handleGenerationJobFailure(
      newJobId,
      new Error("No input image URL available for modification rerun"),
    );
    return;
  }

  // Fetch the original input image
  const { data: response, error: fetchError } = await tryCatch(
    fetch(originalJob.inputImageUrl),
  );

  if (fetchError || !response?.ok) {
    await handleGenerationJobFailure(
      newJobId,
      new Error("Failed to fetch original input image for rerun"),
    );
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageData = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  processModificationJob(newJobId, {
    prompt: originalJob.prompt,
    tier: originalJob.tier.replace("TIER_", "") as "1K" | "2K" | "4K",
    imageData,
    mimeType,
    userId: originalJob.userId,
  }).catch(error => {
    logger.error(`Rerun modification job ${newJobId} failed`, { error });
  });
}
