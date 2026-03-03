import { z } from "zod";
// Duplicate imports removed
import type {
  AnalysisConfig,
  AutoCropConfig,
  GenerationConfig,
  PromptConfig,
  ValidatedPipelineConfigs,
} from "./pipeline-types";

/**
 * Zod schemas for pipeline configuration validation.
 * These schemas validate incoming JSON data before storing in the database.
 *
 * Resolves #797: Type Safety Improvements
 */

/**
 * Analysis stage configuration schema
 */
const AnalysisConfigSchema = z
  .object({
    enabled: z.boolean(),
    model: z.string().max(100).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();

/**
 * Auto-crop stage configuration schema
 */
const AutoCropConfigSchema = z
  .object({
    enabled: z.boolean(),
    minCropRatio: z.number().min(0).max(1).optional(),
    allowBlackBarRemoval: z.boolean().optional(),
    allowUIElementCrop: z.boolean().optional(),
  })
  .strict();

/**
 * Reference image schema
 */
const ReferenceImageSchema = z
  .object({
    url: z.string().url().max(2000),
    r2Key: z.string().max(500),
    description: z.string().max(500).optional(),
  })
  .strict();

/**
 * Valid defect override keys
 */
const defectKeys = [
  "isDark",
  "isBlurry",
  "hasNoise",
  "hasVHSArtifacts",
  "isLowResolution",
  "isOverexposed",
  "hasColorCast",
] as const;

/**
 * Prompt generation configuration schema
 */
export const PromptConfigSchema = z
  .object({
    defectOverrides: z
      .object({
        isDark: z.boolean().optional(),
        isBlurry: z.boolean().optional(),
        hasNoise: z.boolean().optional(),
        hasVHSArtifacts: z.boolean().optional(),
        isLowResolution: z.boolean().optional(),
        isOverexposed: z.boolean().optional(),
        hasColorCast: z.boolean().optional(),
      })
      .strict()
      .optional(),
    customInstructions: z.string().max(2000).optional(),
    skipCorrections: z.array(z.enum(defectKeys)).max(7).optional(),
    referenceImages: z.array(ReferenceImageSchema).max(3).optional(),
  })
  .strict();

/**
 * Generation stage configuration schema
 */
export const GenerationConfigSchema = z
  .object({
    model: z.string().max(100).optional(),
    temperature: z.number().min(0).max(2).optional(),
    retryAttempts: z.number().int().min(0).max(10).optional(),
  })
  .strict();

/**
 * Validation result type
 */
interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate analysis config
 */
function validateAnalysisConfig(
  data: unknown,
): ValidationResult<AnalysisConfig> {
  const result = AnalysisConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      e => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Validate auto-crop config
 */
function validateAutoCropConfig(
  data: unknown,
): ValidationResult<AutoCropConfig> {
  const result = AutoCropConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      e => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Validate prompt config
 */
function validatePromptConfig(
  data: unknown,
): ValidationResult<PromptConfig> {
  const result = PromptConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      e => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Validate generation config
 */
function validateGenerationConfig(
  data: unknown,
): ValidationResult<GenerationConfig> {
  const result = GenerationConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      e => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Validate all pipeline configs at once
 * Returns validation errors for any invalid configs
 */
export function validatePipelineConfigs(data: {
  analysisConfig?: unknown;
  autoCropConfig?: unknown;
  promptConfig?: unknown;
  generationConfig?: unknown;
}): {
  valid: boolean;
  errors: Record<string, string[]>;
  validatedData?: ValidatedPipelineConfigs;
} {
  const errors: Record<string, string[]> = {};
  const validatedData: ValidatedPipelineConfigs = {};

  if (data.analysisConfig !== undefined) {
    const result = validateAnalysisConfig(data.analysisConfig);
    if (!result.success) {
      errors.analysisConfig = result.errors ?? ["Invalid analysis config"];
    } else {
      validatedData.analysisConfig = result.data;
    }
  }

  if (data.autoCropConfig !== undefined) {
    const result = validateAutoCropConfig(data.autoCropConfig);
    if (!result.success) {
      errors.autoCropConfig = result.errors ?? ["Invalid auto-crop config"];
    } else {
      validatedData.autoCropConfig = result.data;
    }
  }

  if (data.promptConfig !== undefined) {
    const result = validatePromptConfig(data.promptConfig);
    if (!result.success) {
      errors.promptConfig = result.errors ?? ["Invalid prompt config"];
    } else {
      validatedData.promptConfig = result.data;
    }
  }

  if (data.generationConfig !== undefined) {
    const result = validateGenerationConfig(data.generationConfig);
    if (!result.success) {
      errors.generationConfig = result.errors
        ?? ["Invalid generation config"];
    } else {
      validatedData.generationConfig = result.data;
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors, validatedData: valid ? validatedData : undefined };
}
