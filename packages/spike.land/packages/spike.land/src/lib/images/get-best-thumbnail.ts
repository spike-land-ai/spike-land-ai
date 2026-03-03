import type {
  EnhancedImage,
  EnhancementTier,
  ImageEnhancementJob,
} from "@prisma/client";

/**
 * Image with enhancement jobs loaded
 */
export type ImageWithJobs = EnhancedImage & {
  enhancementJobs: ImageEnhancementJob[];
};

/**
 * Tier priority order (higher number = better quality)
 */
const TIER_ORDER: Record<EnhancementTier, number> = {
  TIER_4K: 4,
  TIER_2K: 3,
  TIER_1K: 2,
  FREE: 1, // Free tier has lowest quality priority
};

/**
 * Get the best thumbnail URL for an image
 *
 * @param image - Image with enhancement jobs
 * @param preferEnhanced - If true, prefer enhanced versions over original
 * @returns Best thumbnail URL (enhanced or original)
 *
 * @example
 * const url = getBestThumbnail(image, true);
 * // Returns highest tier COMPLETED enhancement URL, or original if none
 */
export function getBestThumbnail(
  image: ImageWithJobs,
  preferEnhanced: boolean,
): string {
  if (!preferEnhanced) {
    return image.originalUrl;
  }

  const bestEnhancement = getBestEnhancement(image.enhancementJobs);
  return bestEnhancement?.enhancedUrl ?? image.originalUrl;
}

/**
 * Get the best completed enhancement job from a list
 *
 * @param jobs - Array of enhancement jobs
 * @returns Best completed job or null if none
 *
 * @example
 * const best = getBestEnhancement(jobs);
 * if (best) {
 *   logger.info(`Best: ${best.tier} at ${best.enhancedUrl}`);
 * }
 */
export function getBestEnhancement(
  jobs: ImageEnhancementJob[],
): ImageEnhancementJob | null {
  const completedJobs = jobs
    .filter(job => job.status === "COMPLETED" && job.enhancedUrl !== null)
    .sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier]);

  return completedJobs[0] ?? null;
}
