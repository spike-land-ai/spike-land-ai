import type { LogContext } from "@/lib/errors/structured-logger";
import moduleLogger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { WorkspaceCreditManager } from "@/lib/credits/workspace-credit-manager";
import { tryCatch } from "@/lib/try-catch";
import {
  enhanceImageDirect,
  type EnhanceImageInput,
} from "@/workflows/enhance-image.direct";
import { JobStatus } from "@prisma/client";
import { after } from "next/server";

/**
 * Execution mode for the enhancement workflow
 *
 * Note: "workflow" mode has been removed. Direct execution is now the only mode.
 * The workflow package has been removed to unblock Yarn PnP migration.
 */
export type ExecutionMode = "direct";

/**
 * Returns the execution mode (always "direct")
 *
 * Direct execution uses plain JavaScript with built-in retry logic.
 * The Vercel Workflow package has been removed.
 */
export function getExecutionMode(): ExecutionMode {
  return "direct";
}

/**
 * Checks if running in Vercel environment (always false — migrated to AWS ECS)
 */
export function isVercelEnvironment(): boolean {
  return false;
}

/**
 * Result from starting an enhancement
 */
interface EnhancementStartResult {
  success: true;
}

/**
 * Error result from starting an enhancement
 */
interface EnhancementStartError {
  success: false;
  error: string;
}

export type StartEnhancementResult =
  | EnhancementStartResult
  | EnhancementStartError;

/**
 * Context for enhancement execution (for cleanup/rollback)
 */
export interface EnhancementContext {
  jobId: string;
  userId: string;
  tokensCost: number;
}

/**
 * Starts the enhancement process using direct execution with Next.js after()
 *
 * Uses Next.js `after()` for background processing - the enhancement continues
 * after the response is sent to the client. This provides:
 * - Guarantee that work completes even after response
 * - Proper integration with Next.js lifecycle
 * - Better observability in Vercel deployments
 *
 * @param input - Enhancement input parameters
 * @param logger - Optional logger for recording events
 * @returns Result indicating success or failure
 */
export async function startEnhancement(
  input: EnhanceImageInput,
  logger?: { info: (msg: string, ctx?: LogContext) => void; },
): Promise<StartEnhancementResult> {
  logger?.info("Starting enhancement (direct mode with after())", {
    jobId: input.jobId,
  });

  // Use Next.js after() for proper background processing
  // This ensures the enhancement continues even after the response is sent
  after(async () => {
    const { error } = await tryCatch(enhanceImageDirect(input));
    if (error) {
      // Error is logged within enhanceImageDirect
      moduleLogger.error(`[Enhancement] Job ${input.jobId} failed`, error);
    }
  });

  return { success: true };
}

/**
 * Handles enhancement startup failure
 *
 * Marks job as failed and refunds tokens if applicable
 *
 * @param context - Enhancement context for cleanup
 * @param errorMessage - Error message to record
 */
export async function handleEnhancementFailure(
  context: EnhancementContext,
  errorMessage: string,
): Promise<void> {
  // Mark job as failed/refunded
  await tryCatch(
    prisma.imageEnhancementJob.update({
      where: { id: context.jobId },
      data: {
        status: context.tokensCost > 0 ? JobStatus.REFUNDED : JobStatus.FAILED,
        errorMessage,
      },
    }),
  );

  // Refund credits if any were consumed
  if (context.tokensCost > 0) {
    await WorkspaceCreditManager.refundCredits(
      context.userId,
      context.tokensCost,
    );
  }
}
