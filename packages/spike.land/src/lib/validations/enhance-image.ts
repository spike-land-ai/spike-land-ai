import type { EnhancementTier } from "@prisma/client";
import { z } from "zod";

/**
 * Valid enhancement tiers for validation
 */
export const VALID_TIERS = ["FREE", "TIER_1K", "TIER_2K", "TIER_4K"] as const;

/**
 * Blend source input - either an image ID (stored image) or base64 data (uploaded)
 * XOR constraint: exactly one of imageId or base64 must be provided
 */
const blendSourceSchema = z
  .object({
    imageId: z.string().min(1).optional(),
    base64: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasImageId = !!data.imageId;
      const hasBase64 = !!data.base64;
      // XOR: exactly one must be present
      return hasImageId !== hasBase64;
    },
    {
      message: "Provide either imageId or base64/mimeType, not both",
    },
  )
  .refine(
    (data) => {
      // If base64 is provided, mimeType must also be provided
      if (data.base64 && !data.mimeType) {
        return false;
      }
      // If mimeType is provided, it must start with "image/"
      if (data.mimeType && !data.mimeType.startsWith("image/")) {
        return false;
      }
      return true;
    },
    {
      message: "base64 requires a valid mimeType starting with 'image/'",
    },
  );

/**
 * Schema for enhancement request body validation
 */
export const enhanceImageRequestSchema = z.object({
  imageId: z.string().min(1, "imageId is required"),
  tier: z.enum(VALID_TIERS, {
    message: `tier must be one of: ${VALID_TIERS.join(", ")}`,
  }),
  blendSource: blendSourceSchema.optional(),
});

/**
 * Inferred type from schema
 */
export type EnhanceImageRequest = z.infer<typeof enhanceImageRequestSchema>;

/**
 * Result of validating request body
 */
export interface ValidationResult {
  success: true;
  data: EnhanceImageRequest;
}

/**
 * Error result from validation
 */
export interface ValidationError {
  success: false;
  error: string;
  suggestion: string;
}

/**
 * Validates the enhance image request body
 *
 * @param body - The parsed JSON body
 * @returns Validation result with either data or error
 */
export function validateEnhanceRequest(body: unknown): ValidationResult | ValidationError {
  const result = enhanceImageRequestSchema.safeParse(body);

  if (!result.success) {
    const issues = result.error?.issues ?? [];
    if (issues.length === 0) {
      return {
        success: false,
        error: "Invalid request format",
        suggestion: "Please check your request and try again.",
      };
    }

    const firstIssue = issues[0];
    if (!firstIssue) {
      return {
        success: false,
        error: "Invalid request format",
        suggestion: "Please check your request and try again.",
      };
    }

    const path = firstIssue.path.join(".");
    const message = path ? `${path}: ${firstIssue.message}` : firstIssue.message;

    return {
      success: false,
      error: message,
      suggestion: getSuggestionForField(firstIssue.path[0]?.toString()),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Get user-friendly suggestion based on which field failed
 */
function getSuggestionForField(field?: string): string {
  switch (field) {
    case "imageId":
      return "Please provide a valid image ID.";
    case "tier":
      return "Please select a valid enhancement tier (FREE, 1K, 2K, or 4K).";
    case "blendSource":
      return "Please provide either an image ID or base64 data for the blend source.";
    default:
      return "Please check your request and try again.";
  }
}

/**
 * Validates base64 size (rough estimate: base64 adds ~33% overhead)
 * Maximum size: 20MB
 */
export function validateBase64Size(base64: string): {
  valid: boolean;
  estimatedSize: number;
  maxSize: number;
} {
  const maxSize = 20 * 1024 * 1024; // 20MB
  const estimatedSize = (base64.length * 3) / 4;

  return {
    valid: estimatedSize <= maxSize,
    estimatedSize,
    maxSize,
  };
}

/**
 * Type guard to check if a tier is valid
 */
export function isValidTier(tier: string): tier is EnhancementTier {
  return VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number]);
}
