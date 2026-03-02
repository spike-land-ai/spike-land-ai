/**
 * Unified Job Types for Admin Dashboard
 *
 * Normalizes both EnhancementJob and McpGenerationJob into a unified interface
 * for the admin jobs management page.
 */

import type { EnhancementTier, JobStatus } from "@prisma/client";

/**
 * Job source type - which table the job comes from
 */
export type JobSource = "enhancement" | "mcp";

/**
 * Unified job interface for admin dashboard
 * Normalizes fields from both EnhancementJob and McpGenerationJob
 */
export interface UnifiedJob {
  id: string;
  source: JobSource;
  status: JobStatus;
  tier: EnhancementTier;
  creditsCost: number;

  // Content
  prompt: string | null;
  inputUrl: string | null;
  outputUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;

  // User info
  userId: string;
  userEmail: string;
  userName: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;

  // Source-specific fields (optional)
  // EnhancementJob specific
  imageId?: string;
  imageName?: string;
  retryCount?: number;
  maxRetries?: number;
  geminiModel?: string | null;
  geminiTemp?: number | null;
  workflowRunId?: string | null;

  // McpGenerationJob specific
  mcpJobType?: "GENERATE" | "MODIFY";
  apiKeyId?: string | null;
  apiKeyName?: string | null;
  inputR2Key?: string | null;
  outputR2Key?: string | null;

  // Analysis data (enhancement jobs only)
  analysisResult?: {
    mainSubject?: string;
    imageStyle?: string;
    defects?: {
      isDark?: boolean;
      isBlurry?: boolean;
      hasNoise?: boolean;
      hasVHSArtifacts?: boolean;
      isLowResolution?: boolean;
      isOverexposed?: boolean;
      hasColorCast?: boolean;
      colorCastType?: string;
    };
    lightingCondition?: string;
    cropping?: {
      isCroppingNeeded?: boolean;
      suggestedCrop?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
      };
      cropReason?: string;
    };
  } | null;
  analysisSource?: string | null;

  // Crop data (enhancement jobs only)
  wasCropped?: boolean;
  cropDimensions?: { left: number; top: number; width: number; height: number } | null;

  // Pipeline (enhancement jobs only)
  currentStage?: string | null;
  pipelineId?: string | null;

  // Blend mode (enhancement jobs only)
  isBlend?: boolean;
  sourceImageId?: string | null;
  sourceImageUrl?: string | null;

  // Original image metadata
  originalWidth?: number | null;
  originalHeight?: number | null;
  originalFormat?: string | null;
  originalSizeBytes?: number | null;

  // Misc
  isAnonymous?: boolean;
}
