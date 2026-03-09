import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockServer, createMockAdsClient } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { registerKeywordTools } from "../../../src/mcp-tools/google-ads/mcp/keywords.js";
import type { GoogleAdsClient } from "../../../src/mcp-tools/google-ads/core-logic/ads-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("keyword tools", () => {
  let server: MockMcpServer;
  let mockClient: ReturnType<typeof createMockAdsClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    mockClient = createMockAdsClient();
    registerKeywordTools(server as unknown as McpServer, mockClient as unknown as GoogleAdsClient);
  });

  it("registers both keyword tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(2);
    const toolNames = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(toolNames).toContain("ads_keyword_performance");
    expect(toolNames).toContain("ads_audience_insights");
  });

  describe("ads_keyword_performance", () => {
    it("returns keyword metrics", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          adGroupCriterion: {
            keyword: { text: "running shoes", matchType: "BROAD" },
            qualityInfo: { qualityScore: 8 },
          },
          metrics: { impressions: "1000", clicks: "50", costMicros: "25000000", conversions: "5" },
        },
      ]);

      const result = await server.call("ads_keyword_performance", {
        date_range: "LAST_7_DAYS",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.keywords[0].keyword).toBe("running shoes");
      expect(parsed.keywords[0].quality_score).toBe(8);
      expect(parsed.keywords[0].cost).toBe(25);
    });

    it("filters by campaign_id when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_keyword_performance", {
        campaign_id: "111",
        date_range: "LAST_30_DAYS",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("campaign.id = 111");
    });

    it("filters by ad_group_id when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_keyword_performance", {
        ad_group_id: "222",
        date_range: "YESTERDAY",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("ad_group.id = 222");
    });

    it("handles missing quality score", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          adGroupCriterion: { keyword: { text: "test", matchType: "EXACT" } },
          metrics: { impressions: "10", clicks: "1", costMicros: "500000", conversions: "0" },
        },
      ]);

      const result = await server.call("ads_keyword_performance", {
        date_range: "TODAY",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.keywords[0].quality_score).toBeNull();
    });

    it("handles API errors", async () => {
      mockClient.search = vi.fn().mockRejectedValue(new Error("Service unavailable"));
      const result = await server.call("ads_keyword_performance", {
        date_range: "LAST_7_DAYS",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API_ERROR");
    });
  });

  describe("ads_audience_insights", () => {
    it("returns gender and age range data", async () => {
      mockClient.search = vi
        .fn()
        .mockResolvedValueOnce([
          {
            genderView: { resourceName: "customers/123/genderViews/MALE" },
            metrics: { impressions: "5000", clicks: "200" },
          },
        ])
        .mockResolvedValueOnce([
          {
            ageRangeView: { resourceName: "customers/123/ageRangeViews/AGE_RANGE_25_34" },
            metrics: { impressions: "3000", clicks: "150" },
          },
        ]);

      const result = await server.call("ads_audience_insights", {
        date_range: "LAST_30_DAYS",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.gender).toHaveLength(1);
      expect(parsed.age_ranges).toHaveLength(1);
      expect(parsed.gender[0].impressions).toBe(5000);
      expect(parsed.age_ranges[0].impressions).toBe(3000);
    });

    it("filters by campaign_id when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_audience_insights", {
        campaign_id: "789",
        date_range: "THIS_MONTH",
      });
      const calls = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain("campaign.id = 789");
      expect(calls[1][0]).toContain("campaign.id = 789");
    });

    it("handles gender query error", async () => {
      mockClient.search = vi.fn().mockRejectedValue(new Error("Rate limited"));
      const result = await server.call("ads_audience_insights", {
        date_range: "LAST_7_DAYS",
      });
      expect(result.isError).toBe(true);
    });

    it("handles age query error", async () => {
      mockClient.search = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("Age query failed"));
      const result = await server.call("ads_audience_insights", {
        date_range: "LAST_MONTH",
      });
      expect(result.isError).toBe(true);
    });
  });
});
