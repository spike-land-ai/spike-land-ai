import { describe, expect, it } from "vitest";
import { calculatePriorityScore } from "./priority-calculator";
import type { SmartRoutingSettings } from "./types";

// Minimal InboxItem stub - only needs to exist as the function doesn't use it directly
const fakeItem = {} as Parameters<typeof calculatePriorityScore>[0]["item"];

const defaultSettings: SmartRoutingSettings = {
  enabled: true,
  autoAnalyzeOnFetch: false,
  negativeSentimentThreshold: -0.5,
  priorityWeights: {
    sentiment: 30,
    urgency: 25,
    followerCount: 20,
    engagement: 15,
    accountTier: 10,
  },
  escalation: {
    enabled: false,
    slaTimeoutMinutes: 60,
    levels: [],
    autoAssign: false,
  },
  rules: [],
};

const baseAnalysis = {
  sentiment: "NEUTRAL" as const,
  sentimentScore: 0,
  urgency: "low" as const,
  suggestedResponses: [],
};

describe("calculatePriorityScore", () => {
  it("should return 0 for neutral analysis with no followers and free tier", () => {
    const result = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      senderFollowers: 0,
      senderTier: "FREE",
      settings: defaultSettings,
    });

    expect(result.score).toBe(0);
    expect(result.factors).toBeDefined();
  });

  it("should increase score for negative sentiment", () => {
    const result = calculatePriorityScore({
      analysis: { ...baseAnalysis, sentimentScore: -0.8 },
      item: fakeItem,
      settings: defaultSettings,
    });

    // sentimentFactor = abs(-0.8) * 100 = 80
    // factor contribution = (80 * 30) / 100 = 24
    expect(result.factors.sentiment).toBeCloseTo(24, 0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("should not increase score for positive sentiment", () => {
    const result = calculatePriorityScore({
      analysis: { ...baseAnalysis, sentimentScore: 0.9 },
      item: fakeItem,
      settings: defaultSettings,
    });

    expect(result.factors.sentiment).toBe(0);
  });

  it("should assign urgency scores by level", () => {
    const levels: Array<"low" | "medium" | "high" | "critical"> = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    const scores = levels.map((urgency) => {
      const result = calculatePriorityScore({
        analysis: { ...baseAnalysis, urgency },
        item: fakeItem,
        settings: defaultSettings,
      });
      return result.factors.urgency;
    });

    // Each level should produce a higher urgency factor
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
  });

  it("should calculate follower score logarithmically", () => {
    const result1k = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      senderFollowers: 1000,
      settings: defaultSettings,
    });
    const result1M = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      senderFollowers: 1_000_000,
      settings: defaultSettings,
    });

    expect(result1M.factors.followerCount).toBeGreaterThan(result1k.factors.followerCount!);
    // Both should be positive
    expect(result1k.factors.followerCount).toBeGreaterThan(0);
    expect(result1M.factors.followerCount).toBeGreaterThan(0);
  });

  it("should handle zero followers", () => {
    const result = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      senderFollowers: 0,
      settings: defaultSettings,
    });

    // log10(0+1) = 0, so follower score = 0
    expect(result.factors.followerCount).toBe(0);
  });

  it("should assign tier-based scores", () => {
    const tiers: Array<"FREE" | "PRO" | "ENTERPRISE"> = ["FREE", "PRO", "ENTERPRISE"];

    const scores = tiers.map((senderTier) => {
      const result = calculatePriorityScore({
        analysis: baseAnalysis,
        item: fakeItem,
        senderTier,
        settings: defaultSettings,
      });
      return result.factors.accountTier;
    });

    expect(scores[0]).toBe(0); // FREE = 0
    expect(scores[1]).toBeGreaterThan(scores[0]!); // PRO > FREE
    expect(scores[2]).toBeGreaterThan(scores[1]!); // ENTERPRISE > PRO
  });

  it("should default senderTier to FREE when not provided", () => {
    const result = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      settings: defaultSettings,
    });

    expect(result.factors.accountTier).toBe(0);
  });

  it("should cap score at 100", () => {
    // Create extreme input to push score above 100
    const result = calculatePriorityScore({
      analysis: {
        ...baseAnalysis,
        sentimentScore: -1.0,
        urgency: "critical",
      },
      item: fakeItem,
      senderFollowers: 10_000_000,
      senderTier: "ENTERPRISE",
      settings: defaultSettings,
    });

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("should respect custom priority weights", () => {
    const customSettings: SmartRoutingSettings = {
      ...defaultSettings,
      priorityWeights: {
        sentiment: 0,
        urgency: 100,
        followerCount: 0,
        engagement: 0,
        accountTier: 0,
      },
    };

    const result = calculatePriorityScore({
      analysis: { ...baseAnalysis, urgency: "critical" },
      item: fakeItem,
      senderTier: "ENTERPRISE",
      senderFollowers: 1_000_000,
      settings: customSettings,
    });

    // Only urgency should contribute: (100 * 100) / 100 = 100
    expect(result.factors.urgency).toBe(100);
    expect(result.factors.sentiment).toBe(0);
    expect(result.factors.followerCount).toBe(0);
    expect(result.factors.accountTier).toBe(0);
  });

  it("should return factors object with all keys", () => {
    const result = calculatePriorityScore({
      analysis: baseAnalysis,
      item: fakeItem,
      settings: defaultSettings,
    });

    expect(result.factors).toHaveProperty("sentiment");
    expect(result.factors).toHaveProperty("urgency");
    expect(result.factors).toHaveProperty("followerCount");
    expect(result.factors).toHaveProperty("accountTier");
  });
});
