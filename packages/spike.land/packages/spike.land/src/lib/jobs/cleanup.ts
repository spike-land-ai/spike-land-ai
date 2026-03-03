/**
 * Job Cleanup Utilities
 *
 * Provides automatic cleanup for stuck enhancement jobs that exceed timeout thresholds.
 * Handles refunding credits and updating job status to prevent indefinite PROCESSING state.
 */

import { logger } from "@/lib/errors/structured-logger";
import prisma from "@/lib/prisma";
import { WorkspaceCreditManager } from "@/lib/credits/workspace-credit-manager";
import { tryCatch } from "@/lib/try-catch";
import { JobStatus } from "@prisma/client";

export interface CleanupOptions {
  /**
   * Timeout threshold in milliseconds
   * @default 300000 (5 minutes)
   */
  timeoutMs?: number;

  /**
   * Dry run mode - find stuck jobs without making changes
   * @default false
   */
  dryRun?: boolean;

  /**
   * Maximum number of jobs to process in one cleanup run
   * @default 100
   */
  batchSize?: number;
}

interface CleanupResult {
  /**
   * Total number of stuck jobs found
   */
  totalFound: number;

  /**
   * Number of jobs successfully cleaned up
   */
  cleanedUp: number;

  /**
   * Number of jobs that failed to clean up
   */
  failed: number;

  /**
   * Total credits refunded across all jobs
   */
  creditsRefunded: number;

  /**
   * Details of cleaned up jobs
   */
  jobs: Array<{
    id: string;
    userId: string;
    creditsRefunded: number;
    processingDuration: number;
    error?: string;
  }>;

  /**
   * Any errors encountered during cleanup
   */
  errors: Array<{
    jobId: string;
    error: string;
  }>;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BATCH_SIZE = 100;

/**
 * Find jobs that have been stuck in PROCESSING state for too long
 */
export async function findStuckJobs(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<
  Array<{
    id: string;
    userId: string;
    creditsCost: number;
    processingStartedAt: Date | null;
    updatedAt: Date;
  }>
> {
  const timeoutThreshold = new Date(Date.now() - timeoutMs);
  const cleanupLogger = logger.child({ action: "find_stuck_jobs" });

  cleanupLogger.debug("Searching for stuck jobs", {
    timeoutMs,
    timeoutThreshold: timeoutThreshold.toISOString(),
    batchSize,
  });

  const stuckJobs = await prisma.imageEnhancementJob.findMany({
    where: {
      status: JobStatus.PROCESSING,
      OR: [
        // Jobs that started processing but never completed
        {
          processingStartedAt: {
            lte: timeoutThreshold,
          },
        },
        // Jobs marked as PROCESSING but never got processingStartedAt timestamp
        // (shouldn't happen, but defensive check)
        {
          processingStartedAt: null,
          updatedAt: {
            lte: timeoutThreshold,
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      creditsCost: true,
      processingStartedAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "asc", // Process oldest jobs first
    },
    take: batchSize,
  });

  cleanupLogger.info("Found stuck jobs", {
    count: stuckJobs.length,
    oldestJob: stuckJobs.length > 0 && stuckJobs[0]
      ? (stuckJobs[0].processingStartedAt?.toISOString()
        ?? stuckJobs[0].updatedAt.toISOString())
      : null,
  });

  return stuckJobs;
}

/**
 * Clean up a single stuck job
 */
async function cleanupSingleJob(
  job: {
    id: string;
    userId: string;
    creditsCost: number;
    processingStartedAt: Date | null;
    updatedAt: Date;
  },
): Promise<{
  success: boolean;
  creditsRefunded: number;
  processingDuration: number;
  error?: string;
}> {
  const jobLogger = logger.child({
    jobId: job.id,
    userId: job.userId,
  });

  jobLogger.info("Cleaning up stuck job", {
    creditsCost: job.creditsCost,
    processingStartedAt: job.processingStartedAt?.toISOString(),
  });

  // Calculate how long the job was stuck
  const stuckSince = job.processingStartedAt || job.updatedAt;
  const processingDuration = Date.now() - stuckSince.getTime();

  // Use transaction to ensure atomic update + refund
  const transactionResult = await tryCatch(
    prisma.$transaction(async tx => {
      // Update job status to FAILED
      await tx.imageEnhancementJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          errorMessage: `Job timed out after ${
            Math.round(processingDuration / 1000)
          }s. Automatically cleaned up and credits refunded.`,
          processingCompletedAt: new Date(),
        },
      });

      jobLogger.debug("Job marked as FAILED");
    }),
  );

  if (transactionResult.error) {
    const errorMessage = transactionResult.error instanceof Error
      ? transactionResult.error.message
      : String(transactionResult.error);
    jobLogger.error(
      "Failed to cleanup job",
      transactionResult.error instanceof Error
        ? transactionResult.error
        : new Error(errorMessage),
    );

    return {
      success: false,
      creditsRefunded: 0,
      processingDuration: 0,
      error: errorMessage,
    };
  }

  // Refund credits outside transaction to avoid nested transaction issues
  const refundSuccess = await WorkspaceCreditManager.refundCredits(
    job.userId,
    job.creditsCost,
  );

  if (!refundSuccess) {
    const errorMessage = "Credit refund failed";
    jobLogger.error("Failed to cleanup job", new Error(errorMessage));

    return {
      success: false,
      creditsRefunded: 0,
      processingDuration: 0,
      error: errorMessage,
    };
  }

  jobLogger.info("Job cleaned up successfully", {
    creditsRefunded: job.creditsCost,
    processingDuration: Math.round(processingDuration / 1000),
  });

  return {
    success: true,
    creditsRefunded: job.creditsCost,
    processingDuration,
  };
}

/**
 * Clean up stuck jobs that exceed the timeout threshold
 *
 * This function:
 * 1. Finds jobs stuck in PROCESSING state
 * 2. Marks them as FAILED with timeout error message
 * 3. Refunds credits to the user
 * 4. Returns detailed cleanup results
 *
 * @param options - Cleanup configuration options
 * @returns Detailed results of the cleanup operation
 */
export async function cleanupStuckJobs(
  options: CleanupOptions = {},
): Promise<CleanupResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    dryRun = false,
    batchSize = DEFAULT_BATCH_SIZE,
  } = options;

  const cleanupLogger = logger.child({
    action: "cleanup_stuck_jobs",
    timeoutMs,
    dryRun,
  });

  cleanupLogger.info("Starting stuck jobs cleanup", {
    timeoutMs,
    timeoutMinutes: timeoutMs / 60000,
    dryRun,
    batchSize,
  });

  // Find stuck jobs
  const findResult = await tryCatch(findStuckJobs(timeoutMs, batchSize));

  if (findResult.error) {
    const errorMessage = findResult.error instanceof Error
      ? findResult.error.message
      : String(findResult.error);
    cleanupLogger.error(
      "Cleanup process failed",
      findResult.error instanceof Error
        ? findResult.error
        : new Error(errorMessage),
    );

    throw findResult.error;
  }

  const stuckJobs = findResult.data;

  if (stuckJobs.length === 0) {
    cleanupLogger.info("No stuck jobs found");
    return {
      totalFound: 0,
      cleanedUp: 0,
      failed: 0,
      creditsRefunded: 0,
      jobs: [],
      errors: [],
    };
  }

  // If dry run, just return what we found without making changes
  if (dryRun) {
    cleanupLogger.info("Dry run - no changes made", {
      jobsFound: stuckJobs.length,
    });
    return {
      totalFound: stuckJobs.length,
      cleanedUp: 0,
      failed: 0,
      creditsRefunded: 0,
      jobs: stuckJobs.map(job => ({
        id: job.id,
        userId: job.userId,
        creditsRefunded: 0,
        processingDuration: Date.now()
          - (job.processingStartedAt || job.updatedAt).getTime(),
      })),
      errors: [],
    };
  }

  // Clean up each job
  const results = await Promise.all(
    stuckJobs.map(job => cleanupSingleJob(job)),
  );

  // Aggregate results
  const cleanedUp = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const creditsRefunded = results.reduce(
    (sum, r) => sum + r.creditsRefunded,
    0,
  );

  const jobDetails = stuckJobs.map((job, index) => {
    const result = results[index];
    if (!result) {
      throw new Error(`Missing result for job ${job.id}`);
    }
    return {
      id: job.id,
      userId: job.userId,
      creditsRefunded: result.creditsRefunded,
      processingDuration: result.processingDuration,
      ...(result.error && { error: result.error }),
    };
  });

  const errors = stuckJobs
    .map((job, index) => {
      const result = results[index];
      return {
        jobId: job.id,
        error: result?.error || "",
      };
    })
    .filter(e => e.error);

  cleanupLogger.info("Cleanup completed", {
    totalFound: stuckJobs.length,
    cleanedUp,
    failed,
    creditsRefunded,
  });

  return {
    totalFound: stuckJobs.length,
    cleanedUp,
    failed,
    creditsRefunded,
    jobs: jobDetails,
    errors,
  };
}
