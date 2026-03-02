/**
 * Audience Analyzer
 *
 * AI-powered audience insight and budget recommendation utilities.
 * Uses Gemini for audience segment analysis and returns structured insights.
 */

import logger from "@/lib/logger";
import { getGeminiClient, isGeminiConfigured } from "./gemini-client";

// =============================================================================
// Types
// =============================================================================

/**
 * Demographic breakdown of an audience segment
 */
export interface AudienceDemographics {
  /** Estimated age range distribution, keys are range labels e.g. "18-24" */
  ageRanges: Record<string, number>;
  /** Gender distribution, keys are "male" | "female" | "other" */
  genderSplit: Record<string, number>;
  /** Top geographic regions by estimated share */
  topRegions: Array<{ region: string; share: number }>;
  /** Primary language(s) of the audience */
  primaryLanguages: string[];
}

/**
 * Behavioral and interest signals for an audience
 */
export interface AudienceInterests {
  /** Top interest categories */
  categories: string[];
  /** Estimated engagement time windows (e.g. "weekday evenings") */
  peakEngagementWindows: string[];
  /** Device preference split, keys are "mobile" | "desktop" | "tablet" */
  deviceSplit: Record<string, number>;
}

/**
 * Input parameters for audience analysis
 */
export interface AudienceAnalysisInput {
  /** Total audience / follower count */
  audienceSize: number;
  /** Social platform being analyzed */
  platform: string;
  /** Industry or niche for context */
  industry?: string;
  /** Any known demographic data to augment the analysis */
  knownDemographics?: Partial<AudienceDemographics>;
  /** Recent engagement metrics for signal */
  engagementRate?: number;
  /** Top-performing content types */
  topContentTypes?: string[];
}

/**
 * Structured audience insight returned by the analyzer
 */
export interface AudienceInsight {
  summary: string;
  demographics: AudienceDemographics;
  interests: AudienceInterests;
  /** Key actionable recommendations */
  recommendations: string[];
  /** Confidence level of the analysis (0–1) */
  confidence: number;
  analyzedAt: Date;
}

/**
 * Budget recommendation for a campaign targeting this audience
 */
export interface BudgetRecommendation {
  /** Suggested daily budget in USD */
  dailyBudgetUsd: number;
  /** Suggested total campaign budget in USD */
  totalCampaignBudgetUsd: number;
  /** Estimated cost per 1000 impressions (CPM) */
  estimatedCpmUsd: number;
  /** Estimated cost per click (CPC) */
  estimatedCpcUsd: number;
  /** Estimated reach with the recommended budget */
  estimatedReach: number;
  /** Recommended campaign duration in days */
  recommendedDurationDays: number;
  /** Confidence tier: "low" | "medium" | "high" */
  confidence: "low" | "medium" | "high";
  rationale: string;
}

// =============================================================================
// Gemini-powered analysis
// =============================================================================

const AUDIENCE_ANALYSIS_SYSTEM_PROMPT = `You are a social media audience analyst.
Analyse the provided audience data and return a structured JSON insight object.
Be data-driven, concise, and actionable. Base estimates on industry benchmarks
when specific data is unavailable. Always include confidence scores.`;

/**
 * Analyse an audience using Gemini AI.
 *
 * Falls back to a heuristic analysis when Gemini is not configured.
 *
 * @param input - Audience data to analyse
 */
export async function analyzeAudience(input: AudienceAnalysisInput): Promise<AudienceInsight> {
  const geminiAvailable = await isGeminiConfigured().catch(() => false);

  if (!geminiAvailable) {
    logger.info("Gemini not configured — using heuristic audience analysis", {
      platform: input.platform,
    });
    return buildHeuristicInsight(input);
  }

  try {
    const ai = await getGeminiClient();

    const prompt = buildAnalysisPrompt(input);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: AUDIENCE_ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
    });

    const rawText = response.text ?? "";

    if (!rawText) {
      logger.warn("Empty Gemini response for audience analysis — using heuristic");
      return buildHeuristicInsight(input);
    }

    const parsed = JSON.parse(rawText) as Partial<AudienceInsight>;
    return mergeWithDefaults(parsed, input);
  } catch (error) {
    logger.error("Gemini audience analysis failed — using heuristic", {
      error: error instanceof Error ? error.message : String(error),
    });
    return buildHeuristicInsight(input);
  }
}

// =============================================================================
// Budget recommendation
// =============================================================================

/**
 * Platform-specific CPM benchmarks (USD) based on 2024–2025 industry averages
 */
const PLATFORM_CPM_BENCHMARKS: Record<string, number> = {
  TWITTER: 6.46,
  FACEBOOK: 9.13,
  INSTAGRAM: 7.91,
  TIKTOK: 10.0,
  LINKEDIN: 33.8,
  YOUTUBE: 9.68,
  SNAPCHAT: 3.18,
  PINTEREST: 5.0,
  DISCORD: 2.5,
};

/**
 * Platform-specific CPC benchmarks (USD)
 */
const PLATFORM_CPC_BENCHMARKS: Record<string, number> = {
  TWITTER: 0.58,
  FACEBOOK: 0.97,
  INSTAGRAM: 1.28,
  TIKTOK: 1.0,
  LINKEDIN: 5.26,
  YOUTUBE: 0.49,
  SNAPCHAT: 0.5,
  PINTEREST: 1.5,
  DISCORD: 0.3,
};

/**
 * Recommend a campaign budget based on audience size and platform.
 *
 * Uses industry CPM benchmarks and scales recommendations by audience size.
 * When Gemini is available, the rationale is AI-generated for context-aware advice.
 *
 * @param audienceSize - Total audience / follower count
 * @param platform - Social platform key (e.g. "TWITTER")
 * @param campaignGoal - Optional campaign objective for tuning recommendations
 * @param durationDays - Desired campaign duration in days (default: 30)
 */
export async function recommendBudget(
  audienceSize: number,
  platform: string,
  campaignGoal?: string,
  durationDays = 30,
): Promise<BudgetRecommendation> {
  const platformKey = platform.toUpperCase();
  const cpm = PLATFORM_CPM_BENCHMARKS[platformKey] ?? 8.0;
  const cpc = PLATFORM_CPC_BENCHMARKS[platformKey] ?? 1.0;

  // Target reaching ~10% of the audience per day as a starting point
  const dailyReachTarget = Math.ceil(audienceSize * 0.1);
  const dailyBudgetUsd = (dailyReachTarget / 1000) * cpm;
  const totalCampaignBudgetUsd = dailyBudgetUsd * durationDays;
  const estimatedReach = Math.ceil((totalCampaignBudgetUsd / cpm) * 1000);

  // Confidence based on audience size — larger audiences have more data points
  let confidence: "low" | "medium" | "high";
  if (audienceSize < 1_000) {
    confidence = "low";
  } else if (audienceSize < 100_000) {
    confidence = "medium";
  } else {
    confidence = "high";
  }

  // Try to generate an AI rationale if Gemini is configured
  let rationale = buildHeuristicRationale(
    platform,
    audienceSize,
    dailyBudgetUsd,
    durationDays,
    campaignGoal,
  );

  const geminiAvailable = await isGeminiConfigured().catch(() => false);
  if (geminiAvailable) {
    try {
      const ai = await getGeminiClient();
      const prompt = [
        `Write a 2-sentence budget recommendation rationale for a ${platform} campaign.`,
        `Audience size: ${audienceSize.toLocaleString()}.`,
        `Suggested daily budget: $${dailyBudgetUsd.toFixed(2)} over ${durationDays} days.`,
        campaignGoal ? `Campaign goal: ${campaignGoal}.` : "",
        "Be concise and actionable.",
      ]
        .filter(Boolean)
        .join(" ");

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 200, temperature: 0.4 },
      });

      const aiText = response.text?.trim();
      if (aiText) {
        rationale = aiText;
      }
    } catch (error) {
      logger.warn("Gemini rationale generation failed — using heuristic", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    dailyBudgetUsd: Math.round(dailyBudgetUsd * 100) / 100,
    totalCampaignBudgetUsd: Math.round(totalCampaignBudgetUsd * 100) / 100,
    estimatedCpmUsd: cpm,
    estimatedCpcUsd: cpc,
    estimatedReach,
    recommendedDurationDays: durationDays,
    confidence,
    rationale,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function buildAnalysisPrompt(input: AudienceAnalysisInput): string {
  return [
    `Analyse the following ${input.platform} audience:`,
    `- Audience size: ${input.audienceSize.toLocaleString()}`,
    input.industry ? `- Industry/niche: ${input.industry}` : "",
    input.engagementRate !== undefined
      ? `- Engagement rate: ${(input.engagementRate * 100).toFixed(2)}%`
      : "",
    input.topContentTypes?.length ? `- Top content types: ${input.topContentTypes.join(", ")}` : "",
    input.knownDemographics
      ? `- Known demographics: ${JSON.stringify(input.knownDemographics)}`
      : "",
    "",
    "Return a JSON object with the shape: { summary, demographics, interests, recommendations, confidence }",
    "demographics: { ageRanges, genderSplit, topRegions, primaryLanguages }",
    "interests: { categories, peakEngagementWindows, deviceSplit }",
    "recommendations: string[]",
    "confidence: number between 0 and 1",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

function buildHeuristicInsight(input: AudienceAnalysisInput): AudienceInsight {
  const platform = input.platform.toLowerCase();
  return {
    summary: `Heuristic analysis for a ${input.platform} audience of ${input.audienceSize.toLocaleString()} based on industry benchmarks.`,
    demographics: {
      ageRanges:
        platform === "linkedin"
          ? { "25-34": 0.33, "35-54": 0.39, "18-24": 0.17, "55+": 0.11 }
          : platform === "tiktok"
            ? { "18-24": 0.42, "25-34": 0.31, "13-17": 0.16, "35+": 0.11 }
            : { "18-24": 0.29, "25-34": 0.32, "35-44": 0.21, "45+": 0.18 },
      genderSplit:
        platform === "pinterest"
          ? { female: 0.76, male: 0.17, other: 0.07 }
          : { male: 0.51, female: 0.44, other: 0.05 },
      topRegions: [
        { region: "United States", share: 0.35 },
        { region: "United Kingdom", share: 0.08 },
        { region: "Canada", share: 0.06 },
      ],
      primaryLanguages: ["English"],
    },
    interests: {
      categories: input.industry ? [input.industry] : ["Technology", "Media", "Entertainment"],
      peakEngagementWindows: ["Weekday evenings (6pm–9pm)", "Weekend afternoons"],
      deviceSplit: { mobile: 0.72, desktop: 0.22, tablet: 0.06 },
    },
    recommendations: [
      "Post consistently during peak engagement windows to maximise organic reach.",
      "Use short-form video content — it consistently outperforms static posts on most platforms.",
      "A/B test creative assets to identify what resonates best with your specific audience.",
    ],
    confidence: 0.4,
    analyzedAt: new Date(),
  };
}

function mergeWithDefaults(
  parsed: Partial<AudienceInsight>,
  input: AudienceAnalysisInput,
): AudienceInsight {
  const fallback = buildHeuristicInsight(input);
  return {
    summary: parsed.summary ?? fallback.summary,
    demographics: {
      ageRanges: parsed.demographics?.ageRanges ?? fallback.demographics.ageRanges,
      genderSplit: parsed.demographics?.genderSplit ?? fallback.demographics.genderSplit,
      topRegions: parsed.demographics?.topRegions ?? fallback.demographics.topRegions,
      primaryLanguages:
        parsed.demographics?.primaryLanguages ?? fallback.demographics.primaryLanguages,
    },
    interests: {
      categories: parsed.interests?.categories ?? fallback.interests.categories,
      peakEngagementWindows:
        parsed.interests?.peakEngagementWindows ?? fallback.interests.peakEngagementWindows,
      deviceSplit: parsed.interests?.deviceSplit ?? fallback.interests.deviceSplit,
    },
    recommendations: parsed.recommendations ?? fallback.recommendations,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : fallback.confidence,
    analyzedAt: new Date(),
  };
}

function buildHeuristicRationale(
  platform: string,
  audienceSize: number,
  dailyBudgetUsd: number,
  durationDays: number,
  campaignGoal?: string,
): string {
  const goal = campaignGoal ? ` for ${campaignGoal}` : "";
  return (
    `Based on ${platform} CPM benchmarks and an audience of ${audienceSize.toLocaleString()}, ` +
    `a daily budget of $${dailyBudgetUsd.toFixed(2)} is recommended${goal}. ` +
    `Running for ${durationDays} days should provide sufficient data to optimise targeting and creative performance.`
  );
}
