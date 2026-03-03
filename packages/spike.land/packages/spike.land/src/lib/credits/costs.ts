/**
 * Single source of truth for AI credit costs across the application
 *
 * This module centralizes all AI credit cost definitions to prevent
 * cost misalignment issues between different parts of the codebase.
 *
 * Enhancement tiers correspond to maximum output dimensions:
 * - FREE: 1024px max dimension (nano model, no cost)
 * - TIER_1K: 1024px max dimension
 * - TIER_2K: 2048px max dimension
 * - TIER_4K: 4096px max dimension
 */
export const ENHANCEMENT_COSTS = {
  FREE: 0, // Nano model, 1024px output, no cost
  TIER_1K: 2, // 1024px max dimension
  TIER_2K: 5, // 2048px max dimension
  TIER_4K: 10, // 4096px max dimension
} as const;

export type EnhancementTier = keyof typeof ENHANCEMENT_COSTS;

/**
 * MCP Generation costs - same pricing structure as enhancement
 * Used for both text-to-image generation and image modification via MCP API
 */
export const MCP_GENERATION_COSTS = {
  FREE: 0, // Nano model, 1024px output, no cost
  TIER_1K: 2, // 1024px max dimension
  TIER_2K: 5, // 2048px max dimension
  TIER_4K: 10, // 4096px max dimension
} as const;

/**
 * Get the credit cost for an enhancement tier
 *
 * @param tier - The enhancement tier (TIER_1K, TIER_2K, or TIER_4K)
 * @returns The credit cost for the specified tier
 */
export function getEnhancementCost(tier: EnhancementTier): number {
  return ENHANCEMENT_COSTS[tier];
}

/**
 * Get the credit cost for an MCP generation tier
 *
 * @param tier - The generation tier (TIER_1K, TIER_2K, or TIER_4K)
 * @returns The credit cost for the specified tier
 */
export function getMcpGenerationCost(tier: EnhancementTier): number {
  return MCP_GENERATION_COSTS[tier];
}
