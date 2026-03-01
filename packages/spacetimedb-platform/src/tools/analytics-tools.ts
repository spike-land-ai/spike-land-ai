/**
 * Analytics & health MCP tools — record events, query, dashboard, health check.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpacetimePlatformClient } from "../client.js";
import { errorResult, jsonResult } from "../types.js";

export function registerAnalyticsTools(
  server: McpServer,
  client: SpacetimePlatformClient,
): void {
  // ─── stdb_record_event ───

  server.tool(
    "stdb_record_event",
    "Record an analytics event",
    {
      source: z.string().min(1).describe("Event source (e.g. 'web', 'api', 'mcp')"),
      eventType: z.string().min(1).describe("Event type (e.g. 'page_view', 'tool_call')"),
      metadataJson: z.string().default("{}").describe("Event metadata as JSON string"),
    },
    async ({ source, eventType, metadataJson }) => {
      try {
        await client.recordEvent(source, eventType, metadataJson);
        return jsonResult({ recorded: true, source, eventType });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("REDUCER_FAILED", message, true);
      }
    },
  );

  // ─── stdb_query_events ───

  server.tool(
    "stdb_query_events",
    "Query analytics events with optional filters",
    {
      eventType: z.string().optional().describe("Filter by event type"),
      source: z.string().optional().describe("Filter by source"),
      limit: z.number().int().min(1).max(1000).optional().default(100).describe("Max results"),
    },
    async ({ eventType, source, limit }) => {
      try {
        let events = client.queryEvents({ eventType, source });
        if (limit && events.length > limit) {
          events = events.slice(0, limit);
        }
        return jsonResult({
          count: events.length,
          events: events.map((e) => ({
            id: e.id.toString(),
            source: e.source,
            eventType: e.eventType,
            metadataJson: e.metadataJson,
            userIdentity: e.userIdentity ?? null,
            timestamp: e.timestamp.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_analytics_dashboard ───

  server.tool(
    "stdb_analytics_dashboard",
    "Get an analytics dashboard summary",
    {},
    async () => {
      try {
        const events = client.queryEvents({});
        const byType = new Map<string, number>();
        const bySource = new Map<string, number>();
        for (const e of events) {
          byType.set(e.eventType, (byType.get(e.eventType) ?? 0) + 1);
          bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
        }
        return jsonResult({
          totalEvents: events.length,
          byType: Object.fromEntries(byType),
          bySource: Object.fromEntries(bySource),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );

  // ─── stdb_health_check ───

  server.tool(
    "stdb_health_check",
    "Get health status of all services",
    {},
    async () => {
      try {
        const checks = client.getHealthStatus();
        return jsonResult({
          count: checks.length,
          checks: checks.map((c) => ({
            id: c.id.toString(),
            service: c.service,
            status: c.status,
            latencyMs: c.latencyMs,
            checkedAt: c.checkedAt.toString(),
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Not connected")) return errorResult("NOT_CONNECTED", message, false);
        return errorResult("QUERY_FAILED", message, false);
      }
    },
  );
}
