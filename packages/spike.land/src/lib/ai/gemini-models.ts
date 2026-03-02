/**
 * Gemini model configuration: allowlists, tier mapping, and capability checks.
 */

/**
 * Known valid Gemini models for image generation.
 * This allowlist prevents runtime errors from invalid model names.
 */
export const VALID_GEMINI_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-image",
] as const;

/**
 * Model mapping by enhancement tier.
 * - FREE: Uses nano model (gemini-2.5-flash-image) for free tier
 * - TIER_1K/2K/4K: Uses premium model (gemini-3-pro-image-preview)
 */
const TIER_MODELS = {
  FREE: "gemini-2.5-flash-image", // Nano model (free tier)
  TIER_1K: "gemini-3-pro-image-preview", // Premium model
  TIER_2K: "gemini-3-pro-image-preview", // Premium model
  TIER_4K: "gemini-3-pro-image-preview", // Premium model
} as const;

type TierModelKey = keyof typeof TIER_MODELS;

/**
 * Get the appropriate model for a given enhancement tier.
 * @param tier - The enhancement tier
 * @returns The Gemini model name to use
 */
export function getModelForTier(tier: TierModelKey): string {
  return TIER_MODELS[tier];
}

/**
 * Default model for backward compatibility.
 * Uses premium model (gemini-3-flash-preview) as default.
 */
export const DEFAULT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_TEMPERATURE: number | null = null; // Uses Gemini API defaults

/**
 * Check if a model supports the imageSize parameter.
 * Only gemini-3-pro-image-preview supports imageSize.
 * gemini-2.5-flash-image always outputs 1024px and doesn't accept imageSize.
 */
export function supportsImageSize(model: string): boolean {
  return model === "gemini-3-pro-image-preview" || model === "gemini-3-flash-preview";
}

// Timeout for Gemini API requests (configurable via env, default 10 minutes)
// 4K images can take up to 3-5 minutes or more depending on queue/complexity,
// so 10 minutes provides a safe buffer while preventing indefinite hangs
export const GEMINI_TIMEOUT_MS = parseInt(
  process.env.GEMINI_TIMEOUT_MS || String(10 * 60 * 1000),
  10,
);

// Timeout for vision analysis stage (configurable via env, default 30 seconds)
// Analysis should be fast - if it times out, we fall back to default prompt
export const ANALYSIS_TIMEOUT_MS = parseInt(
  process.env.ANALYSIS_TIMEOUT_MS || String(30 * 1000),
  10,
);
