/**
 * ga4_run_report & ga4_batch_report — GA4 Data API reporting tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { GoogleAuthClient } from "../auth/google-oauth.js";

const DimensionFilterSchema = z
  .object({
    field_name: z.string().describe("Dimension name to filter on"),
    string_filter: z
      .object({
        match_type: z
          .enum(["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS", "FULL_REGEXP", "PARTIAL_REGEXP"])
          .optional(),
        value: z.string(),
        case_sensitive: z.boolean().optional(),
      })
      .optional(),
    in_list_filter: z
      .object({ values: z.array(z.string()), case_sensitive: z.boolean().optional() })
      .optional(),
  })
  .describe("Filter for a single dimension");

const MetricFilterSchema = z
  .object({
    field_name: z.string().describe("Metric name to filter on"),
    numeric_filter: z
      .object({
        operation: z.enum(["EQUAL", "LESS_THAN", "LESS_THAN_OR_EQUAL", "GREATER_THAN", "GREATER_THAN_OR_EQUAL"]),
        value: z.object({
          int64_value: z.string().optional(),
          double_value: z.number().optional(),
        }),
      })
      .optional(),
  })
  .describe("Filter for a single metric");

function buildReportBody(args: {
  dimensions: string[];
  metrics: string[];
  date_range_start: string;
  date_range_end: string;
  dimension_filter?: unknown;
  metric_filter?: unknown;
  limit?: number;
  offset?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    dimensions: args.dimensions.map((d) => ({ name: d })),
    metrics: args.metrics.map((m) => ({ name: m })),
    dateRanges: [{ startDate: args.date_range_start, endDate: args.date_range_end }],
    limit: args.limit ?? 1000,
  };
  if (args.offset !== undefined) body.offset = args.offset;
  if (args.dimension_filter !== undefined) body.dimensionFilter = args.dimension_filter;
  if (args.metric_filter !== undefined) body.metricFilter = args.metric_filter;
  return body;
}

export function registerReportTools(
  server: McpServer,
  auth: GoogleAuthClient,
  propertyId: string,
): void {
  createZodTool(server, {
    name: "ga4_run_report",
    description:
      "Run a Google Analytics 4 report. Returns dimensions and metrics for the specified date range.",
    schema: {
      dimensions: z.array(z.string()).describe('Dimension names, e.g. ["date","country"]'),
      metrics: z.array(z.string()).describe('Metric names, e.g. ["sessions","activeUsers"]'),
      date_range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date (YYYY-MM-DD)"),
      date_range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date (YYYY-MM-DD)"),
      dimension_filter: DimensionFilterSchema.optional().describe("Optional dimension filter"),
      metric_filter: MetricFilterSchema.optional().describe("Optional metric filter"),
      limit: z.number().int().min(1).max(100000).default(1000).describe("Max rows to return"),
      offset: z.number().int().min(0).optional().describe("Row offset for pagination"),
    },
    handler: async (args) => {
      const headers = await auth.authHeaders();
      const body = buildReportBody(args as Parameters<typeof buildReportBody>[0]);
      const url = `https://analyticsdata.googleapis.com/v1/properties/${propertyId}:runReport`;

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

  createZodTool(server, {
    name: "ga4_batch_report",
    description:
      "Run multiple GA4 reports in a single batch request. Each report has its own dimensions, metrics, and date range.",
    schema: {
      reports: z
        .array(
          z.object({
            dimensions: z.array(z.string()).describe("Dimension names"),
            metrics: z.array(z.string()).describe("Metric names"),
            date_range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("Start date (YYYY-MM-DD)"),
            date_range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").describe("End date (YYYY-MM-DD)"),
            limit: z.number().int().min(1).max(100000).default(1000).optional(),
          }),
        )
        .min(1)
        .max(5)
        .describe("Array of report configurations (max 5)"),
    },
    handler: async (args) => {
      const { reports } = args as { reports: Array<{
        dimensions: string[];
        metrics: string[];
        date_range_start: string;
        date_range_end: string;
        limit?: number;
      }> };
      const headers = await auth.authHeaders();

      const requests = reports.map((r) => ({
        dimensions: r.dimensions.map((d) => ({ name: d })),
        metrics: r.metrics.map((m) => ({ name: m })),
        dateRanges: [{ startDate: r.date_range_start, endDate: r.date_range_end }],
        limit: r.limit ?? 1000,
      }));

      const url = `https://analyticsdata.googleapis.com/v1/properties/${propertyId}:batchRunReports`;
      const result = await tryCatch(
        fetch(url, { method: "POST", headers, body: JSON.stringify({ requests }) }),
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
