import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockServer, createMockAdsClient } from "../__test-utils__/index.js";
import type { MockMcpServer } from "../__test-utils__/index.js";
import {
  registerCampaignTools,
  microsToCurrency,
  currencyToMicros,
} from "../../../src/mcp-tools/google-ads/mcp/campaigns.js";
import type { GoogleAdsClient } from "../../../src/mcp-tools/google-ads/core-logic/ads-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("campaign tools", () => {
  let server: MockMcpServer;
  let mockClient: ReturnType<typeof createMockAdsClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    mockClient = createMockAdsClient();
    registerCampaignTools(server as unknown as McpServer, mockClient as unknown as GoogleAdsClient);
  });

  it("registers all four campaign tools", () => {
    expect(server.tool).toHaveBeenCalledTimes(4);
    const toolNames = server.tool.mock.calls.map((c: unknown[]) => c[0]);
    expect(toolNames).toContain("ads_list_campaigns");
    expect(toolNames).toContain("ads_create_campaign");
    expect(toolNames).toContain("ads_update_campaign");
    expect(toolNames).toContain("ads_list_ad_groups");
  });

  describe("ads_list_campaigns", () => {
    it("returns campaigns from search results", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          campaign: {
            id: "123",
            name: "Test Campaign",
            status: "ENABLED",
            advertisingChannelType: "SEARCH",
          },
          campaignBudget: { amountMicros: "50000000" },
          metrics: { impressions: "1000", clicks: "50", costMicros: "25000000" },
        },
      ]);

      const result = await server.call("ads_list_campaigns", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.campaigns[0].name).toBe("Test Campaign");
      expect(parsed.campaigns[0].budget).toBe(50);
      expect(parsed.campaigns[0].cost).toBe(25);
    });

    it("filters by status when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_list_campaigns", { status: "PAUSED" });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("WHERE campaign.status = 'PAUSED'");
    });

    it("applies limit when provided", async () => {
      mockClient.search = vi.fn().mockResolvedValue([]);
      await server.call("ads_list_campaigns", { limit: 10 });
      const query = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain("LIMIT 10");
    });

    it("handles API errors", async () => {
      mockClient.search = vi.fn().mockRejectedValue(new Error("API quota exceeded"));
      const result = await server.call("ads_list_campaigns", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API_ERROR");
      expect(result.content[0].text).toContain("**Retryable:** true");
    });
  });

  describe("ads_create_campaign", () => {
    it("calls mutate with campaign and budget operations", async () => {
      mockClient.mutate = vi.fn().mockResolvedValue({ mutateOperationResponses: [] });
      const result = await server.call("ads_create_campaign", {
        name: "New Campaign",
        budget_amount: 100,
        bidding_strategy: "MAXIMIZE_CLICKS",
        channel_type: "SEARCH",
        status: "PAUSED",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(mockClient.mutate).toHaveBeenCalledTimes(1);
      const ops = (mockClient.mutate as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown[];
      expect(ops).toHaveLength(2);
    });

    it("handles mutate errors", async () => {
      mockClient.mutate = vi.fn().mockRejectedValue(new Error("Permission denied"));
      const result = await server.call("ads_create_campaign", {
        name: "Test",
        budget_amount: 50,
        bidding_strategy: "MANUAL_CPC",
        channel_type: "DISPLAY",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("ads_update_campaign", () => {
    it("updates campaign status", async () => {
      mockClient.mutate = vi.fn().mockResolvedValue({ mutateOperationResponses: [] });
      const result = await server.call("ads_update_campaign", {
        campaign_id: "123",
        status: "ENABLED",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it("returns error when no fields provided", async () => {
      const result = await server.call("ads_update_campaign", {
        campaign_id: "123",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("INVALID_INPUT");
    });

    it("updates budget when budget_amount provided", async () => {
      mockClient.search = vi
        .fn()
        .mockResolvedValue([
          { campaignBudget: { resourceName: "customers/123/campaignBudgets/456" } },
        ]);
      mockClient.mutate = vi.fn().mockResolvedValue({ mutateOperationResponses: [] });
      const result = await server.call("ads_update_campaign", {
        campaign_id: "789",
        budget_amount: 75,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });
  });

  describe("ads_list_ad_groups", () => {
    it("returns ad groups for a campaign", async () => {
      mockClient.search = vi.fn().mockResolvedValue([
        {
          adGroup: { id: "ag1", name: "Ad Group 1", status: "ENABLED" },
          metrics: { impressions: "500", clicks: "25" },
        },
      ]);
      const result = await server.call("ads_list_ad_groups", { campaign_id: "123" });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.campaign_id).toBe("123");
      expect(parsed.count).toBe(1);
      expect(parsed.ad_groups[0].name).toBe("Ad Group 1");
    });
  });

  describe("currency conversions", () => {
    it("converts micros to currency", () => {
      expect(microsToCurrency(1_000_000)).toBe(1);
      expect(microsToCurrency(50_000_000)).toBe(50);
      expect(microsToCurrency(1_500_000)).toBe(1.5);
    });

    it("converts currency to micros", () => {
      expect(currencyToMicros(1)).toBe(1_000_000);
      expect(currencyToMicros(50)).toBe(50_000_000);
      expect(currencyToMicros(1.5)).toBe(1_500_000);
    });
  });
});
