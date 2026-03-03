import type { InboxItem } from "@prisma/client";
import type { AnalysisResult } from "./analyze-message";
import type { SmartRoutingSettings } from "./types";

interface OptimizationInput {
  analysis: AnalysisResult;
  item: InboxItem;
  senderFollowers?: number;
  senderTier?: "FREE" | "PRO" | "ENTERPRISE"; // or from User model
  settings: SmartRoutingSettings;
}

export function calculatePriorityScore(
  input: OptimizationInput,
): { score: number; factors: Record<string, number>; } {
  const { analysis, senderFollowers = 0, senderTier = "FREE", settings } = input;
  const weights = settings.priorityWeights;

  let score = 0;
  const factors: Record<string, number> = {};

  // 1. Sentiment Score (-1 to 1) -> Convert to 0-1
  // Negative usage should increase priority
  // If sentiment is -0.8, we want high priority.
  // Formula: (Negative Sentiment * -1) * Weight
  // If sentiment is positive (0.8), priority adds 0 or small.
  const sentimentVal = analysis.sentimentScore;
  const sentimentFactor = sentimentVal < 0 ? Math.abs(sentimentVal) * 100 : 0;
  factors.sentiment = (sentimentFactor * weights.sentiment) / 100;
  score += factors.sentiment;

  // 2. Urgency
  const urgencyMap = { low: 0, medium: 30, high: 70, critical: 100 };
  const urgencyVal = urgencyMap[analysis.urgency] || 0;
  factors.urgency = (urgencyVal * weights.urgency) / 100;
  score += factors.urgency;

  // 3. Follower Count (Logarithmic scale)
  // 1000 followers = 10pts, 100k = 50pts, 1M = 100pts approx
  // log10(1000) = 3. log10(1M) = 6.
  const followerScore = Math.min(
    100,
    Math.max(0, Math.log10(senderFollowers + 1) * 15),
  );
  factors.followerCount = (followerScore * weights.followerCount) / 100;
  score += factors.followerCount;

  // 4. Account Tier
  const tierMap = { FREE: 0, PRO: 50, ENTERPRISE: 100 };
  const tierVal = tierMap[senderTier] || 0;
  factors.accountTier = (tierVal * weights.accountTier) / 100;
  score += factors.accountTier;

  // Normalize to 0-100
  // Total weights = 30+25+20+15+10 = 100 (if engagement used)
  // If we don't have engagement data yet, we maximize others.

  // We just sum them up. The weights are "max contribution" to total score.
  // Example: max sentiment contribution is 30 points.

  const finalScore = Math.min(100, Math.round(score));

  return { score: finalScore, factors };
}
