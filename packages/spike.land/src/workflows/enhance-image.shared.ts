/**
 * Shared Image Enhancement Logic
 *
 * This module contains constants, types, and shared logic used by both
 * the workflow version (enhance-image.workflow.ts) and the direct version
 * (enhance-image.direct.ts) to eliminate code duplication.
 *
 * NOTE: This module must NOT import @/lib/prisma directly as it's used in
 * workflow bundling which doesn't support Node.js modules. For pipeline
 * resolution, use ./pipeline-resolver.ts instead.
 */

import type { CropDimensions, CropRegionPixels } from "@/lib/ai/gemini-client";
import type { EnhancementTier } from "@prisma/client";

// =============================================================================
// ERROR BOUNDARY TYPES
// =============================================================================

/**
 * Workflow stages for error tracking and recovery
 *
 * Each stage represents a distinct phase in the enhancement pipeline with
 * specific error handling behavior.
 */
export enum WorkflowStage {
  /** Downloading original image from R2 */
  DOWNLOAD = "DOWNLOAD",
  /** Extracting image metadata (dimensions, format) */
  METADATA = "METADATA",
  /** Analyzing image with vision model */
  ANALYSIS = "ANALYSIS",
  /** Downloading/preparing blend source image */
  BLEND_SOURCE = "BLEND_SOURCE",
  /** Auto-cropping image based on analysis */
  CROP = "CROP",
  /** Building dynamic enhancement prompt */
  PROMPTING = "PROMPTING",
  /** Padding image to square for Gemini */
  PAD = "PAD",
  /** Enhancing image with Gemini AI */
  ENHANCE = "ENHANCE",
  /** Post-processing (resize, format conversion) */
  POST_PROCESS = "POST_PROCESS",
  /** Saving results to database and R2 */
  SAVE = "SAVE",
  /** Refunding tokens on failure */
  REFUND = "REFUND",
}

/**
 * Error boundary configuration for each workflow stage
 *
 * Defines how errors should be handled at each stage:
 * - isRecoverable: Whether the workflow can continue with defaults
 * - retryable: Whether transient failures should be retried
 * - defaultBehavior: What to do when error occurs (if recoverable)
 */
interface ErrorBoundaryConfig {
  /** Stage this configuration applies to */
  stage: WorkflowStage;
  /** Whether the workflow can continue after this error */
  isRecoverable: boolean;
  /** Whether the error is retryable (transient failures) */
  retryable: boolean;
  /** Description of default behavior when error is recovered */
  defaultBehavior?: string;
}

/**
 * Error boundary configurations for all workflow stages
 *
 * Three-tier error classification:
 * 1. Fatal Errors (non-recoverable, non-retryable): Missing source, invalid credentials
 * 2. Retryable Errors (non-recoverable, retryable): Network timeouts, rate limiting
 * 3. Soft Failures (recoverable): Analysis failure, crop failure - continue with defaults
 */
export const ERROR_BOUNDARIES: Record<WorkflowStage, ErrorBoundaryConfig> = {
  [WorkflowStage.DOWNLOAD]: {
    stage: WorkflowStage.DOWNLOAD,
    isRecoverable: false,
    retryable: true, // Network issues may be transient
  },
  [WorkflowStage.METADATA]: {
    stage: WorkflowStage.METADATA,
    isRecoverable: true,
    retryable: false,
    defaultBehavior: "Use default dimensions (1024x1024)",
  },
  [WorkflowStage.ANALYSIS]: {
    stage: WorkflowStage.ANALYSIS,
    isRecoverable: true,
    retryable: false,
    defaultBehavior: "Skip analysis, use generic enhancement prompt",
  },
  [WorkflowStage.BLEND_SOURCE]: {
    stage: WorkflowStage.BLEND_SOURCE,
    isRecoverable: true,
    retryable: false,
    defaultBehavior: "Proceed without blend source",
  },
  [WorkflowStage.CROP]: {
    stage: WorkflowStage.CROP,
    isRecoverable: true,
    retryable: false,
    defaultBehavior: "Keep original image without cropping",
  },
  [WorkflowStage.PROMPTING]: {
    stage: WorkflowStage.PROMPTING,
    isRecoverable: false, // Prompt generation failure is critical
    retryable: true,
  },
  [WorkflowStage.PAD]: {
    stage: WorkflowStage.PAD,
    isRecoverable: false,
    retryable: true,
  },
  [WorkflowStage.ENHANCE]: {
    stage: WorkflowStage.ENHANCE,
    isRecoverable: false,
    retryable: true, // Rate limiting, network issues
  },
  [WorkflowStage.POST_PROCESS]: {
    stage: WorkflowStage.POST_PROCESS,
    isRecoverable: false,
    retryable: true,
  },
  [WorkflowStage.SAVE]: {
    stage: WorkflowStage.SAVE,
    isRecoverable: false,
    retryable: true, // Database connection issues
  },
  [WorkflowStage.REFUND]: {
    stage: WorkflowStage.REFUND,
    isRecoverable: true, // Refund failure shouldn't block status update
    retryable: false,
    defaultBehavior: "Log error, continue with status update",
  },
};

/**
 * Custom error class for workflow stage failures
 *
 * Provides structured error information including:
 * - Which stage failed
 * - Whether the error is recoverable
 * - Whether the error should be retried
 * - Original error cause
 */
export class WorkflowStageError extends Error {
  /** The workflow stage where the error occurred */
  public readonly stage: WorkflowStage;
  /** Whether the workflow can continue with default behavior */
  public readonly isRecoverable: boolean;
  /** Whether the operation should be retried */
  public readonly retryable: boolean;
  /** The original error that caused this failure */
  public override readonly cause?: Error | undefined;

  constructor(
    message: string,
    stage: WorkflowStage,
    options?: {
      isRecoverable?: boolean | undefined;
      retryable?: boolean | undefined;
      cause?: Error | undefined;
    },
  ) {
    super(message);
    this.name = "WorkflowStageError";
    this.stage = stage;

    // Use provided values or fall back to error boundary config
    const boundaryConfig = ERROR_BOUNDARIES[stage];
    this.isRecoverable = options?.isRecoverable ?? boundaryConfig.isRecoverable;
    this.retryable = options?.retryable ?? boundaryConfig.retryable;
    this.cause = options?.cause;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkflowStageError);
    }
  }

  /**
   * Creates a WorkflowStageError from an unknown error
   */
  static fromError(
    error: unknown,
    stage: WorkflowStage,
    options?: { isRecoverable?: boolean; retryable?: boolean },
  ): WorkflowStageError {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    return new WorkflowStageError(message, stage, {
      ...options,
      cause,
    });
  }

  /**
   * Checks if an error indicates a permanent failure (non-retryable)
   */
  static isPermanentFailure(error: unknown): boolean {
    if (error instanceof WorkflowStageError) {
      return !error.retryable && !error.isRecoverable;
    }

    // Check for known permanent failure patterns in error messages
    const message = error instanceof Error ? error.message : String(error);
    const permanentPatterns = [
      /API key/i,
      /invalid.*credentials/i,
      /quota.*exceeded/i,
      /not found/i,
      /forbidden/i,
      /unauthorized/i,
    ];

    return permanentPatterns.some((pattern) => pattern.test(message));
  }
}

/**
 * Workflow context for tracking failures and warnings across stages
 */
export interface WorkflowContext {
  /** Job ID for logging and tracking */
  jobId: string;
  /** Stages that completed successfully */
  completedStages: WorkflowStage[];
  /** Soft failures that were recovered from */
  warnings: Array<{
    stage: WorkflowStage;
    message: string;
    defaultUsed: string;
  }>;
  /** The stage that caused a fatal failure, if any */
  failedStage?: WorkflowStage;
  /** Error message from fatal failure */
  failureMessage?: string;
}

/**
 * Creates a new workflow context for tracking progress
 */
export function createWorkflowContext(jobId: string): WorkflowContext {
  return {
    jobId,
    completedStages: [],
    warnings: [],
  };
}

/**
 * Records a successful stage completion
 */
export function recordStageSuccess(context: WorkflowContext, stage: WorkflowStage): void {
  context.completedStages.push(stage);
}

/**
 * Records a soft failure that was recovered from
 */
export function recordSoftFailure(
  context: WorkflowContext,
  stage: WorkflowStage,
  message: string,
): void {
  const boundaryConfig = ERROR_BOUNDARIES[stage];
  context.warnings.push({
    stage,
    message,
    defaultUsed: boundaryConfig.defaultBehavior ?? "Unknown default",
  });
}

/**
 * Records a fatal failure
 */
export function recordFatalFailure(
  context: WorkflowContext,
  stage: WorkflowStage,
  message: string,
): void {
  context.failedStage = stage;
  context.failureMessage = message;
}

// Resolution constants for each enhancement tier
export const TIER_RESOLUTIONS = {
  FREE: 1024, // Free tier uses same resolution as 1K
  TIER_1K: 1024,
  TIER_2K: 2048,
  TIER_4K: 4096,
} as const;

export const TIER_TO_SIZE = {
  FREE: "1K" as const, // Free tier uses same size as 1K
  TIER_1K: "1K" as const,
  TIER_2K: "2K" as const,
  TIER_4K: "4K" as const,
};

// Image processing constants
export const ENHANCED_JPEG_QUALITY = 95;
export const DEFAULT_IMAGE_DIMENSION = 1024;
export const PADDING_BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };

/** Data for a blend source image (uploaded by user, not stored) */
interface BlendSourceData {
  /** Base64-encoded image data */
  base64: string;
  /** MIME type of the image (e.g., "image/jpeg") */
  mimeType: string;
}

// Types
export interface EnhanceImageInput {
  jobId: string;
  imageId: string;
  userId: string;
  originalR2Key: string;
  tier: EnhancementTier;
  tokensCost: number;
  /** Optional R2 key for blend source image (image-to-image blending) - deprecated, use blendSource */
  sourceImageR2Key?: string | null;
  /** Optional base64 image data for blend source (uploaded by user, not stored) */
  blendSource?: BlendSourceData | null;
}

/**
 * Validates enhancement input parameters
 */
export function validateEnhanceImageInput(input: EnhanceImageInput): void {
  if (!input.jobId || typeof input.jobId !== "string") {
    throw new Error("Invalid jobId: must be a non-empty string");
  }

  if (!input.imageId || typeof input.imageId !== "string") {
    throw new Error("Invalid imageId: must be a non-empty string");
  }

  if (!input.userId || typeof input.userId !== "string") {
    throw new Error("Invalid userId: must be a non-empty string");
  }

  if (!input.originalR2Key || typeof input.originalR2Key !== "string") {
    throw new Error("Invalid originalR2Key: must be a non-empty string");
  }

  const validTiers: EnhancementTier[] = ["FREE", "TIER_1K", "TIER_2K", "TIER_4K"];
  if (!validTiers.includes(input.tier)) {
    throw new Error(`Invalid tier: must be one of ${validTiers.join(", ")}`);
  }

  if (typeof input.tokensCost !== "number" || input.tokensCost < 0) {
    throw new Error("Invalid tokensCost: must be a non-negative number");
  }

  // sourceImageR2Key is optional, but if provided must be a string
  if (
    input.sourceImageR2Key !== undefined &&
    input.sourceImageR2Key !== null &&
    typeof input.sourceImageR2Key !== "string"
  ) {
    throw new Error("Invalid sourceImageR2Key: must be a string or null");
  }

  // blendSource is optional, but if provided must have base64 and mimeType
  if (input.blendSource !== undefined && input.blendSource !== null) {
    if (typeof input.blendSource.base64 !== "string" || !input.blendSource.base64) {
      throw new Error("Invalid blendSource.base64: must be a non-empty string");
    }
    if (typeof input.blendSource.mimeType !== "string" || !input.blendSource.mimeType) {
      throw new Error("Invalid blendSource.mimeType: must be a non-empty string");
    }
  }
}

/**
 * Calculate crop region to restore original aspect ratio from Gemini output.
 * Handles both square and aspect-ratio-aware Gemini outputs.
 *
 * @param geminiWidth - Width of Gemini output
 * @param geminiHeight - Height of Gemini output
 * @param originalWidth - Original image width (for target aspect ratio)
 * @param originalHeight - Original image height (for target aspect ratio)
 */
export function calculateCropRegion(
  geminiWidth: number,
  geminiHeight: number,
  originalWidth: number,
  originalHeight: number,
): {
  extractLeft: number;
  extractTop: number;
  extractWidth: number;
  extractHeight: number;
} {
  const targetAspectRatio = originalWidth / originalHeight;
  const geminiAspectRatio = geminiWidth / geminiHeight;

  // If Gemini output already matches target aspect ratio (within tolerance), use full image
  const aspectRatioTolerance = 0.01;
  if (Math.abs(geminiAspectRatio - targetAspectRatio) < aspectRatioTolerance) {
    return {
      extractLeft: 0,
      extractTop: 0,
      extractWidth: geminiWidth,
      extractHeight: geminiHeight,
    };
  }

  // Gemini output doesn't match target - need to crop to correct aspect ratio
  let extractLeft = 0;
  let extractTop = 0;
  let extractWidth = geminiWidth;
  let extractHeight = geminiHeight;

  if (targetAspectRatio > geminiAspectRatio) {
    // Target is wider than Gemini output - crop height
    extractHeight = Math.round(geminiWidth / targetAspectRatio);
    extractTop = Math.round((geminiHeight - extractHeight) / 2);
  } else {
    // Target is taller than Gemini output - crop width
    extractWidth = Math.round(geminiHeight * targetAspectRatio);
    extractLeft = Math.round((geminiWidth - extractWidth) / 2);
  }

  // Ensure extraction region is within bounds
  extractLeft = Math.max(0, Math.min(extractLeft, geminiWidth - 1));
  extractTop = Math.max(0, Math.min(extractTop, geminiHeight - 1));
  extractWidth = Math.min(extractWidth, geminiWidth - extractLeft);
  extractHeight = Math.min(extractHeight, geminiHeight - extractTop);

  return { extractLeft, extractTop, extractWidth, extractHeight };
}

/**
 * Calculate target dimensions based on tier and aspect ratio
 */
export function calculateTargetDimensions(
  tier: EnhancementTier,
  originalWidth: number,
  originalHeight: number,
): {
  targetWidth: number;
  targetHeight: number;
} {
  const aspectRatio = originalWidth / originalHeight;
  const tierResolution = TIER_RESOLUTIONS[tier];

  let targetWidth: number;
  let targetHeight: number;

  if (aspectRatio > 1) {
    targetWidth = tierResolution;
    targetHeight = Math.round(tierResolution / aspectRatio);
  } else {
    targetHeight = tierResolution;
    targetWidth = Math.round(tierResolution * aspectRatio);
  }

  return { targetWidth, targetHeight };
}

/**
 * Generate R2 key for enhanced image from original key
 */
export function generateEnhancedR2Key(originalR2Key: string, jobId: string): string {
  const withEnhancedPath = originalR2Key.replace("/originals/", `/enhanced/`);
  // Check if there's an extension to replace
  if (/\.[^./]+$/.test(withEnhancedPath)) {
    return withEnhancedPath.replace(/\.[^./]+$/, `/${jobId}.jpg`);
  }
  // No extension - just append the jobId
  return `${withEnhancedPath}/${jobId}.jpg`;
} // Re-export types for convenience

/**
 * Validates crop dimensions to ensure they are valid percentages (0.0-1.0)
 */
export function validateCropDimensions(crop: CropDimensions): boolean {
  return (
    typeof crop.x === "number" &&
    typeof crop.y === "number" &&
    typeof crop.width === "number" &&
    typeof crop.height === "number" &&
    crop.x >= 0 &&
    crop.x <= 1 &&
    crop.y >= 0 &&
    crop.y <= 1 &&
    crop.width > 0 &&
    crop.width <= 1 &&
    crop.height > 0 &&
    crop.height <= 1 &&
    crop.x + crop.width <= 1.01 && // Small tolerance for floating point
    crop.y + crop.height <= 1.01
  );
}

/**
 * Converts percentage-based crop dimensions to pixel values
 */
export function cropDimensionsToPixels(
  crop: CropDimensions,
  imageWidth: number,
  imageHeight: number,
): CropRegionPixels {
  return {
    left: Math.max(0, Math.round(crop.x * imageWidth)),
    top: Math.max(0, Math.round(crop.y * imageHeight)),
    width: Math.min(imageWidth, Math.round(crop.width * imageWidth)),
    height: Math.min(imageHeight, Math.round(crop.height * imageHeight)),
  };
} // Re-export pipeline types for convenience
