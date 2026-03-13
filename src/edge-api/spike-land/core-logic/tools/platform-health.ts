/**
 * Platform Health MCP Tool
 *
 * Exposes platform health status via MCP so developers can check
 * service health from CLI (Claude Code / spike-cli) without visiting URLs.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export function registerPlatformHealthTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
  spikeEdge?: Fetcher,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "platform_health",
        "Check the health and status of all spike.land platform services. " +
          "Returns live probe results, active incidents, and platform-wide metrics. " +
          "Optionally filter by service name or request a specific time range.",
        {
          service: z
            .string()
            .optional()
            .describe(
              "Filter to a specific service name (e.g., 'Main Site', 'Transpile', 'MCP Registry')",
            ),
          deep: z
            .boolean()
            .optional()
            .describe("Request deep health checks (checks downstream dependencies)"),
          range: z
            .enum(["60m", "6h", "24h"])
            .optional()
            .describe("Time range for historical metrics (default: 60m)"),
        },
      )
      .meta({ category: "infra", tier: "free" })
      .examples([
        {
          name: "check_all",
          input: {},
          description: "Check health of all platform services",
        },
        {
          name: "check_single",
          input: { service: "Transpile" },
          description: "Check health of the Transpile service only",
        },
        {
          name: "check_24h",
          input: { range: "24h" },
          description: "Get platform health with 24-hour historical metrics",
        },
      ])
      .handler(async ({ input }) => {
        if (!spikeEdge) {
          return textResult("Platform health unavailable: no spike-edge service binding");
        }

        try {
          const range = input.range ?? "60m";
          const url = `https://spike-edge.internal/api/status?range=${range}`;
          const resp = await spikeEdge.fetch(new Request(url));

          if (!resp.ok) {
            return textResult(`Status API returned HTTP ${resp.status}`);
          }

          const data = await resp.json<{
            overall: string;
            timestamp: string;
            summary: { up: number; degraded: number; down: number; total: number };
            platform: {
              currentRpm: number;
              totalRequests: number;
              peakRpm: number;
              meanLatencyMs: number | null;
            };
            services: Array<{
              label: string;
              url: string;
              status: string;
              httpStatus: number | null;
              latencyMs: number;
              error: string | null;
              history?: {
                summary?: {
                  totalRequests?: number;
                  meanLatencyMs?: number | null;
                  currentRpm?: number;
                };
              };
            }>;
          }>();

          // Filter by service if requested
          let services = data.services;
          if (input.service) {
            const needle = input.service.toLowerCase();
            services = services.filter((s) => s.label.toLowerCase().includes(needle));
            if (services.length === 0) {
              return textResult(
                `No service matching "${input.service}". Available: ${data.services.map((s) => s.label).join(", ")}`,
              );
            }
          }

          // Format output
          const lines: string[] = [];
          lines.push(`## Platform Status: ${data.overall.toUpperCase()}`);
          lines.push(`Checked at: ${data.timestamp} | Range: ${range}`);
          lines.push(
            `Services: ${data.summary.up}/${data.summary.total} up, ${data.summary.degraded} degraded, ${data.summary.down} down`,
          );
          lines.push("");

          // Platform metrics
          const latency = data.platform.meanLatencyMs;
          lines.push(
            `Platform RPM: ${data.platform.currentRpm.toFixed(1)} | ` +
              `Total requests: ${data.platform.totalRequests} | ` +
              `Peak RPM: ${data.platform.peakRpm.toFixed(1)} | ` +
              `Mean latency: ${latency !== null ? `${latency.toFixed(1)}ms` : "—"}`,
          );
          lines.push("");

          // Service table
          lines.push("| Service | Status | HTTP | Latency | RPM | Requests |");
          lines.push("|---------|--------|------|---------|-----|----------|");
          for (const svc of services) {
            const icon =
              svc.status === "up" ? "OK" : svc.status === "degraded" ? "DEGRADED" : "DOWN";
            const rpm = svc.history?.summary?.currentRpm?.toFixed(1) ?? "—";
            const reqs = svc.history?.summary?.totalRequests ?? "—";
            lines.push(
              `| ${svc.label} | ${icon} | ${svc.httpStatus ?? "—"} | ${svc.latencyMs}ms | ${rpm} | ${reqs} |`,
            );
          }

          return textResult(lines.join("\n"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown error";
          return textResult(`Failed to fetch platform health: ${msg}`);
        }
      }),
  );
}
