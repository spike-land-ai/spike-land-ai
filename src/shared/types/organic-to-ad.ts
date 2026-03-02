/**
 * Organic-to-Ad Conversion Types (Shared)
 *
 * TypeScript types for converting organic social media posts into ad creatives.
 * Part of #567: ORB-063 - Organic-to-Ad Derivation
 *
 * These types are shared between the web app and any other packages that need them.
 * ConversionStatus values are aligned with Prisma schema as the single source of truth.
 */

/**
 * Status of an organic-to-ad conversion
 * Values aligned with Prisma enum ConversionStatus
 */
export type ConversionStatus =
  | "DRAFT"
  | "FETCHING_ENGAGEMENT"
  | "ANALYZING_AUDIENCE"
  | "ADAPTING_CREATIVE"
  | "READY_FOR_LAUNCH"
  | "LAUNCHING"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED";

/**
 * Ad creative format types
 */
export type AdFormat = "FEED" | "STORY" | "REEL" | "CAROUSEL";

/**
 * Ad placement types across platforms
 */
export type AdPlacement =
  | "FACEBOOK_FEED"
  | "FACEBOOK_STORY"
  | "FACEBOOK_REEL"
  | "INSTAGRAM_FEED"
  | "INSTAGRAM_STORY"
  | "INSTAGRAM_REEL"
  | "TWITTER_FEED"
  | "TWITTER_PROMOTED"
  | "LINKEDIN_FEED"
  | "LINKEDIN_SPONSORED"
  | "TIKTOK_FEED"
  | "TIKTOK_PROMOTED";

/**
 * Platform-specific engagement data
 */
export interface EngagementData {
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
  reach?: number;
  engagementRate?: number;
  platformSpecific?: Record<string, unknown>;
}

/**
 * Aggregated engager demographics
 */
export interface EngagerDemographics {
  ageRanges: Array<{
    range: string;
    percentage: number;
  }>;
  genders: Array<{
    gender: string;
    percentage: number;
  }>;
  locations: Array<{
    location: string;
    percentage: number;
  }>;
  interests: Array<{
    interest: string;
    confidence: number;
  }>;
}

/**
 * AI-generated targeting suggestion
 */
export interface TargetingSuggestion {
  id: string;
  type: "DEMOGRAPHIC" | "INTEREST" | "BEHAVIOR" | "LOOKALIKE";
  label: string;
  value: string | string[];
  confidence: number;
  estimatedAudienceSize?: number;
  reasoning?: string;
}

/**
 * Creative variant for a specific format
 */
export interface CreativeVariant {
  id: string;
  format: AdFormat;
  placements: AdPlacement[];
  content: string;
  mediaUrls?: string[];
  aspectRatio?: string;
  callToAction?: string;
  headline?: string;
  optimizations?: string[];
}

/**
 * Budget recommendation
 */
export interface BudgetRecommendation {
  dailyBudget: number;
  totalBudget?: number;
  currency: string;
  duration?: number;
  estimatedReach: {
    min: number;
    max: number;
  };
  estimatedEngagement: {
    min: number;
    max: number;
  };
  estimatedCostPerEngagement: number;
  confidence: number;
  reasoning: string;
}

/**
 * Request to fetch engagement data
 */
export interface FetchEngagementRequest {
  postId: string;
  platform: string;
  workspaceId: string;
}

/**
 * Response from fetching engagement data
 */
export interface FetchEngagementResponse {
  engagementData: EngagementData;
  engagerDemographics?: EngagerDemographics;
  error?: string;
}

/**
 * Request to analyze audience and generate targeting
 */
export interface AnalyzeAudienceRequest {
  postId: string;
  engagementData: EngagementData;
  engagerDemographics?: EngagerDemographics;
  workspaceId: string;
}

/**
 * Response from audience analysis
 */
export interface AnalyzeAudienceResponse {
  targetingSuggestions: TargetingSuggestion[];
  error?: string;
}

/**
 * Request to adapt creative for different formats
 */
export interface AdaptCreativeRequest {
  postId: string;
  originalContent: string;
  mediaUrls?: string[];
  formats: AdFormat[];
  platform: string;
  workspaceId: string;
}

/**
 * Response from creative adaptation
 */
export interface AdaptCreativeResponse {
  creativeVariants: CreativeVariant[];
  error?: string;
}

/**
 * Request for budget recommendation
 */
export interface RecommendBudgetRequest {
  postId: string;
  reachGoal: number;
  targetingData: {
    demographics?: EngagerDemographics;
    selectedTargeting?: string[];
  };
  platform: string;
  workspaceId: string;
}

/**
 * Response from budget recommendation
 */
export interface RecommendBudgetResponse {
  recommendation: BudgetRecommendation;
  error?: string;
}

/**
 * Request to convert organic post to ad
 */
export interface ConvertToAdRequest {
  workspaceId: string;
  postId: string;
  selectedTargeting: string[];
  selectedVariants: string[];
  budget: {
    dailyBudget: number;
    totalBudget?: number;
    currency: string;
  };
  campaignName?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Response from ad conversion
 */
export interface ConvertToAdResponse {
  conversionId: string;
  campaignId?: string;
  platformCampaignId?: string;
  status: ConversionStatus;
  error?: string;
}

/**
 * Analytics data comparing organic vs. paid performance
 */
export interface ConversionAnalytics {
  conversionId: string;
  organicMetrics: {
    impressions: number;
    reach: number;
    engagement: number;
    engagementRate: number;
  };
  paidMetrics: {
    spend: number;
    impressions: number;
    reach: number;
    engagement: number;
    engagementRate: number;
    costPerEngagement: number;
  };
  roi: {
    totalSpend: number;
    incrementalReach: number;
    incrementalEngagement: number;
    efficiencyScore: number;
  };
  attributedConversions?: number;
  attributedRevenue?: number;
}
