import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    postPerformance: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    appliedBoost: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import type { PostType } from "@/generated/prisma";

import {
  analyzeEngagementVelocity,
  calculateBoostScore,
  predictROI,
} from "./scoring";

describe("boost-detector/scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateBoostScore", () => {
    it("should throw when no performance data found", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue(null);

      await expect(
        calculateBoostScore("post-1", "SOCIAL_POST" as PostType, "ws-1"),
      ).rejects.toThrow("No performance data found");
    });

    it("should calculate score from performance metrics", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue({
        engagementVelocity: 5,
        engagementRate: 0.05,
        conversions: 2,
      });
      mockPrisma.postPerformance.aggregate.mockResolvedValue({
        _avg: { engagementRate: 0.03 },
      });

      const result = await calculateBoostScore("post-1", "SOCIAL_POST" as PostType, "ws-1");

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveProperty("engagementVelocity");
      expect(result.factors).toHaveProperty("audienceMatch");
      expect(result.factors).toHaveProperty("contentType");
      expect(result.factors).toHaveProperty("timing");
      expect(result.trigger).toBe("HIGH_ENGAGEMENT");
    });

    it("should detect viral velocity trigger", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue({
        engagementVelocity: 60,
        engagementRate: 0.1,
        conversions: 5,
      });
      mockPrisma.postPerformance.aggregate.mockResolvedValue({
        _avg: { engagementRate: 0.03 },
      });

      const result = await calculateBoostScore("post-1", "SOCIAL_POST" as PostType, "ws-1");
      expect(result.trigger).toBe("VIRAL_VELOCITY");
    });

    it("should detect conversion spike trigger", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue({
        engagementVelocity: 3,
        engagementRate: 0.04,
        conversions: 15,
      });
      mockPrisma.postPerformance.aggregate.mockResolvedValue({
        _avg: { engagementRate: 0.03 },
      });

      const result = await calculateBoostScore("post-1", "SOCIAL_POST" as PostType, "ws-1");
      expect(result.trigger).toBe("CONVERSION_SPIKE");
    });

    it("should use default engagement rate when no workspace average", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue({
        engagementVelocity: 5,
        engagementRate: 0.05,
        conversions: 0,
      });
      mockPrisma.postPerformance.aggregate.mockResolvedValue({
        _avg: { engagementRate: null },
      });

      const result = await calculateBoostScore("post-1", "SOCIAL_POST" as PostType, "ws-1");
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe("predictROI", () => {
    const basePerformance = {
      id: "perf-1",
      postId: "post-1",
      postType: "SOCIAL_POST" as PostType,
      workspaceId: "ws-1",
      engagementRate: 0.05,
      engagementVelocity: 5,
      impressions: 1000,
      engagementCount: 50,
      clicks: 50,
      conversions: 5,
      shares: 10,
      likes: 100,
      comments: 20,
      saves: 5,
      checkedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as import("@/generated/prisma").PostPerformance;

    it("should use industry averages when no historical data", async () => {
      mockPrisma.appliedBoost.findMany.mockResolvedValue([]);

      const result = await predictROI(basePerformance, 100, "FACEBOOK");

      expect(result.confidenceScore).toBe(0.3);
      expect(result.estimatedCost).toBe(100);
      expect(result.estimatedImpressions).toBeGreaterThan(0);
      expect(result.estimatedClicks).toBeGreaterThan(0);
    });

    it("should use historical data when available", async () => {
      mockPrisma.appliedBoost.findMany.mockResolvedValue([
        {
          actualImpressions: 5000,
          actualClicks: 100,
          actualConversions: 10,
          actualSpend: 50,
        },
        {
          actualImpressions: 8000,
          actualClicks: 200,
          actualConversions: 15,
          actualSpend: 80,
        },
      ]);

      const result = await predictROI(basePerformance, 200, "GOOGLE_ADS");

      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.estimatedCost).toBe(200);
      expect(result.estimatedImpressions).toBeGreaterThan(0);
    });

    it("should have higher confidence with more historical campaigns", async () => {
      const campaigns = Array.from({ length: 15 }, () => ({
        actualImpressions: 5000,
        actualClicks: 100,
        actualConversions: 10,
        actualSpend: 50,
      }));
      mockPrisma.appliedBoost.findMany.mockResolvedValue(campaigns);

      const result = await predictROI(basePerformance, 100, "FACEBOOK");

      // Max confidence at 10+ campaigns = 1.0
      expect(result.confidenceScore).toBe(1.0);
    });
  });

  describe("analyzeEngagementVelocity", () => {
    it("should return 0 when no performance data", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue(null);
      expect(await analyzeEngagementVelocity("post-1")).toBe(0);
    });

    it("should return stored velocity", async () => {
      mockPrisma.postPerformance.findFirst.mockResolvedValue({
        engagementVelocity: 12.5,
      });
      expect(await analyzeEngagementVelocity("post-1")).toBe(12.5);
    });
  });
});
