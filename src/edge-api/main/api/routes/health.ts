import type { Context } from "hono";
import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import {
  buildStandardHealthResponse,
  getHealthHttpStatus,
  timedCheck,
  timedFetchCheck,
  type HealthCheckResult,
} from "../../../common/core-logic/health-contract.js";

/** Critical tables that must exist for core functionality. */
const CRITICAL_TABLES = [
  "analytics_events",
  "error_logs",
  "subscriptions",
  "credit_balances",
  "blog_posts",
];

const health = new Hono<{ Bindings: Env }>();

async function healthHandler(c: Context<{ Bindings: Env }>) {
  const deep = c.req.query("deep") === "true";

  const checks: Record<string, Promise<HealthCheckResult>> = {
    r2: timedCheck(async () => {
      await c.env.R2.head("__health_check__");
    }),
    d1: timedCheck(async () => {
      await c.env.DB.prepare("SELECT 1").first();
    }),
  };

  if (deep) {
    checks["auth_mcp"] = timedFetchCheck(c.env.AUTH_MCP);
    checks["mcp_service"] = timedFetchCheck(c.env.MCP_SERVICE);

    for (const table of CRITICAL_TABLES) {
      checks[`table_${table}`] = timedCheck(async () => {
        await c.env.DB.prepare(`SELECT 1 FROM ${table} LIMIT 0`).first();
      });
    }
  }

  const resolved = Object.fromEntries(
    await Promise.all(Object.entries(checks).map(async ([key, promise]) => [key, await promise])),
  );

  const payload = buildStandardHealthResponse({
    service: "spike-edge",
    checks: resolved,
  });

  return c.json(payload, getHealthHttpStatus(payload));
}

health.get("/health", healthHandler);
health.get("/api/health", healthHandler);

export { health };
