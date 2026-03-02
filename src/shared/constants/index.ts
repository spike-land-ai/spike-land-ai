/**
 * Shared constants for token costs, pricing, and configuration
 * Used by both web and mobile apps
 */

// ============================================================================
// Token Costs
// ============================================================================

export const ENHANCEMENT_COSTS = {
  FREE: 0, // Nano model, 1024px output, no cost
  TIER_1K: 2, // 1024px max dimension
  TIER_2K: 5, // 2048px max dimension
  TIER_4K: 10, // 4096px max dimension
} as const;

export const MCP_GENERATION_COSTS = {
  FREE: 0,
  TIER_1K: 2,
  TIER_2K: 5,
  TIER_4K: 10,
} as const;

export type EnhancementTierKey = keyof typeof ENHANCEMENT_COSTS;

// ============================================================================
// Token Regeneration
// ============================================================================

export const TOKEN_REGENERATION = {
  /** Tokens regenerated per interval */
  TOKENS_PER_REGEN: 1,
  /** Regeneration interval in milliseconds (15 minutes) */
  REGEN_INTERVAL_MS: 15 * 60 * 1000,
  /** Maximum tokens that can be regenerated to */
  MAX_FREE_TOKENS: 10,
} as const;

// ============================================================================
// Image Constraints
// ============================================================================

export const IMAGE_CONSTRAINTS = {
  /** Maximum file size for upload (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Allowed image MIME types */
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
  /** Maximum batch upload count */
  MAX_BATCH_SIZE: 20,
  /** Output dimensions per tier */
  TIER_DIMENSIONS: {
    FREE: 1024,
    TIER_1K: 1024,
    TIER_2K: 2048,
    TIER_4K: 4096,
  } as const,
} as const;

// ============================================================================
// Aspect Ratios
// ============================================================================

export const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type AspectRatio = (typeof SUPPORTED_ASPECT_RATIOS)[number];

// ============================================================================
// Referral Program
// ============================================================================

export const REFERRAL_CONFIG = {
  /** Tokens earned per successful referral */
  TOKENS_PER_REFERRAL: 50,
  /** Tokens given to new user from referral */
  SIGNUP_BONUS_TOKENS: 10,
} as const;

// ============================================================================
// API Configuration
// ============================================================================

export const API_CONFIG = {
  /** Base URL for production API */
  PRODUCTION_URL: "https://spike.land",
  /** Default timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 30000,
  /** Job polling interval in milliseconds */
  JOB_POLL_INTERVAL_MS: 2000,
} as const;

// ============================================================================
// Subscription Tiers
// ============================================================================

export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: "Free",
    tokensPerMonth: 0,
    maxRollover: 0,
    priority: false,
    apiAccess: false,
  },
  BASIC: {
    name: "Basic",
    tokensPerMonth: 100,
    maxRollover: 50,
    priority: false,
    apiAccess: false,
  },
  STANDARD: {
    name: "Standard",
    tokensPerMonth: 300,
    maxRollover: 150,
    priority: true,
    apiAccess: false,
  },
  PREMIUM: {
    name: "Premium",
    tokensPerMonth: 1000,
    maxRollover: 500,
    priority: true,
    apiAccess: true,
  },
} as const;

// ============================================================================
// RevenueCat Product IDs (for IAP)
// ============================================================================

export const REVENUECAT_PRODUCTS = {
  /** Token package product IDs */
  TOKEN_PACKAGES: {
    STARTER: "tokens_starter_50",
    PRO: "tokens_pro_150",
    POWER: "tokens_power_500",
  },
  /** Subscription product IDs */
  SUBSCRIPTIONS: {
    BASIC_MONTHLY: "sub_basic_monthly",
    STANDARD_MONTHLY: "sub_standard_monthly",
    PREMIUM_MONTHLY: "sub_premium_monthly",
  },
} as const;
