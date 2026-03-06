/**
 * Reporting tools: campaign performance and search terms report.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { GoogleAdsClient } from "../core-logic/ads-client.js";

const DATE_RANGE = z.enum([
  "TODAY",
  "YESTERDAY",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
]).describe("Date range for the report");

function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}

interface PerformanceRow {
  campaign?: { name?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    ctr?: string;
    averageCpc?: string;
    costMicros?: string;
    conversions?: string;
    conversionsValue?: string;
    costPerConversion?: string;
  };
  segments?: {
    date?: string;
    device?: string;
    adNetworkType?: string;
  };
}

interface SearchTermRow {
  searchTermView?: { searchTerm?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: string;
  };
}

export function registerReportingTools(server: McpServer, client: GoogleAdsClient): void {
  createZodTool(server, {
    name: "ads_campaign_performance",
    description: "Get detailed campaign performance metrics with optional segmentation by date, device, or network",
    schema: {
      campaign_id: z.string().describe("Campaign ID to report on"),
      date_range: DATE_RANGE,
      segments: z.enum(["date", "device", "network"]).optional().describe("Segment results by date, device, or network"),
    },
    async handler({ campaign_id, date_range, segments }) {
      const campaignId = String(campaign_id);
      const dateRange = String(date_range);

      let segmentField = "";
      if (segments === "date") segmentField = ", segments.date";
      else if (segments === "device") segmentField = ", segments.device";
      else if (segments === "network") segmentField = ", segments.ad_network_type";

      const query = `SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.cost_per_conversion${segmentField} FROM campaign WHERE campaign.id = ${campaignId} AND segments.date DURING ${dateRange}`;

      const result = await tryCatch(client.search(query));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }

      const rows = (result.data as PerformanceRow[]).map((row) => ({
        campaign_name: row.campaign?.name,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        ctr: Number(row.metrics?.ctr ?? 0),
        average_cpc: Number(row.metrics?.averageCpc ?? 0),
        cost: row.metrics?.costMicros
          ? microsToCurrency(Number(row.metrics.costMicros))
          : 0,
        conversions: Number(row.metrics?.conversions ?? 0),
        conversions_value: Number(row.metrics?.conversionsValue ?? 0),
        cost_per_conversion: Number(row.metrics?.costPerConversion ?? 0),
        ...(segments === "date" && { date: row.segments?.date }),
        ...(segments === "device" && { device: row.segments?.device }),
        ...(segments === "network" && { network: row.segments?.adNetworkType }),
      }));

      return jsonResult({ campaign_id: campaignId, date_range: dateRange, rows });
    },
  });

  createZodTool(server, {
    name: "ads_search_terms_report",
    description: "Get search terms that triggered your ads with performance metrics",
    schema: {
      campaign_id: z.string().optional().describe("Filter by campaign ID"),
      date_range: DATE_RANGE,
      limit: z.number().int().min(1).max(500).default(50).describe("Max results to return"),
    },
    async handler({ campaign_id: campaignId, date_range, limit = 50 }) {
      const dateRange = String(date_range);

      let query = `SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date DURING ${dateRange}`;
      if (campaignId) {
        query += ` AND campaign.id = ${campaignId}`;
      }
      query += ` ORDER BY metrics.impressions DESC LIMIT ${limit}`;

      const result = await tryCatch(client.search(query));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }

      const terms = (result.data as SearchTermRow[]).map((row) => ({
        search_term: row.searchTermView?.searchTerm,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        cost: row.metrics?.costMicros
          ? microsToCurrency(Number(row.metrics.costMicros))
          : 0,
        conversions: Number(row.metrics?.conversions ?? 0),
      }));

      return jsonResult({ date_range: dateRange, count: terms.length, terms });
    },
  });
}
