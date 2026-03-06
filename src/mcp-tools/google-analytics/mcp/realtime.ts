/**
 * ga4_realtime_report — GA4 realtime reporting tool.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { GoogleAuthClient } from "../core-logic/google-oauth.js";

export function registerRealtimeTool(
  server: McpServer,
  auth: GoogleAuthClient,
  propertyId: string,
): void {
  createZodTool(server, {
    name: "ga4_realtime_report",
    description:
      "Run a GA4 realtime report. Returns current active users, events, and other realtime metrics.",
    schema: {
      dimensions: z
        .array(z.string())
        .optional()
        .describe('Optional dimension names, e.g. ["country","deviceCategory"]'),
      metrics: z.array(z.string()).describe('Metric names, e.g. ["activeUsers","eventCount"]'),
      dimension_filter: z
        .object({
          field_name: z.string(),
          string_filter: z
            .object({
              match_type: z
                .enum(["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS", "FULL_REGEXP", "PARTIAL_REGEXP"])
                .optional(),
              value: z.string(),
              case_sensitive: z.boolean().optional(),
            })
            .optional(),
        })
        .optional()
        .describe("Optional dimension filter"),
      limit: z.number().int().min(1).max(100000).default(1000).describe("Max rows to return"),
    },
    handler: async ({ dimensions, metrics, dimension_filter, limit }) => {

      const headers = await auth.authHeaders();
      const body: Record<string, unknown> = {
        metrics: metrics.map((m) => ({ name: m })),
        limit,
      };
      if (dimensions && dimensions.length > 0) {
        body.dimensions = dimensions.map((d) => ({ name: d }));
      }
      if (dimension_filter !== undefined) {
        body.dimensionFilter = dimension_filter;
      }

      const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
      const result = await tryCatch(
        fetch(url, { method: "POST", headers, body: JSON.stringify(body) }),
      );
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }

      const res = result.data;
      if (!res.ok) {
        const errText = await res.text();
        return errorResult("GA4_API_ERROR", `GA4 API error (${res.status}): ${errText}`, false);
      }

      const data: unknown = await res.json();
      return jsonResult(data);
    },
  });
}
