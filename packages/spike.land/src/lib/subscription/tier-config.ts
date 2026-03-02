/**
 * Workspace Subscription Tier Configuration
 *
 * Defines limits and pricing for workspace-level subscription tiers.
 * Used by Orbit app for social media management limits.
 *
 * @module subscription/tier-config
 */

import type { WorkspaceSubscriptionTier } from "@/generated/prisma";

/**
 * Limit values for each workspace subscription tier
 * A value of -1 indicates unlimited
 */
export interface TierLimits {
  maxSocialAccounts: number;
  maxScheduledPosts: number;
  maxAbTests: number;
  monthlyAiCredits: number;
  maxTeamMembers: number;
  priceUSD: number;
}

/**
 * Workspace tier limits configuration
 * -1 indicates unlimited
 */
export const WORKSPACE_TIER_LIMITS: Record<WorkspaceSubscriptionTier, TierLimits> = {
  FREE: {
    maxSocialAccounts: 5,
    maxScheduledPosts: 100,
    maxAbTests: 3,
    monthlyAiCredits: 500,
    maxTeamMembers: 1,
    priceUSD: 0,
  },
  PRO: {
    maxSocialAccounts: 10,
    maxScheduledPosts: -1, // Unlimited
    maxAbTests: 10,
    monthlyAiCredits: 1000,
    maxTeamMembers: 3,
    priceUSD: 29,
  },
  BUSINESS: {
    maxSocialAccounts: -1, // Unlimited
    maxScheduledPosts: -1, // Unlimited
    maxAbTests: -1, // Unlimited
    monthlyAiCredits: 5000,
    maxTeamMembers: 10,
    priceUSD: 99,
  },
} as const;

/**
 * Display names for workspace subscription tiers
 */
export const WORKSPACE_TIER_DISPLAY_NAMES: Record<WorkspaceSubscriptionTier, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
} as const;

/**
 * Tier order for upgrade/downgrade comparisons
 */
export const WORKSPACE_TIER_ORDER: WorkspaceSubscriptionTier[] = ["FREE", "PRO", "BUSINESS"];

/**
 * Check if a limit is unlimited (-1)
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Get the tier index for comparison operations
 */
export function getTierIndex(tier: WorkspaceSubscriptionTier): number {
  return WORKSPACE_TIER_ORDER.indexOf(tier);
}

/**
 * Check if targetTier is higher than currentTier
 */
export function isUpgrade(
  currentTier: WorkspaceSubscriptionTier,
  targetTier: WorkspaceSubscriptionTier,
): boolean {
  return getTierIndex(targetTier) > getTierIndex(currentTier);
}

/**
 * Check if targetTier is lower than currentTier
 */
export function isDowngrade(
  currentTier: WorkspaceSubscriptionTier,
  targetTier: WorkspaceSubscriptionTier,
): boolean {
  return getTierIndex(targetTier) < getTierIndex(currentTier);
}

/**
 * Get tier limits for a specific tier
 */
export function getTierLimits(tier: WorkspaceSubscriptionTier): TierLimits {
  return WORKSPACE_TIER_LIMITS[tier];
}

/**
 * Get the next tier in the upgrade path
 * Returns null if already at BUSINESS (highest tier)
 */
export function getNextTier(
  currentTier: WorkspaceSubscriptionTier,
): WorkspaceSubscriptionTier | null {
  const currentIndex = getTierIndex(currentTier);
  if (currentIndex >= WORKSPACE_TIER_ORDER.length - 1) {
    return null;
  }
  return WORKSPACE_TIER_ORDER[currentIndex + 1] ?? null;
}
