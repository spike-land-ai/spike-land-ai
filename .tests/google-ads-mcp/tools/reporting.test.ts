import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockServer, createMockAdsClient } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import { registerReportingTools } from "../../../src/mcp-tools/google-ads/mcp/reporting.js";
import type { GoogleAdsClient } from "../../../src/mcp-tools/google-ads/core-logic/ads-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("reporting tools", () => {
  let server: MockMcpServer;
  let mockClient: ReturnType<typeof createMockAdsClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    mockClient = createMockAdsClient();
    registerReportingTools(
      server as unknown as McpServer,
      mockClient as unknown as GoogleAdsClient,
    );
  });

  it("registers both reporting tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(2);
    const toolNames = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(toolNames).toContain("ads_campaign_performance");
    expect(toolNames).toContain("ads_search_terms_report");
  });

  describe("ads_campaign_performance", () => {
    it("returns performance metrics", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          campaign: { name: "Campaign 1" },
          metrics: {
            impressions: "10000",
            clicks: "500",
            ctr: "0.05",
            averageCpc: "0.50",
            costMicros: "250000000",
            conversions: "10",
            conversionsValue: "500",
            costPerConversion: "25",
          },
        },
      ]);

      const result = await server.call("ads_campaign_performance", {
        campaign_id: "123",
        date_range: "LAST_7_DAYS",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.campaign_id).toBe("123");
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].impressions).toBe(10000);
      expect(parsed.rows[0].cost).toBe(250);
    });

    it("includes date segment in query when requested", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_campaign_performance", {
        campaign_id: "123",
        date_range: "LAST_30_DAYS",
        segments: "date",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("segments.date");
      expect(query).toContain("LAST_30_DAYS");
    });

    it("includes device segment in query when requested", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_campaign_performance", {
        campaign_id: "123",
        date_range: "YESTERDAY",
        segments: "device",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("segments.device");
    });

    it("includes network segment in query when requested", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_campaign_performance", {
        campaign_id: "123",
        date_range: "TODAY",
        segments: "network",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("segments.ad_network_type");
    });

    it("handles API errors", async () => {
      mockClient.search = vi.fn().mockRejectedValue(new Error("Timeout"));
      const result = await server.call("ads_campaign_performance", {
        campaign_id: "123",
        date_range: "LAST_7_DAYS",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API_ERROR");
    });
  });

  describe("ads_search_terms_report", () => {
    it("returns search terms with metrics", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          searchTermView: { searchTerm: "buy shoes online" },
          metrics: { impressions: "500", clicks: "20", costMicros: "10000000", conversions: "2" },
        },
      ]);

      const result = await server.call("ads_search_terms_report", {
        date_range: "LAST_7_DAYS",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.terms[0].search_term).toBe("buy shoes online");
      expect(parsed.terms[0].cost).toBe(10);
    });

    it("filters by campaign_id when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_search_terms_report", {
        campaign_id: "456",
        date_range: "LAST_30_DAYS",
        limit: 25,
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("campaign.id = 456");
      expect(query).toContain("LIMIT 25");
    });

    it("uses default limit of 50", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_search_terms_report", {
        date_range: "TODAY",
      });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("LIMIT 50");
    });

    it("handles API errors", async () => {
      mockClient.search = vi.fn().mockRejectedValue(new Error("Auth failed"));
      const result = await server.call("ads_search_terms_report", {
        date_range: "YESTERDAY",
      });
      expect(result.isError).toBe(true);
    });
  });
});
