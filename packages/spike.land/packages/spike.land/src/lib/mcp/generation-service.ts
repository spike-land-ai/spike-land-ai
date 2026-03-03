import { DEFAULT_MODEL } from "@/lib/ai/gemini-client";
import { WorkspaceCreditManager } from "@/lib/credits/workspace-credit-manager";
import { getMcpGenerationCost } from "@/lib/credits/costs";
import prisma from "@/lib/prisma";
import { JobStatus, McpJobType } from "@prisma/client";
import logger from "@/lib/logger";

import type {
  CreateGenerationJobParams,
  CreateModificationJobParams,
  JobResult,
} from "./generation-types";
import {
  checkConcurrentJobLimit,
  fetchAndProcessModification,
  MAX_CONCURRENT_JOBS_PER_USER,
  processGenerationJob,
  processModificationJob,
} from "./generation-helpers";

// Re-export types for consumers
export type {
  CreateGenerationJobParams,
  CreateModificationJobParams,
  JobResult,
} from "./generation-types";

// Re-export error types for consumers
export { McpError, McpErrorCode } from "./errors";

// Re-export for testing
export { classifyError } from "./generation-helpers";

/**
 * Creates and processes a new image generation job
 * Uses atomic token consumption to prevent race conditions
 */
export async function createGenerationJob(
  params: CreateGenerationJobParams,
): Promise<JobResult> {
  const { userId, apiKeyId, prompt, tier, negativePrompt, aspectRatio } = params;
  const tokensCost = getMcpGenerationCost(tier);

  // Security: Check concurrent job limit to prevent burst attacks
  const canCreateJob = await checkConcurrentJobLimit(userId);
  if (!canCreateJob) {
    return {
      success: false,
      error:
        `Too many concurrent jobs. Maximum ${MAX_CONCURRENT_JOBS_PER_USER} jobs can be processed at once. Please wait for existing jobs to complete.`,
    };
  }

  // Atomic credit consumption - handles balance check within transaction
  // This prevents race conditions where two requests could both pass a separate balance check
  const consumeResult = await WorkspaceCreditManager.consumeCredits({
    userId,
    amount: tokensCost,
    source: "mcp_generation",
    sourceId: "pending", // Will be job ID
  });

  if (!consumeResult.success) {
    return {
      success: false,
      error: consumeResult.error
        || `Insufficient AI credits. Required: ${tokensCost} credits`,
    };
  }

  // Create job record
  const job = await prisma.mcpGenerationJob.create({
    data: {
      userId,
      apiKeyId: apiKeyId || null,
      type: McpJobType.GENERATE,
      tier,
      creditsCost: tokensCost,
      status: JobStatus.PROCESSING,
      prompt,
      geminiModel: DEFAULT_MODEL,
      processingStartedAt: new Date(),
    },
  });

  // Process generation in the background
  processGenerationJob(job.id, {
    prompt,
    tier: tier.replace("TIER_", "") as "1K" | "2K" | "4K",
    negativePrompt,
    aspectRatio,
    userId,
  }).catch(error => {
    logger.error(`Generation job ${job.id} failed`, { error });
  });

  return {
    success: true,
    jobId: job.id,
    creditsCost: tokensCost,
  };
}

/**
 * Creates and processes a new image modification job
 * Uses atomic token consumption to prevent race conditions
 */
export async function createModificationJob(
  params: CreateModificationJobParams,
): Promise<JobResult> {
  const { userId, apiKeyId, prompt, tier, imageData, mimeType } = params;
  const tokensCost = getMcpGenerationCost(tier);

  // Security: Check concurrent job limit to prevent burst attacks
  const canCreateJob = await checkConcurrentJobLimit(userId);
  if (!canCreateJob) {
    return {
      success: false,
      error:
        `Too many concurrent jobs. Maximum ${MAX_CONCURRENT_JOBS_PER_USER} jobs can be processed at once. Please wait for existing jobs to complete.`,
    };
  }

  // Atomic credit consumption - handles balance check within transaction
  // This prevents race conditions where two requests could both pass a separate balance check
  const consumeResult = await WorkspaceCreditManager.consumeCredits({
    userId,
    amount: tokensCost,
    source: "mcp_generation",
    sourceId: "pending",
  });

  if (!consumeResult.success) {
    return {
      success: false,
      error: consumeResult.error
        || `Insufficient AI credits. Required: ${tokensCost} credits`,
    };
  }

  // Create job record
  const job = await prisma.mcpGenerationJob.create({
    data: {
      userId,
      apiKeyId: apiKeyId || null,
      type: McpJobType.MODIFY,
      tier,
      creditsCost: tokensCost,
      status: JobStatus.PROCESSING,
      prompt,
      geminiModel: DEFAULT_MODEL,
      processingStartedAt: new Date(),
    },
  });

  // Process modification in the background
  processModificationJob(job.id, {
    prompt,
    tier: tier.replace("TIER_", "") as "1K" | "2K" | "4K",
    imageData,
    mimeType,
    userId,
  }).catch(error => {
    logger.error(`Modification job ${job.id} failed`, { error });
  });

  return {
    success: true,
    jobId: job.id,
    creditsCost: tokensCost,
  };
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string, userId?: string) {
  const where = userId ? { id: jobId, userId } : { id: jobId };

  return prisma.mcpGenerationJob.findFirst({
    where,
    select: {
      id: true,
      type: true,
      tier: true,
      creditsCost: true,
      status: true,
      prompt: true,
      inputImageUrl: true,
      outputImageUrl: true,
      outputWidth: true,
      outputHeight: true,
      errorMessage: true,
      createdAt: true,
      processingStartedAt: true,
      processingCompletedAt: true,
    },
  });
}

/**
 * Get job history for a user
 */
export async function getJobHistory(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: McpJobType;
  } = {},
) {
  const { limit = 20, offset = 0, type } = options;

  const where = {
    userId,
    ...(type && { type }),
  };

  const [jobs, total] = await Promise.all([
    prisma.mcpGenerationJob.findMany({
      where,
      select: {
        id: true,
        type: true,
        tier: true,
        creditsCost: true,
        status: true,
        prompt: true,
        inputImageUrl: true,
        outputImageUrl: true,
        outputWidth: true,
        outputHeight: true,
        createdAt: true,
        processingCompletedAt: true,
        apiKey: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.mcpGenerationJob.count({ where }),
  ]);

  return {
    jobs: jobs.map(job => ({
      id: job.id,
      type: job.type,
      tier: job.tier,
      creditsCost: job.creditsCost,
      status: job.status,
      prompt: job.prompt,
      inputImageUrl: job.inputImageUrl,
      outputImageUrl: job.outputImageUrl,
      outputWidth: job.outputWidth,
      outputHeight: job.outputHeight,
      createdAt: job.createdAt.toISOString(),
      processingCompletedAt: job.processingCompletedAt?.toISOString() || null,
      apiKeyName: job.apiKey?.name || null,
    })),
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Cancel/kill a MCP job
 * Only works for PENDING or PROCESSING jobs
 * Refunds tokens to user
 */
export async function cancelMcpJob(
  jobId: string,
): Promise<{ success: boolean; error?: string; creditsRefunded?: number; }> {
  const job = await prisma.mcpGenerationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return { success: false, error: "Job not found" };
  }

  if (job.status !== JobStatus.PENDING && job.status !== JobStatus.PROCESSING) {
    return {
      success: false,
      error:
        `Cannot cancel job with status ${job.status}. Only PENDING or PROCESSING jobs can be cancelled.`,
    };
  }

  // Update job status to CANCELLED
  await prisma.mcpGenerationJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CANCELLED,
      errorMessage: "Cancelled by admin",
      processingCompletedAt: new Date(),
    },
  });

  // Refund credits
  await WorkspaceCreditManager.refundCredits(job.userId, job.creditsCost);

  return { success: true, creditsRefunded: job.creditsCost };
}

/**
 * Rerun/duplicate a MCP job
 * Creates a new job with the same parameters and starts processing
 */
export async function rerunMcpJob(
  jobId: string,
): Promise<{ success: boolean; error?: string; newJobId?: string; }> {
  const job = await prisma.mcpGenerationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return { success: false, error: "Job not found" };
  }

  // Check concurrent job limit for user
  const canCreateJob = await checkConcurrentJobLimit(job.userId);
  if (!canCreateJob) {
    return {
      success: false,
      error:
        `Too many concurrent jobs. Maximum ${MAX_CONCURRENT_JOBS_PER_USER} jobs can be processed at once.`,
    };
  }

  // Consume credits for new job
  const consumeResult = await WorkspaceCreditManager.consumeCredits({
    userId: job.userId,
    amount: job.creditsCost,
    source: "mcp_generation",
    sourceId: "pending",
  });

  if (!consumeResult.success) {
    return {
      success: false,
      error: consumeResult.error
        || `Insufficient AI credits. Required: ${job.creditsCost} credits`,
    };
  }

  // Create new job with same parameters
  const newJob = await prisma.mcpGenerationJob.create({
    data: {
      userId: job.userId,
      apiKeyId: job.apiKeyId,
      type: job.type,
      tier: job.tier,
      creditsCost: job.creditsCost,
      status: JobStatus.PROCESSING,
      prompt: job.prompt,
      inputImageUrl: job.inputImageUrl,
      inputImageR2Key: job.inputImageR2Key,
      geminiModel: job.geminiModel,
      processingStartedAt: new Date(),
    },
  });

  // Start processing based on job type
  if (job.type === McpJobType.GENERATE) {
    processGenerationJob(newJob.id, {
      prompt: job.prompt,
      tier: job.tier.replace("TIER_", "") as "1K" | "2K" | "4K",
      userId: job.userId,
    }).catch(error => {
      logger.error(`Rerun generation job ${newJob.id} failed`, { error });
    });
  } else if (job.type === McpJobType.MODIFY && job.inputImageUrl) {
    // For modify jobs, we need to fetch the original image
    fetchAndProcessModification(newJob.id, job).catch(error => {
      logger.error(`Rerun modification job ${newJob.id} failed`, { error });
    });
  }

  return { success: true, newJobId: newJob.id };
}
