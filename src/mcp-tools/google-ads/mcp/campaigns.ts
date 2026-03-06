/**
 * Campaign management tools: list, create, update campaigns + list ad groups.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { GoogleAdsClient } from "../core-logic/ads-client.js";

function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}

function currencyToMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}

interface CampaignRow {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
  };
  campaignBudget?: {
    amountMicros?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
  };
}

interface AdGroupRow {
  adGroup?: {
    id?: string;
    name?: string;
    status?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
  };
}

export function registerCampaignTools(server: McpServer, client: GoogleAdsClient): void {
  createZodTool(server, {
    name: "ads_list_campaigns",
    description: "List all Google Ads campaigns with budget and performance metrics",
    schema: {
      status: z.enum(["ENABLED", "PAUSED", "REMOVED"]).optional().describe("Filter by campaign status"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max campaigns to return"),
    },
    async handler({ status, limit }) {
      let query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign`;
      if (status) {
        query += ` WHERE campaign.status = '${status}'`;
      }
      query += ` ORDER BY campaign.name`;
      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const result = await tryCatch(client.search(query));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }

      const campaigns = (result.data as CampaignRow[]).map((row) => ({
        id: row.campaign?.id,
        name: row.campaign?.name,
        status: row.campaign?.status,
        channel_type: row.campaign?.advertisingChannelType,
        budget: row.campaignBudget?.amountMicros
          ? microsToCurrency(Number(row.campaignBudget.amountMicros))
          : null,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        cost: row.metrics?.costMicros
          ? microsToCurrency(Number(row.metrics.costMicros))
          : 0,
      }));

      return jsonResult({ count: campaigns.length, campaigns });
    },
  });

  createZodTool(server, {
    name: "ads_create_campaign",
    description: "Create a new Google Ads campaign with budget and bidding strategy",
    schema: {
      name: z.string().describe("Campaign name"),
      budget_amount: z.number().positive().describe("Daily budget in currency units (e.g. 50.00)"),
      bidding_strategy: z.enum([
        "MAXIMIZE_CLICKS",
        "MAXIMIZE_CONVERSIONS",
        "TARGET_CPA",
        "TARGET_ROAS",
        "MANUAL_CPC",
      ]).describe("Bidding strategy type"),
      channel_type: z.enum(["SEARCH", "DISPLAY", "SHOPPING", "VIDEO"]).describe("Advertising channel type"),
      status: z.enum(["ENABLED", "PAUSED"]).default("PAUSED").describe("Initial campaign status"),
    },
    async handler({ name, budget_amount: budgetAmount, bidding_strategy: biddingStrategy, channel_type: channelType, status }) {
      const resolvedStatus = String(status ?? "PAUSED");

      const operations = [
        {
          campaignBudgetOperation: {
            create: {
              name: `${name} Budget`,
              amountMicros: String(currencyToMicros(budgetAmount)),
              deliveryMethod: "STANDARD",
            },
          },
        },
        {
          campaignOperation: {
            create: {
              name,
              status: resolvedStatus,
              advertisingChannelType: channelType,
              [`${camelCase(String(biddingStrategy))}`]: {},
            },
          },
        },
      ];

      const result = await tryCatch(client.mutate(operations));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }
      return jsonResult({ success: true, result: result.data });
    },
  });

  createZodTool(server, {
    name: "ads_update_campaign",
    description: "Update an existing Google Ads campaign status or budget",
    schema: {
      campaign_id: z.string().describe("Campaign ID to update"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New campaign status"),
      budget_amount: z.number().positive().optional().describe("New daily budget in currency units"),
    },
    async handler({ campaign_id, status, budget_amount: budgetAmount }) {
      const campaignId = String(campaign_id);

      const operations: unknown[] = [];

      if (status) {
        operations.push({
          campaignOperation: {
            update: {
              resourceName: `customers/${client.getCustomerId()}/campaigns/${campaignId}`,
              status,
            },
            updateMask: "status",
          },
        });
      }

      if (budgetAmount !== undefined) {
        // First get current budget resource name
        const budgetQuery = `SELECT campaign_budget.resource_name FROM campaign WHERE campaign.id = ${campaignId}`;
        const budgetResult = await tryCatch(client.search(budgetQuery));
        if (!budgetResult.ok) {
          return errorResult("API_ERROR", budgetResult.error.message, true);
        }
        const rows = budgetResult.data as Array<{ campaignBudget?: { resourceName?: string } }>;
        const budgetResource = rows[0]?.campaignBudget?.resourceName;
        if (budgetResource) {
          operations.push({
            campaignBudgetOperation: {
              update: {
                resourceName: budgetResource,
                amountMicros: String(currencyToMicros(budgetAmount)),
              },
              updateMask: "amount_micros",
            },
          });
        }
      }

      if (operations.length === 0) {
        return errorResult("INVALID_INPUT", "No update fields provided", false);
      }

      const result = await tryCatch(client.mutate(operations));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }
      return jsonResult({ success: true, result: result.data });
    },
  });

  createZodTool(server, {
    name: "ads_list_ad_groups",
    description: "List ad groups for a specific Google Ads campaign",
    schema: {
      campaign_id: z.string().describe("Campaign ID to list ad groups for"),
    },
    async handler({ campaign_id }) {
      const campaignId = String(campaign_id);
      const query = `SELECT ad_group.id, ad_group.name, ad_group.status, metrics.impressions, metrics.clicks FROM ad_group WHERE campaign.id = ${campaignId} ORDER BY ad_group.name`;

      const result = await tryCatch(client.search(query));
      if (!result.ok) {
        return errorResult("API_ERROR", result.error.message, true);
      }

      const adGroups = (result.data as AdGroupRow[]).map((row) => ({
        id: row.adGroup?.id,
        name: row.adGroup?.name,
        status: row.adGroup?.status,
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
      }));

      return jsonResult({ campaign_id: campaignId, count: adGroups.length, ad_groups: adGroups });
    },
  });
}

// Expose for testing
export { microsToCurrency, currencyToMicros };

function camelCase(screaming: string): string {
  return screaming
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

