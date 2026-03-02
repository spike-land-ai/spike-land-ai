/**
 * Shared types extracted from Prisma schema for use in mobile and web apps
 * This is a subset of the full Prisma types, containing only what's needed for the mobile app
 */

// ============================================================================
// Enums (match Prisma enums exactly)
// ============================================================================

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export type EnhancementTier = "FREE" | "TIER_1K" | "TIER_2K" | "TIER_4K";

export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type PipelineStage = "ANALYZING" | "CROPPING" | "PROMPTING" | "GENERATING";

export type SubscriptionTier = "FREE" | "BASIC" | "STANDARD" | "PREMIUM";

export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID" | "TRIALING";

export type AlbumPrivacy = "PRIVATE" | "UNLISTED" | "PUBLIC";

export type TokenTransactionType =
  | "EARN_REGENERATION"
  | "EARN_PURCHASE"
  | "EARN_BONUS"
  | "SPEND_ENHANCEMENT"
  | "SPEND_MCP_GENERATION"
  | "SPEND_BOX_CREATION"
  | "REFUND";

export type ReferralStatus = "PENDING" | "COMPLETED" | "INVALID";

export type McpJobType = "GENERATE" | "MODIFY";

export type EngagerDataStatus = "PENDING" | "FETCHING" | "COMPLETE" | "FAILED";

export type GalleryCategory = "PORTRAIT" | "LANDSCAPE" | "PRODUCT" | "ARCHITECTURE";

export type MerchOrderStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "PAID"
  | "SUBMITTED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type ShipmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED";

// ============================================================================
// Core User Types
// ============================================================================

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  role: UserRole;
  referralCode: string | null;
  referralCount: number;
}

export interface UserTokenBalance {
  id: string;
  userId: string;
  balance: number;
  lastRegeneration: Date;
  tier: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Image & Enhancement Types
// ============================================================================

export interface EnhancedImage {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  isPublic: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  shareToken: string | null;
}

export interface ImageEnhancementJob {
  id: string;
  imageId: string;
  userId: string;
  tier: EnhancementTier;
  tokensCost: number;
  status: JobStatus;
  currentStage: PipelineStage | null;
  enhancedUrl: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  isBlend: boolean;
  isAnonymous: boolean;
}

export interface McpGenerationJob {
  id: string;
  userId: string;
  type: McpJobType;
  tier: EnhancementTier;
  tokensCost: number;
  status: JobStatus;
  prompt: string;
  inputImageUrl: string | null;
  outputImageUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Album Types
// ============================================================================

export interface Album {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverImageId: string | null;
  privacy: AlbumPrivacy;
  defaultTier: EnhancementTier;
  shareToken: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumImage {
  id: string;
  albumId: string;
  imageId: string;
  sortOrder: number;
  addedAt: Date;
}

// ============================================================================
// Token & Subscription Types
// ============================================================================

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TokenTransactionType;
  source: string | null;
  sourceId: string | null;
  balanceAfter: number;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  tokensPerMonth: number;
  rolloverTokens: number;
  maxRollover: number;
}

export interface TokensPackage {
  id: string;
  name: string;
  tokens: number;
  priceUSD: number;
  stripePriceId: string;
  active: boolean;
  sortOrder: number;
}

// ============================================================================
// Referral Types
// ============================================================================

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  status: ReferralStatus;
  tokensGranted: number;
  createdAt: Date;
  completedAt: Date | null;
}

// ============================================================================
// Merch Types
// ============================================================================

export interface MerchCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MerchProduct {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  providerSku: string;
  basePrice: number;
  retailPrice: number;
  currency: string;
  isActive: boolean;
  minDpi: number;
  minWidth: number;
  minHeight: number;
  printAreaWidth: number | null;
  printAreaHeight: number | null;
  mockupTemplate: string | null;
  sortOrder: number;
}

export interface MerchVariant {
  id: string;
  productId: string;
  name: string;
  providerSku: string;
  priceDelta: number;
  isActive: boolean;
  attributes: Record<string, string> | null;
}

export interface MerchCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  imageId: string | null;
  uploadedImageUrl: string | null;
  quantity: number;
  customText: string | null;
}

export interface MerchOrder {
  id: string;
  userId: string;
  orderNumber: string;
  status: MerchOrderStatus;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  customerEmail: string;
  customerPhone: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface MerchOrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// ============================================================================
// Gallery Types
// ============================================================================

export interface FeaturedGalleryItem {
  id: string;
  title: string;
  description: string | null;
  category: GalleryCategory;
  originalUrl: string;
  enhancedUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  isActive: boolean;
}

// ============================================================================
// Type Safety Improvements (#797)
// ============================================================================

// Social Platform API Types
export type {
  DiscordRateLimitHeaders,
  FacebookAppUsageHeader,
  FacebookBusinessUsageHeader,
  FacebookErrorResponse,
  LinkedInErrorResponse,
  SocialPlatformErrorResponse,
  TwitterErrorResponse,
  TwitterRateLimitHeaders,
} from "./social-api-responses";

// Social API Type Guards
export {
  isFacebookErrorResponse,
  isLinkedInErrorResponse,
  isSocialPlatformErrorResponse,
  isTwitterErrorResponse,
} from "./social-api-guards";

// Pipeline Configuration Types
export type {
  AnalysisConfig,
  AutoCropConfig,
  DefectKey,
  DefectOverrides,
  GenerationConfig,
  PipelineConfig,
  PromptConfig,
  ReferenceImage,
  ValidatedPipelineConfigs,
} from "./pipeline";

// Cache Types
export type { CacheEntry, CacheKey, CacheMap } from "./cache";

// Health Event Types
export type {
  HealthEventDetails,
  RateLimitEventInfo,
  TokenEventInfo,
} from "./health-events";

// Attribution Types
export type {
  AttributionModelType,
  AttributionWeight,
  JourneyStep,
  PlatformTransition,
  PositionBasedConfig,
  TimeDecayConfig,
} from "./attribution";

// Organic-to-Ad Conversion Types
export type {
  AdaptCreativeRequest,
  AdaptCreativeResponse,
  AdFormat,
  AdPlacement,
  AnalyzeAudienceRequest,
  AnalyzeAudienceResponse,
  BudgetRecommendation,
  ConversionAnalytics,
  ConversionStatus,
  ConvertToAdRequest,
  ConvertToAdResponse,
  CreativeVariant,
  EngagementData,
  EngagerDemographics,
  FetchEngagementRequest,
  FetchEngagementResponse,
  RecommendBudgetRequest,
  RecommendBudgetResponse,
  TargetingSuggestion,
} from "./organic-to-ad";
// Boost Analytics Types
export type {
  BoostCampaignData,
  BoostEffectivenessAnalysis,
  BoostPerformanceMetrics,
  BoostStatus,
  OrganicMetricsSnapshot,
  TargetingCriteria,
} from "./boost-analytics";
