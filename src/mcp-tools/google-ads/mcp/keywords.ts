/**
 * Keyword and audience insight tools.
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

interface KeywordRow {
  adGroupCriterion?: {
    keyword?: {
      text?: string;
      matchType?: string;
    };
    qualityInfo?: {
      qualityScore?: number;
    };
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: string;
  };
}

interface GenderRow {
  genderView?: { resourceName?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
  };
}

interface AgeRow {
  ageRangeView?: { resourceName?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
  };
}

export function registerKeywordTools(server: McpServer, client: GoogleAdsClient): void {
  createZodTool(server, {
    name: "ads_keyword_performance",
    description: "Get keyword-level performance metrics including quality score",
    schema: {
      campaign_id: z.string().optional().describe("Filter by campaign ID"),
      ad_group_id: z.string().optional().describe("Filter by ad group ID"),
      date_range: DATE_RANGE,
      limit: z.number().int().min(1).max(500).default(50).describe("Max results to return"),
    },
    async handler({ campaign_id: campaignId, ad_group_id: adGroupId, date_range, limit = 50 }) {
      const dateRange = String(date_range);

      const conditions = [`segments.date DURING ${dateRange}`];
      if (campaignId) conditions.push(`campaign.id = ${campaignId}`);
      if (adGroupId) conditions.push(`ad_group.id = ${adGroupId}`);

      const query = `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE ${conditions.join(" AND ")} ORDER BY metrics.impressions DESC LIMIT ${limit}`;

      const result = await tryCatch(client.search(query));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }

      const keywords = (result.data as KeywordRow[]).map((row) => ({
        keyword: row.adGroupCriterion?.keyword?.text,
        match_type: row.adGroupCriterion?.keyword?.matchType,
        quality_score: row.adGroupCriterion?.qualityInfo?.qualityScore ?? null,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        cost: row.metrics?.costMicros
          ? microsToCurrency(Number(row.metrics.costMicros))
          : 0,
        conversions: Number(row.metrics?.conversions ?? 0),
      }));

      return jsonResult({ date_range: dateRange, count: keywords.length, keywords });
    },
  });

  createZodTool(server, {
    name: "ads_audience_insights",
    description: "Get audience demographic insights (gender and age range breakdown)",
    schema: {
      campaign_id: z.string().optional().describe("Filter by campaign ID"),
      date_range: DATE_RANGE,
    },
    async handler({ campaign_id: campaignId, date_range }) {
      const dateRange = String(date_range);

      const campaignFilter = campaignId ? ` AND campaign.id = ${campaignId}` : "";

      const genderQuery = `SELECT gender_view.resource_name, metrics.impressions, metrics.clicks FROM gender_view WHERE segments.date DURING ${dateRange}${campaignFilter}`;
      const ageQuery = `SELECT age_range_view.resource_name, metrics.impressions, metrics.clicks FROM age_range_view WHERE segments.date DURING ${dateRange}${campaignFilter}`;

      const [genderResult, ageResult] = await Promise.all([
        tryCatch(client.search(genderQuery)),
        tryCatch(client.search(ageQuery)),
      ]);

      if (!genderResult.ok) {
        return errorResult("API_ERROR", genderResult.error.message, true);
      }
      if (!ageResult.ok) {
        return errorResult("API_ERROR", ageResult.error.message, true);
      }

      const genderData = (genderResult.data as GenderRow[]).map((row) => ({
        resource: row.genderView?.resourceName,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
      }));

      const ageData = (ageResult.data as AgeRow[]).map((row) => ({
        resource: row.ageRangeView?.resourceName,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
      }));

      return jsonResult({
        date_range: dateRange,
        gender: genderData,
        age_ranges: ageData,
      });
    },
  });
}
