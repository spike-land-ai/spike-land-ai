import type { EnhancementTier } from "@prisma/client";

/**
 * Analysis stage configuration
 */
export interface AnalysisConfig {
  /** Whether to run image analysis */
  enabled: boolean;
  /** Override model for analysis (defaults to DEFAULT_MODEL) */
  model?: string;
  /** Override temperature for analysis (defaults to 0.1) */
  temperature?: number;
}

/**
 * Auto-crop stage configuration
 */
export interface AutoCropConfig {
  /** Whether to run auto-crop based on analysis */
  enabled: boolean;
  /** Minimum crop ratio to apply (e.g., 0.05 = 5% minimum) */
  minCropRatio?: number;
  /** Whether to remove black bars from edges */
  allowBlackBarRemoval?: boolean;
  /** Whether to crop out UI elements */
  allowUIElementCrop?: boolean;
}

/**
 * Reference image for style guidance
 */
export interface ReferenceImage {
  /** R2 public URL for the reference image */
  url: string;
  /** R2 storage key for cleanup */
  r2Key: string;
  /** Optional description of what this reference is for (e.g., "target style", "color palette") */
  description?: string;
}

/**
 * Prompt generation configuration
 */
export interface PromptConfig {
  /** Override specific defect detection results */
  defectOverrides?: Partial<{
    isDark: boolean;
    isBlurry: boolean;
    hasNoise: boolean;
    hasVHSArtifacts: boolean;
    isLowResolution: boolean;
    isOverexposed: boolean;
    hasColorCast: boolean;
  }>;
  /** Additional custom instructions to append to prompt */
  customInstructions?: string;
  /** Defect types to skip correction for */
  skipCorrections?: Array<
    | "isDark"
    | "isBlurry"
    | "hasNoise"
    | "hasVHSArtifacts"
    | "isLowResolution"
    | "isOverexposed"
    | "hasColorCast"
  >;
  /** Reference images for style guidance (max 3) */
  referenceImages?: ReferenceImage[];
}

/**
 * Generation stage configuration
 */
export interface GenerationConfig {
  /** Override model for generation */
  model?: string;
  /** Override temperature for generation */
  temperature?: number;
  /** Maximum retry attempts on failure */
  retryAttempts?: number;
}

/**
 * Complete pipeline configuration combining all stages
 */
export interface PipelineConfig {
  /** Enhancement tier (resolution) */
  tier: EnhancementTier;
  /** Analysis stage settings */
  analysis: AnalysisConfig;
  /** Auto-crop stage settings */
  autoCrop: AutoCropConfig;
  /** Prompt generation settings */
  prompt: PromptConfig;
  /** Generation stage settings */
  generation: GenerationConfig;
}

/**
 * System default pipeline configuration
 *
 * Used when no custom pipeline is specified.
 * - TIER_1K resolution
 * - Analysis enabled
 * - Auto-crop enabled with sensible defaults
 * - No prompt overrides
 * - 3 retry attempts
 */
export const SYSTEM_DEFAULT_PIPELINE: PipelineConfig = {
  tier: "TIER_1K",
  analysis: {
    enabled: true,
  },
  autoCrop: {
    enabled: true,
    minCropRatio: 0.05,
    allowBlackBarRemoval: true,
    allowUIElementCrop: true,
  },
  prompt: {},
  generation: {
    retryAttempts: 3,
  },
};

/**
 * Database representation of pipeline configs (JSON fields)
 */
export interface PipelineDbConfigs {
  analysisConfig: AnalysisConfig | null;
  autoCropConfig: AutoCropConfig | null;
  promptConfig: PromptConfig | null;
  generationConfig: GenerationConfig | null;
}

/**
 * Convert database JSON fields to typed PipelineConfig
 */
export function parsePipelineConfig(
  tier: EnhancementTier,
  configs: PipelineDbConfigs,
): PipelineConfig {
  return {
    tier,
    analysis: configs.analysisConfig ?? SYSTEM_DEFAULT_PIPELINE.analysis,
    autoCrop: configs.autoCropConfig ?? SYSTEM_DEFAULT_PIPELINE.autoCrop,
    prompt: configs.promptConfig ?? SYSTEM_DEFAULT_PIPELINE.prompt,
    generation: configs.generationConfig ?? SYSTEM_DEFAULT_PIPELINE.generation,
  };
}

/**
 * Validate a pipeline config has required fields
 */
export function isValidPipelineConfig(
  config: unknown,
): config is PipelineConfig {
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.tier === "string"
    && ["TIER_1K", "TIER_2K", "TIER_4K"].includes(c.tier)
    && typeof c.analysis === "object"
    && c.analysis !== null
    && typeof c.autoCrop === "object"
    && c.autoCrop !== null
    && typeof c.prompt === "object"
    && c.prompt !== null
    && typeof c.generation === "object"
    && c.generation !== null
  );
}

/**
 * Result type for validated pipeline configurations
 * Contains only the successfully validated config sections
 */
export interface ValidatedPipelineConfigs {
  analysisConfig?: AnalysisConfig;
  autoCropConfig?: AutoCropConfig;
  promptConfig?: PromptConfig;
  generationConfig?: GenerationConfig;
}
