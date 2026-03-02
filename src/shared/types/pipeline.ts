/**
 * Pipeline Configuration Types
 *
 * Type definitions for AI pipeline configurations.
 * These are standalone TypeScript types kept in sync with the Zod schemas in
 * spike.land's src/lib/ai/pipeline-validation.ts. If the Zod schemas change,
 * these types must be updated manually.
 *
 * Resolves #797: Type Safety Improvements
 */

/**
 * Analysis stage configuration type
 * Inferred from AnalysisConfigSchema
 */
export type AnalysisConfig = {
  enabled: boolean;
  model?: string;
  temperature?: number;
};

/**
 * Auto-crop stage configuration type
 * Inferred from AutoCropConfigSchema
 */
export type AutoCropConfig = {
  enabled: boolean;
  minCropRatio?: number;
  allowBlackBarRemoval?: boolean;
  allowUIElementCrop?: boolean;
};

/**
 * Reference image type
 */
export type ReferenceImage = {
  url: string;
  r2Key: string;
  description?: string;
};

/**
 * Defect override type
 */
export type DefectOverrides = {
  isDark?: boolean;
  isBlurry?: boolean;
  hasNoise?: boolean;
  hasVHSArtifacts?: boolean;
  isLowResolution?: boolean;
  isOverexposed?: boolean;
  hasColorCast?: boolean;
};

/**
 * Valid defect keys for skip corrections
 */
export type DefectKey =
  | "isDark"
  | "isBlurry"
  | "hasNoise"
  | "hasVHSArtifacts"
  | "isLowResolution"
  | "isOverexposed"
  | "hasColorCast";

/**
 * Prompt generation configuration type
 * Inferred from PromptConfigSchema
 */
export type PromptConfig = {
  defectOverrides?: DefectOverrides;
  customInstructions?: string;
  skipCorrections?: DefectKey[];
  referenceImages?: ReferenceImage[];
};

/**
 * Generation stage configuration type
 * Inferred from GenerationConfigSchema
 */
export type GenerationConfig = {
  model?: string;
  temperature?: number;
  retryAttempts?: number;
};

/**
 * Union type for all pipeline configs
 * Useful for generic pipeline config handling
 */
export type PipelineConfig = AnalysisConfig | AutoCropConfig | PromptConfig | GenerationConfig;

/**
 * Validated pipeline configs result type
 */
export interface ValidatedPipelineConfigs {
  analysisConfig?: AnalysisConfig;
  autoCropConfig?: AutoCropConfig;
  promptConfig?: PromptConfig;
  generationConfig?: GenerationConfig;
}
