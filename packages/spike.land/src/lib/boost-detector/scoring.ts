/**
 * Boost Scoring Engine
 * Calculates boost scores, ROI predictions, and engagement velocity
 * Issue #565 - Content-to-Ads Loop
 */

import type { MarketingPlatform, PostPerformance, PostType } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { type BoostScore, DEFAULT_CONVERSION_VALUE_USD, type ROIPrediction } from "./types";

/**
 * Calculate boost score for a post based on performance metrics
 * Score formula:
 * - Engagement velocity (40%)
 * - Audience match (30%)
 * - Content type (20%)
 * - Timing (10%)
 */
export async function calculateBoostScore(
  postId: string,
  postType: PostType,
  workspaceId: string,
): Promise<BoostScore> {
  // Get post performance data
  const performance = await prisma.postPerformance.findFirst({
    where: {
      postId,
      postType,
      workspaceId,
    },
    orderBy: {
      checkedAt: "desc",
    },
  });

  if (!performance) {
    throw new Error(`No performance data found for post ${postId}`);
  }

  // Calculate engagement velocity score (0-100)
  const velocityScore = Math.min(100, (performance.engagementVelocity / 10) * 100);

  // Calculate audience match score (0-100)
  // Based on engagement rate compared to workspace average
  const workspaceAvg = await getWorkspaceAverageEngagementRate(workspaceId);
  const audienceScore = Math.min(100, (performance.engagementRate / workspaceAvg) * 50);

  // Calculate content type score (0-100)
  // Higher score for posts with media and good structure
  const contentScore = 70; // Simplified for now, would analyze content in real implementation

  // Calculate timing score (0-100)
  // Higher score for posts published at optimal times
  const timingScore = 80; // Simplified for now, would analyze publishing time

  // Weighted average
  const totalScore =
    velocityScore * 0.4 + audienceScore * 0.3 + contentScore * 0.2 + timingScore * 0.1;

  // Determine trigger type
  let trigger: "HIGH_ENGAGEMENT" | "VIRAL_VELOCITY" | "CONVERSION_SPIKE" = "HIGH_ENGAGEMENT";
  if (performance.engagementVelocity > 50) {
    trigger = "VIRAL_VELOCITY";
  } else if (performance.conversions > 10) {
    trigger = "CONVERSION_SPIKE";
  }

  return {
    score: Math.round(totalScore),
    factors: {
      engagementVelocity: Math.round(velocityScore),
      audienceMatch: Math.round(audienceScore),
      contentType: Math.round(contentScore),
      timing: Math.round(timingScore),
    },
    trigger,
  };
}

/**
 * Predict ROI for boosting a post
 * Uses historical data and simple linear regression
 */
export async function predictROI(
  postPerformance: PostPerformance,
  suggestedBudget: number,
  platform: MarketingPlatform,
): Promise<ROIPrediction> {
  // Get historical campaign data for this workspace
  const historicalCampaigns = await getHistoricalCampaignData(
    postPerformance.workspaceId,
    platform,
  );

  if (historicalCampaigns.length === 0) {
    // No historical data, use industry averages
    return getIndustryAveragePrediction(suggestedBudget, platform);
  }

  // Calculate average metrics from historical data
  const avgCTR = calculateAverageCTR(historicalCampaigns);
  const avgCPC = calculateAverageCPC(historicalCampaigns);
  const avgConversionRate = calculateAverageConversionRate(historicalCampaigns);

  // Apply engagement rate multiplier
  const engagementMultiplier = Math.max(0.5, Math.min(2.0, postPerformance.engagementRate / 0.05));

  // Predictions
  const estimatedImpressions = Math.round(
    (suggestedBudget / avgCPC) * (1 / avgCTR) * engagementMultiplier,
  );
  const estimatedClicks = Math.round(estimatedImpressions * avgCTR);
  const estimatedConversions = Math.round(estimatedClicks * avgConversionRate);
  const estimatedCost = suggestedBudget;

  // Calculate ROI
  const estimatedRevenue = estimatedConversions * DEFAULT_CONVERSION_VALUE_USD; // Assume default value per conversion
  const estimatedROI = (estimatedRevenue - estimatedCost) / estimatedCost;

  // Confidence score based on historical data availability
  const confidenceScore = Math.min(
    1.0,
    historicalCampaigns.length / 10, // Max confidence at 10+ campaigns
  );

  return {
    estimatedImpressions,
    estimatedClicks,
    estimatedConversions,
    estimatedCost,
    estimatedROI,
    confidenceScore,
  };
}

/**
 * Analyze engagement velocity for a post
 * Calculates engagements per hour over the lookback period
 */
export async function analyzeEngagementVelocity(
  postId: string,
  _lookbackHours: number = 24,
): Promise<number> {
  // In a real implementation, this would query time-series engagement data
  // For now, we'll use a simplified calculation from PostPerformance

  const performance = await prisma.postPerformance.findFirst({
    where: { postId },
    orderBy: { checkedAt: "desc" },
  });

  if (!performance) {
    return 0;
  }

  // Return the stored velocity
  return performance.engagementVelocity;
}

// Helper functions

async function getWorkspaceAverageEngagementRate(workspaceId: string): Promise<number> {
  const result = await prisma.postPerformance.aggregate({
    where: {
      workspaceId,
      impressions: { gt: 100 }, // Only posts with meaningful impressions
    },
    _avg: {
      engagementRate: true,
    },
  });

  return result._avg.engagementRate ?? 0.03; // Default 3%
}

interface HistoricalCampaign {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

async function getHistoricalCampaignData(
  workspaceId: string,
  platform: MarketingPlatform,
): Promise<HistoricalCampaign[]> {
  const appliedBoosts = await prisma.appliedBoost.findMany({
    where: {
      workspaceId,
      platform,
      status: "COMPLETED",
      actualSpend: { gt: 0 },
    },
    select: {
      actualImpressions: true,
      actualClicks: true,
      actualConversions: true,
      actualSpend: true,
    },
  });

  return appliedBoosts.map((boost) => ({
    impressions: boost.actualImpressions,
    clicks: boost.actualClicks,
    conversions: boost.actualConversions,
    spend: boost.actualSpend,
  }));
}

function calculateAverageCTR(campaigns: HistoricalCampaign[]): number {
  if (campaigns.length === 0) return 0.02; // 2% default

  const totalCTR = campaigns.reduce((sum, campaign) => {
    const ctr = campaign.impressions > 0 ? campaign.clicks / campaign.impressions : 0;
    return sum + ctr;
  }, 0);

  return totalCTR / campaigns.length;
}

function calculateAverageCPC(campaigns: HistoricalCampaign[]): number {
  if (campaigns.length === 0) return 1.5; // $1.50 default

  const totalCPC = campaigns.reduce((sum, campaign) => {
    const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
    return sum + cpc;
  }, 0);

  return totalCPC / campaigns.length;
}

function calculateAverageConversionRate(campaigns: HistoricalCampaign[]): number {
  if (campaigns.length === 0) return 0.05; // 5% default

  const totalConversionRate = campaigns.reduce((sum, campaign) => {
    const convRate = campaign.clicks > 0 ? campaign.conversions / campaign.clicks : 0;
    return sum + convRate;
  }, 0);

  return totalConversionRate / campaigns.length;
}

function getIndustryAveragePrediction(budget: number, platform: MarketingPlatform): ROIPrediction {
  // Industry averages vary by platform
  const metrics =
    platform === "FACEBOOK"
      ? {
          cpc: 1.2,
          ctr: 0.025,
          conversionRate: 0.08,
          costPerConversion: 15,
        }
      : {
          cpc: 2.5,
          ctr: 0.035,
          conversionRate: 0.1,
          costPerConversion: 25,
        };

  const estimatedClicks = Math.round(budget / metrics.cpc);
  const estimatedImpressions = Math.round(estimatedClicks / metrics.ctr);
  const estimatedConversions = Math.round(estimatedClicks * metrics.conversionRate);
  const estimatedRevenue = estimatedConversions * 50; // $50 per conversion
  const estimatedROI = (estimatedRevenue - budget) / budget;

  return {
    estimatedImpressions,
    estimatedClicks,
    estimatedConversions,
    estimatedCost: budget,
    estimatedROI,
    confidenceScore: 0.3, // Low confidence without historical data
  };
}
