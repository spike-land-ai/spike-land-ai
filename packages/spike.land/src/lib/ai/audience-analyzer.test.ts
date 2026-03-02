import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();
const mockGetGeminiClient = vi.fn();
const mockIsGeminiConfigured = vi.fn();

vi.mock("./gemini-client", () => ({
  getGeminiClient: (...args: unknown[]) => mockGetGeminiClient(...args),
  isGeminiConfigured: (...args: unknown[]) => mockIsGeminiConfigured(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { analyzeAudience, type AudienceAnalysisInput, recommendBudget } from "./audience-analyzer";

describe("audience-analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInput: AudienceAnalysisInput = {
    audienceSize: 50_000,
    platform: "Instagram",
  };

  // ===========================================================================
  // analyzeAudience
  // ===========================================================================

  describe("analyzeAudience", () => {
    it("should return heuristic insight when Gemini is not configured", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toContain("Heuristic analysis");
      expect(result.summary).toContain("Instagram");
      expect(result.summary).toContain("50,000");
      expect(result.confidence).toBe(0.4);
      expect(result.demographics.ageRanges).toBeDefined();
      expect(result.interests.categories).toBeDefined();
      expect(result.recommendations).toHaveLength(3);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should return heuristic insight when isGeminiConfigured rejects", async () => {
      mockIsGeminiConfigured.mockRejectedValue(new Error("config error"));

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toContain("Heuristic analysis");
      expect(result.confidence).toBe(0.4);
    });

    it("should call Gemini and parse structured response when configured", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });

      const geminiResponse = {
        summary: "AI-generated summary",
        demographics: {
          ageRanges: { "18-24": 0.4, "25-34": 0.35 },
          genderSplit: { male: 0.5, female: 0.5 },
          topRegions: [{ region: "US", share: 0.6 }],
          primaryLanguages: ["English", "Spanish"],
        },
        interests: {
          categories: ["Fashion", "Lifestyle"],
          peakEngagementWindows: ["Evenings"],
          deviceSplit: { mobile: 0.8, desktop: 0.2 },
        },
        recommendations: ["Post more reels"],
        confidence: 0.85,
      };

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(geminiResponse),
      });

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toBe("AI-generated summary");
      expect(result.confidence).toBe(0.85);
      expect(result.demographics.primaryLanguages).toEqual(["English", "Spanish"]);
      expect(result.interests.categories).toEqual(["Fashion", "Lifestyle"]);
      expect(result.recommendations).toEqual(["Post more reels"]);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it("should fall back to heuristic on empty Gemini response", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockResolvedValue({ text: "" });

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toContain("Heuristic analysis");
      expect(result.confidence).toBe(0.4);
    });

    it("should fall back to heuristic when Gemini throws", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockRejectedValue(new Error("API limit exceeded"));

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toContain("Heuristic analysis");
      expect(result.confidence).toBe(0.4);
    });

    it("should merge partial Gemini response with heuristic defaults", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });

      // Only summary and confidence — everything else should be filled from heuristic
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ summary: "Partial insight", confidence: 0.6 }),
      });

      const result = await analyzeAudience(baseInput);

      expect(result.summary).toBe("Partial insight");
      expect(result.confidence).toBe(0.6);
      // Demographics should come from heuristic fallback
      expect(Object.keys(result.demographics.ageRanges).length).toBeGreaterThan(0);
      expect(result.recommendations).toHaveLength(3); // heuristic default
    });

    it("should clamp confidence to 0-1 range", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ confidence: 5.0 }),
      });

      const result = await analyzeAudience(baseInput);
      expect(result.confidence).toBe(1);
    });

    it("should use linkedin-specific demographics for linkedin platform", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await analyzeAudience({
        audienceSize: 10_000,
        platform: "LinkedIn",
      });

      expect(result.demographics.ageRanges["25-34"]).toBe(0.33);
      expect(result.demographics.ageRanges["35-54"]).toBe(0.39);
    });

    it("should use tiktok-specific demographics for tiktok platform", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await analyzeAudience({
        audienceSize: 10_000,
        platform: "TikTok",
      });

      expect(result.demographics.ageRanges["18-24"]).toBe(0.42);
    });

    it("should use pinterest-specific gender split", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await analyzeAudience({
        audienceSize: 10_000,
        platform: "Pinterest",
      });

      expect(result.demographics.genderSplit.female).toBe(0.76);
    });

    it("should include industry in interests categories when provided", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await analyzeAudience({
        audienceSize: 10_000,
        platform: "Twitter",
        industry: "Fintech",
      });

      expect(result.interests.categories).toContain("Fintech");
    });

    it("should include all optional fields in the Gemini prompt", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ summary: "Full prompt test" }),
      });

      await analyzeAudience({
        audienceSize: 100_000,
        platform: "Instagram",
        industry: "Fashion",
        engagementRate: 0.035,
        topContentTypes: ["Reels", "Stories"],
        knownDemographics: { primaryLanguages: ["English"] },
      });

      const call = mockGenerateContent.mock.calls[0] as Array<{
        contents: Array<{ parts: Array<{ text: string }> }>;
      }>;
      const prompt = call[0]!.contents[0]!.parts[0]!.text;
      expect(prompt).toContain("Fashion");
      expect(prompt).toContain("3.50%");
      expect(prompt).toContain("Reels");
      expect(prompt).toContain("English");
    });
  });

  // ===========================================================================
  // recommendBudget
  // ===========================================================================

  describe("recommendBudget", () => {
    it("should return budget recommendation with known platform CPMs", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(50_000, "INSTAGRAM");

      expect(result.estimatedCpmUsd).toBe(7.91);
      expect(result.estimatedCpcUsd).toBe(1.28);
      expect(result.dailyBudgetUsd).toBeGreaterThan(0);
      expect(result.totalCampaignBudgetUsd).toBeGreaterThan(0);
      expect(result.estimatedReach).toBeGreaterThan(0);
      expect(result.recommendedDurationDays).toBe(30);
      expect(result.confidence).toBe("medium");
      expect(result.rationale).toContain("INSTAGRAM");
    });

    it("should use fallback CPM for unknown platforms", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(10_000, "mastodon");

      expect(result.estimatedCpmUsd).toBe(8.0); // default
      expect(result.estimatedCpcUsd).toBe(1.0); // default
    });

    it("should return low confidence for small audiences (<1000)", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(500, "TWITTER");

      expect(result.confidence).toBe("low");
    });

    it("should return medium confidence for mid-size audiences", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(50_000, "TWITTER");

      expect(result.confidence).toBe("medium");
    });

    it("should return high confidence for large audiences (>=100000)", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(200_000, "TWITTER");

      expect(result.confidence).toBe("high");
    });

    it("should respect custom duration", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(10_000, "FACEBOOK", undefined, 7);

      expect(result.recommendedDurationDays).toBe(7);
      // total should be daily * 7
      expect(result.totalCampaignBudgetUsd).toBeCloseTo(result.dailyBudgetUsd * 7, 1);
    });

    it("should include campaign goal in heuristic rationale", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(10_000, "TWITTER", "brand awareness");

      expect(result.rationale).toContain("brand awareness");
    });

    it("should use AI rationale when Gemini is configured", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockResolvedValue({
        text: "AI-powered budget advice for your campaign.",
      });

      const result = await recommendBudget(50_000, "INSTAGRAM");

      expect(result.rationale).toBe("AI-powered budget advice for your campaign.");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it("should fall back to heuristic rationale when Gemini returns empty text", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockResolvedValue({ text: "" });

      const result = await recommendBudget(50_000, "INSTAGRAM");

      expect(result.rationale).toContain("CPM benchmarks");
    });

    it("should fall back to heuristic rationale when Gemini throws", async () => {
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetGeminiClient.mockResolvedValue({
        models: {
          generateContent: mockGenerateContent,
        },
      });
      mockGenerateContent.mockRejectedValue(new Error("API error"));

      const result = await recommendBudget(50_000, "INSTAGRAM");

      expect(result.rationale).toContain("CPM benchmarks");
    });

    it("should use LinkedIn CPM benchmarks", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(10_000, "LinkedIn");

      expect(result.estimatedCpmUsd).toBe(33.8);
      expect(result.estimatedCpcUsd).toBe(5.26);
    });

    it("should round budget values to 2 decimal places", async () => {
      mockIsGeminiConfigured.mockResolvedValue(false);

      const result = await recommendBudget(12_345, "TWITTER");

      // Check rounding: value * 100 should be integer
      expect(result.dailyBudgetUsd * 100).toBe(Math.round(result.dailyBudgetUsd * 100));
      expect(result.totalCampaignBudgetUsd * 100).toBe(
        Math.round(result.totalCampaignBudgetUsd * 100),
      );
    });
  });
});
