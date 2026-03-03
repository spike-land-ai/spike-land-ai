/**
 * Type definitions for Boost Detector system
 * Issue #565 - Content-to-Ads Loop
 */

import type { MarketingPlatform, PostType } from "@/generated/prisma";

export const DEFAULT_CONVERSION_VALUE_USD = 50;

export interface BoostDetectorConfig {
  engagementThreshold: number;
  velocityThreshold: number;
  minImpressions: number;
  lookbackPeriod: number; // days
}

export interface BoostScore {
  score: number;
  factors: {
    engagementVelocity: number;
    audienceMatch: number;
    contentType: number;
    timing: number;
  };
  trigger: "HIGH_ENGAGEMENT" | "VIRAL_VELOCITY" | "CONVERSION_SPIKE";
}

export interface ROIPrediction {
  estimatedImpressions: number;
  estimatedClicks: number;
  estimatedConversions: number;
  estimatedCost: number;
  estimatedROI: number;
  confidenceScore: number;
}

export interface PostFeatures {
  postId: string;
  postType: PostType;
  engagementRate: number;
  followerCount: number;
  contentType: string;
  dayOfWeek: number;
  hourOfDay: number;
  hasMedia: boolean;
  hasHashtags: boolean;
  wordCount: number;
}

export interface HistoricalBoostData {
  postId: string;
  platform: MarketingPlatform;
  budget: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  features: PostFeatures;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface TargetAudience {
  locations?: string[];
  ageRange?: { min: number; max: number; };
  interests?: string[];
  customAudiences?: string[];
  lookalikes?: string[];
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  r2Score: number; // R-squared
  lastTrainedAt: Date;
  sampleSize: number;
}

export interface WebhookPayload {
  platform: MarketingPlatform;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}
