/**
 * Boost Detector - Main detection logic
 * Identifies boost opportunities and generates recommendations
 * Issue #565 - Content-to-Ads Loop
 */

import type {
  MarketingPlatform,
  PostBoostRecommendation,
  PostPerformance,
  Prisma,
} from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { calculateBoostScore, predictROI } from "./scoring";
import type {
  BoostDetectorConfig,
  BoostScore,
  ROIPrediction,
  TargetAudience,
} from "./types";

/**
 * Detect boost opportunities for a workspace
 * Analyzes posts and generates recommendations for high-performing content
 */
export async function detectBoostOpportunities(
  workspaceId: string,
  config: BoostDetectorConfig,
): Promise<PostBoostRecommendation[]> {
  // Get all post performance records from the lookback period
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - config.lookbackPeriod);

  const performances = await prisma.postPerformance.findMany({
    where: {
      workspaceId,
      metricPeriod: {
        gte: lookbackDate,
      },
      impressions: {
        gte: config.minImpressions,
      },
      // Only posts without existing recommendations
      recommendations: {
        none: {
          status: {
            in: ["PENDING", "ACCEPTED"],
          },
        },
      },
    },
    orderBy: {
      boostScore: "desc",
    },
    take: 20, // Limit to top 20 candidates
  });

  // Filter by thresholds
  const qualifiedPosts = performances.filter(p => {
    const meetsEngagementThreshold = p.engagementRate >= config.engagementThreshold;
    const meetsVelocityThreshold = p.engagementVelocity >= config.velocityThreshold;

    return meetsEngagementThreshold || meetsVelocityThreshold;
  });

  // Get workspace owner for recommendations
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: {
          role: "OWNER",
        },
        include: {
          user: true,
        },
        take: 1,
      },
    },
  });

  if (!workspace || workspace.members.length === 0) {
    throw new Error(`No owner found for workspace ${workspaceId}`);
  }

  const ownerId = workspace.members[0]?.userId ?? "";

  // Generate recommendations for qualified posts
  const recommendations: PostBoostRecommendation[] = [];

  for (const performance of qualifiedPosts) {
    try {
      const recommendation = await generateRecommendation(performance, ownerId);
      recommendations.push(recommendation);
    } catch (error) {
      console.error(
        `Failed to generate recommendation for post ${performance.postId}:`,
        error,
      );
      // Continue with next post
    }
  }

  return recommendations;
}

/**
 * Generate a boost recommendation for a post
 * Calculates boost score, predicts ROI, and suggests budget/targeting
 */
export async function generateRecommendation(
  postPerformance: PostPerformance,
  userId: string,
): Promise<PostBoostRecommendation> {
  // Calculate boost score
  const boostScore = await calculateBoostScore(
    postPerformance.postId,
    postPerformance.postType,
    postPerformance.workspaceId,
  );

  // Update post performance with boost score
  await prisma.postPerformance.update({
    where: { id: postPerformance.id },
    data: {
      boostScore: boostScore.score,
      boostTrigger: boostScore.trigger,
    },
  });

  // Determine suggested budget based on post performance
  const suggestedBudget = calculateSuggestedBudget(postPerformance);

  // Get available marketing platforms for workspace
  const availablePlatforms = await getAvailableMarketingPlatforms(
    postPerformance.workspaceId,
  );

  if (availablePlatforms.length === 0) {
    throw new Error("No marketing accounts connected for this workspace");
  }

  // Predict ROI for primary platform (use first available)
  const primaryPlatform = availablePlatforms[0] as MarketingPlatform;
  const roiPrediction = await predictROI(
    postPerformance,
    suggestedBudget,
    primaryPlatform,
  );

  // Generate reasoning text
  const reasoning = generateReasoningText(
    postPerformance,
    boostScore,
    roiPrediction,
  );

  // Generate target audience suggestions
  const targetAudience = generateTargetAudience(postPerformance);

  // Set expiration (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create recommendation
  const recommendation = await prisma.postBoostRecommendation.create({
    data: {
      postPerformanceId: postPerformance.id,
      postId: postPerformance.postId,
      postType: postPerformance.postType,
      workspaceId: postPerformance.workspaceId,
      userId,
      status: "PENDING",
      reasoning,
      suggestedBudget,
      estimatedImpressions: roiPrediction.estimatedImpressions,
      estimatedClicks: roiPrediction.estimatedClicks,
      estimatedConversions: roiPrediction.estimatedConversions,
      estimatedCost: roiPrediction.estimatedCost,
      confidenceScore: roiPrediction.confidenceScore,
      recommendedPlatforms: availablePlatforms,
      targetAudience: targetAudience as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return recommendation;
}

// Helper functions

function calculateSuggestedBudget(performance: PostPerformance): number {
  // Base budget on engagement rate and velocity
  const baseBudget = 50;

  // Increase budget for high-performing posts
  if (performance.engagementRate > 0.1 || performance.engagementVelocity > 50) {
    return 200;
  } else if (
    performance.engagementRate > 0.05
    || performance.engagementVelocity > 25
  ) {
    return 100;
  }

  return baseBudget;
}

async function getAvailableMarketingPlatforms(
  workspaceId: string,
): Promise<MarketingPlatform[]> {
  // Get workspace members
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { role: "OWNER" },
        take: 1,
      },
    },
  });

  if (!workspace || workspace.members.length === 0) {
    return [];
  }

  const ownerId = workspace.members[0]?.userId;
  if (!ownerId) return [];

  const accounts = await prisma.marketingAccount.findMany({
    where: {
      userId: ownerId,
      isActive: true,
    },
    select: {
      platform: true,
    },
    distinct: ["platform"],
  });

  return accounts.map(a => a.platform);
}

function generateReasoningText(
  performance: PostPerformance,
  boostScore: BoostScore,
  prediction: ROIPrediction,
): string {
  const reasons: string[] = [];

  // Engagement velocity reason
  if (boostScore.factors.engagementVelocity > 70) {
    reasons.push(
      `This post is gaining momentum with ${
        performance.engagementVelocity.toFixed(1)
      } engagements per hour.`,
    );
  }

  // Engagement rate reason
  if (performance.engagementRate > 0.05) {
    reasons.push(
      `Strong audience resonance with ${
        (performance.engagementRate * 100).toFixed(1)
      }% engagement rate.`,
    );
  }

  // Conversion reason
  if (performance.conversions > 0) {
    reasons.push(
      `Already generating ${performance.conversions} conversions organically.`,
    );
  }

  // ROI prediction
  if (prediction.estimatedROI > 1) {
    reasons.push(
      `Predicted ${
        (prediction.estimatedROI * 100).toFixed(0)
      }% ROI with ${prediction.estimatedConversions} estimated conversions.`,
    );
  }

  return reasons.join(" ");
}

function generateTargetAudience(_performance: PostPerformance): TargetAudience {
  // In a real implementation, this would analyze the post content
  // and existing audience to suggest targeting
  return {
    locations: ["US", "CA", "GB"],
    ageRange: { min: 25, max: 54 },
    interests: ["business", "marketing", "social media"],
  };
}
