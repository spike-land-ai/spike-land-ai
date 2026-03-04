/**
 * Internal analytics API for MCP tool call metrics.
 *
 * These endpoints are called by spike-edge via service binding.
 * They query the rollup tables (tool_call_daily, tool_user_daily)
 * for fast aggregations.
 */
import { Hono } from "hono";
import type { Env } from "../env";

const VALID_RANGES: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

function dayEpochForDaysAgo(days: number): number {
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      days * 86_400_000,
  );
  return cutoff.getTime();
}

export const internalAnalytics = new Hono<{ Bindings: Env }>();

/**
 * GET /internal/analytics/tools?range=7d&limit=20
 * Top tools by call count.
 */
internalAnalytics.get("/analytics/tools", async (c) => {
  const range = c.req.query("range") ?? "7d";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);

  const days = VALID_RANGES[range];
  if (!days) {
    return c.json({ error: "Invalid range. Use 24h, 7d, or 30d" }, 400);
  }

  const cutoff = dayEpochForDaysAgo(days);

  const result = await c.env.DB.prepare(
    `SELECT tool_name, server_name,
            SUM(call_count) as total_calls,
            SUM(error_count) as total_errors,
            SUM(total_ms) as total_ms
     FROM tool_call_daily
     WHERE day >= ?
     GROUP BY tool_name, server_name
     ORDER BY total_calls DESC
     LIMIT ?`,
  )
    .bind(cutoff, limit)
    .all();

  return c.json({ tools: result.results, range });
});

/**
 * GET /internal/analytics/users?range=7d&tool=search_tools
 * Unique users per tool (from tool_user_daily).
 */
internalAnalytics.get("/analytics/users", async (c) => {
  const range = c.req.query("range") ?? "7d";
  const tool = c.req.query("tool");

  const days = VALID_RANGES[range];
  if (!days) {
    return c.json({ error: "Invalid range. Use 24h, 7d, or 30d" }, 400);
  }

  const cutoff = dayEpochForDaysAgo(days);

  if (tool) {
    const result = await c.env.DB.prepare(
      `SELECT tool_name, server_name, COUNT(DISTINCT user_id) as unique_users
       FROM tool_user_daily
       WHERE day >= ? AND tool_name = ?
       GROUP BY tool_name, server_name`,
    )
      .bind(cutoff, tool)
      .all();

    return c.json({ users: result.results, range, tool });
  }

  // All tools
  const result = await c.env.DB.prepare(
    `SELECT tool_name, server_name, COUNT(DISTINCT user_id) as unique_users
     FROM tool_user_daily
     WHERE day >= ?
     GROUP BY tool_name, server_name
     ORDER BY unique_users DESC
     LIMIT 50`,
  )
    .bind(cutoff)
    .all();

  return c.json({ users: result.results, range });
});

/**
 * GET /internal/analytics/summary?range=7d
 * Totals, unique users, error rate.
 */
internalAnalytics.get("/analytics/summary", async (c) => {
  const range = c.req.query("range") ?? "7d";

  const days = VALID_RANGES[range];
  if (!days) {
    return c.json({ error: "Invalid range. Use 24h, 7d, or 30d" }, 400);
  }

  const cutoff = dayEpochForDaysAgo(days);

  const results = await c.env.DB.batch([
    // Total calls and errors
    c.env.DB.prepare(
      `SELECT SUM(call_count) as total_calls, SUM(error_count) as total_errors, SUM(total_ms) as total_ms
       FROM tool_call_daily WHERE day >= ?`,
    ).bind(cutoff),

    // Unique users
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as unique_users
       FROM tool_user_daily WHERE day >= ?`,
    ).bind(cutoff),

    // Unique tools
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT tool_name) as unique_tools
       FROM tool_call_daily WHERE day >= ?`,
    ).bind(cutoff),
  ]);

  const totals = results[0]?.results[0] as Record<string, unknown> | undefined;
  const usersRow = results[1]?.results[0] as Record<string, unknown> | undefined;
  const toolsRow = results[2]?.results[0] as Record<string, unknown> | undefined;

  const totalCalls = (totals?.total_calls as number) ?? 0;
  const totalErrors = (totals?.total_errors as number) ?? 0;

  return c.json({
    totalCalls,
    totalErrors,
    errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
    totalMs: (totals?.total_ms as number) ?? 0,
    uniqueUsers: (usersRow?.unique_users as number) ?? 0,
    uniqueTools: (toolsRow?.unique_tools as number) ?? 0,
    range,
  });
});
