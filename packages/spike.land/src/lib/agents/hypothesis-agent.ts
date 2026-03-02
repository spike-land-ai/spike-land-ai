import {
  calculateConfidenceInterval,
  calculateEffectSize,
  calculatePValue,
  calculateRequiredSampleSize,
  getWinner,
  isStatisticallySignificant,
} from "@/lib/ab-testing";
import { getGeminiClient } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Hypothesis } from "@prisma/client";

export interface ExperimentDesign {
  hypothesisId: string;
  variants: number;
  primaryMetric: string;
  sampleSize: number;
  durationDays: number;
  minimumDetectableEffect: number;
}

export interface VariantContent {
  content: string;
  variationType: string; // e.g., "headline", "tone", "length"
}

export interface ExperimentAnalysis {
  experimentId: string;
  isSignificant: boolean;
  winnerVariantId: string | null;
  confidenceLevel: number;
  variants: {
    id: string;
    metricValue: number;
    confidenceInterval: { lower: number; upper: number };
    effectSize: number | null;
  }[];
  insights: string;
}

export interface WinnerSelection {
  experimentId: string;
  selectedVariantId: string | null;
  autoPromoted: boolean;
  reason: string;
}

interface ParsedHypothesis {
  title: string;
  description: string;
  theoreticalBasis: string;
  expectedOutcome: string;
  confidence: number;
  priority?: number;
}

interface ParsedVariant {
  content: string;
  variationType: string;
}

export class HypothesisAgent {
  private aiPromise = getGeminiClient();
  private model = "gemini-3-flash-preview";

  private async getAI() {
    return await this.aiPromise;
  }

  private getBrandVoice(brandProfile: unknown): string {
    if (!brandProfile || typeof brandProfile !== "object") {
      return "Professional";
    }

    const profile = brandProfile as { toneDescriptors?: unknown };

    if (Array.isArray(profile.toneDescriptors)) {
      return profile.toneDescriptors.join(", ");
    }
    return "Professional";
  }

  /**
   * Generate hypotheses based on workspace data
   */
  async generateHypotheses(params: {
    workspaceId: string;
    count?: number;
    focus?: "engagement" | "conversions" | "reach";
  }): Promise<Hypothesis[]> {
    const { workspaceId, count = 3, focus = "engagement" } = params;

    // 1. Fetch Context Data
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        brandProfile: true,
      },
    });

    if (!workspace) throw new Error("Workspace not found");

    // Fetch recent top performing posts
    const topPosts = await prisma.socialPost.findMany({
      where: {
        postAccounts: {
          some: {
            account: {
              workspaceId,
            },
          },
        },
        publishedAt: { not: null },
      },
      orderBy: [{ likes: "desc" }, { comments: "desc" }, { createdAt: "desc" }],
      take: 10,
    });

    // 2. Construct Prompt
    const prompt = `
      Analyze the following social media performance context for a brand.
      Brand Name: ${workspace.name}
      Brand Voice: ${this.getBrandVoice(workspace.brandProfile)}
      Goal: Optimize for ${focus}

      Recent Content Observations:
      ${topPosts.map((p) => `- "${p.content.substring(0, 50)}..."`).join("\n")}

      Generate ${count} testable hypotheses for improving content performance.
      For each hypothesis, provide:
      1. Title
      2. Description
      3. Theoretical Basis (Why it works)
      4. Expected Outcome
      5. Confidence Score (0.0 - 1.0)
      
      Output strictly in JSON format:
      [
        {
          "title": "...",
          "description": "...",
          "theoreticalBasis": "...",
          "expectedOutcome": "...",
          "confidence": 0.85
        }
      ]
    `;

    // 3. Generate with AI
    try {
      const ai = await this.getAI();
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const text = response.text;

      try {
        const hypotheses = JSON.parse(text || "[]");
        if (!Array.isArray(hypotheses)) return [];

        // Save to database
        const saved = await Promise.all(
          hypotheses.map(async (h: ParsedHypothesis) => {
            return prisma.hypothesis.create({
              data: {
                workspaceId: workspace.id,
                title: h.title,
                description: h.description,
                theoreticalBasis: h.theoreticalBasis,
                expectedOutcome: h.expectedOutcome,
                confidence: h.confidence,
                status: "PROPOSED",
                priority: h.priority || 1,
              },
            });
          }),
        );

        return saved;
      } catch (e) {
        logger.error("Failed to parse hypotheses", { error: e });
        return [];
      }
    } catch (error) {
      logger.error("Failed to generate hypotheses", { error });
      throw error;
    }
  }

  /**
   * Design experiment for a hypothesis
   */
  async designExperiment(params: {
    hypothesisId: string;
    variants: number;
    primaryMetric: string;
    secondaryMetrics?: string[];
    baselineRate?: number;
    minimumDetectableEffect?: number;
  }): Promise<ExperimentDesign> {
    const { hypothesisId, variants } = params;

    const BASELINE_RATE = params.baselineRate ?? 0.05;
    const MINIMUM_DETECTABLE_EFFECT = params.minimumDetectableEffect ?? 0.2;

    if (!params.baselineRate || !params.minimumDetectableEffect) {
      logger.warn(
        "Using default experiment parameters — provide baselineRate and minimumDetectableEffect for accurate sample sizing",
        {
          hypothesisId,
          baselineRate: BASELINE_RATE,
          minimumDetectableEffect: MINIMUM_DETECTABLE_EFFECT,
        },
      );
    }

    const sampleSize = calculateRequiredSampleSize(BASELINE_RATE, MINIMUM_DETECTABLE_EFFECT);

    return {
      hypothesisId,
      variants,
      primaryMetric: params.primaryMetric,
      sampleSize,
      durationDays: 7, // Default
      minimumDetectableEffect: MINIMUM_DETECTABLE_EFFECT,
    };
  }

  /**
   * Generate variant content
   */
  async generateVariants(params: {
    hypothesisId: string;
    originalContent: string;
    count: number;
  }): Promise<VariantContent[]> {
    const { hypothesisId, originalContent, count } = params;

    const hypothesis = await prisma.hypothesis.findUnique({
      where: { id: hypothesisId },
      include: { workspace: { include: { brandProfile: true } } },
    });

    if (!hypothesis) throw new Error("Hypothesis not found");

    const prompt = `
      Generate ${count} content variants based on the following hypothesis:
      "${hypothesis.title}: ${hypothesis.description}"

      Original Content:
      "${originalContent}"

      Brand Voice: ${this.getBrandVoice(hypothesis.workspace.brandProfile)}

      Requirements:
      - Create ${count} distinct variations
      - Each variation should test the hypothesis specifically
      - Maintain brand safety

      Output strictly in JSON format:
      [
        {
          "content": "...",
          "variationType": "..." (e.g. "shorter_headline", "emoji_heavy", "question_format")
        }
      ]
    `;

    try {
      const ai = await this.getAI();
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text = response.text;
      const jsonStr = (text || "").replace(/```json|```/g, "").trim();

      try {
        const variants = JSON.parse(jsonStr || "[]");
        if (!Array.isArray(variants)) {
          throw new Error("AI did not return an array");
        }
        return variants.map(
          (v: ParsedVariant | string): VariantContent => ({
            content: typeof v === "string" ? v : v.content,
            variationType: typeof v === "string" ? "unknown" : v.variationType,
          }),
        );
      } catch (e) {
        logger.error("Failed to parse AI variants", { error: e });
        return [];
      }
    } catch (error) {
      logger.error("Failed to generate variants", { error });
      throw error;
    }
  }

  /**
   * Analyze experiment results
   */
  async analyzeResults(params: { experimentId: string }): Promise<ExperimentAnalysis> {
    const experiment = await prisma.socialPostAbTest.findUnique({
      where: { id: params.experimentId },
      include: { variants: true },
    });

    if (!experiment) throw new Error("Experiment not found");

    // Calculate significance for each variant vs control (assuming first variant or originalPost is control?)
    // In SocialPostAbTest, we usually have 'originalPost' but here variants usually implies the variations.
    // Let's assume variants[0] is control for simplicity or use a specific logic.
    // Or compare all against a baseline.

    // For now, let's just pick the best performing one first.
    const alpha = 1 - experiment.significanceLevel; // e.g., 0.05

    const results = experiment.variants.map((v) => {
      const visitors = v.impressions;
      const conversions = v.engagements; // or clicks, based on metric
      const rate = visitors > 0 ? conversions / visitors : 0;

      const interval = calculateConfidenceInterval(
        conversions,
        visitors,
        experiment.significanceLevel,
      );

      return {
        id: v.id,
        metricValue: rate,
        confidenceInterval: interval,
        visitors,
        conversions,
      };
    });

    if (results.length === 0) {
      throw new Error("No variants found in experiment");
    }

    // Check statistical significance (simplified pairwise against best)
    // Note: This is a simplified check.
    const isSignificant = isStatisticallySignificant(
      results.map((r) => ({
        visitors: r.visitors,
        conversions: r.conversions,
      })),
      alpha,
    );

    const control = results[0]!;

    // Determine winner
    const variantsForWinner = results.map((r) => ({
      id: r.id,
      name: r.id,
      visitors: r.visitors,
      conversions: r.conversions,
    }));
    const winner = getWinner(variantsForWinner, alpha);

    // Save results to DB (ExperimentResult)
    await prisma.experimentResult.createMany({
      data: results.map((r) => ({
        experimentId: experiment.id,
        variantId: r.id,
        metricName: "engagement_rate", // Placeholder
        metricValue: r.metricValue,
        sampleSize: r.visitors,
        confidenceLevel: experiment.significanceLevel,
        confidenceInterval: r.confidenceInterval,
        pValue: calculatePValue([
          { visitors: control.visitors, conversions: control.conversions },
          { visitors: r.visitors, conversions: r.conversions },
        ]),
        effectSize: calculateEffectSize(control.metricValue, r.metricValue),
      })),
    });

    // Generate AI insights
    const insightsPrompt = `
      Analyze these A/B test results:
      ${results
        .map(
          (r) =>
            `Variant ${r.id}: ${(r.metricValue * 100).toFixed(2)}% conversion (N=${r.visitors})`,
        )
        .join("\n")}
      
      Is the result statistically significant? ${isSignificant}
      Winner: ${winner ? winner.id : "None"}

      Provide a brief (2-3 sentences) strategic insight.
    `;

    let insightText = "Analysis pending.";
    try {
      const ai = await this.getAI();
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: insightsPrompt }] }],
      });
      insightText = response.text || "";
    } catch (e) {
      logger.warn("Failed to generate insights", { error: e });
    }

    // Update experiment with winner if significant
    if (winner) {
      await prisma.socialPostAbTest.update({
        where: { id: experiment.id },
        data: { winnerVariantId: winner.id },
      });
    }

    return {
      experimentId: experiment.id,
      isSignificant,
      winnerVariantId: winner?.id || null,
      confidenceLevel: experiment.significanceLevel,
      variants: results.map((r) => ({
        id: r.id,
        metricValue: r.metricValue,
        confidenceInterval: r.confidenceInterval,
        effectSize: calculateEffectSize(control.metricValue, r.metricValue),
      })),
      insights: insightText,
    };
  }

  /**
   * Auto-select winner
   */
  async selectWinner(params: {
    experimentId: string;
    autoPromote?: boolean;
  }): Promise<WinnerSelection> {
    const analysis = await this.analyzeResults({
      experimentId: params.experimentId,
    });

    if (analysis.winnerVariantId) {
      // Logic to promote (e.g. create a new post from winner content)
      // For now just return selection
      return {
        experimentId: params.experimentId,
        selectedVariantId: analysis.winnerVariantId,
        autoPromoted: params.autoPromote || false,
        reason: "Statistically significant winner found.",
      };
    }

    return {
      experimentId: params.experimentId,
      selectedVariantId: null,
      autoPromoted: false,
      reason: "No statistically significant winner.",
    };
  }
}
