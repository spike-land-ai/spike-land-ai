import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import type { GA4Event } from "../../lazy-imports/ga4.js";
import { createRateLimiter } from "../../core-logic/in-memory-rate-limiter.js";
import { requireInternalSecret } from "../../core-logic/internal-auth.js";

const analytics = new Hono<{ Bindings: Env; Variables: Variables }>();

const isRateLimited = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

interface AnalyticsEvent {
  source: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

function isValidEvent(event: unknown): event is AnalyticsEvent {
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return typeof e["source"] === "string" && typeof e["eventType"] === "string";
}

const VALID_RANGES: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
  "3mo": 90 * 24 * 60 * 60_000,
  "6mo": 180 * 24 * 60 * 60_000,
  "1y": 365 * 24 * 60 * 60_000,
  "3y": 3 * 365 * 24 * 60 * 60_000,
};

const VALID_RANGE_KEYS = Object.keys(VALID_RANGES).join(", ");

const ADMIN_EMAILS = new Set(["zoltan.erdos@spike.land", "zolika84@gmail.com"]);

/**
 * Dual auth check: accepts either X-Internal-Secret (service-to-service)
 * or an authenticated founder session (userId → email → ADMIN_EMAILS).
 */
async function requireFounderOrSecret(
  c: import("hono").Context<{ Bindings: Env; Variables: Variables }>,
): Promise<{ authorized: boolean; error?: string; status?: number }> {
  // Path 1: Internal secret (service-to-service)
  if (requireInternalSecret(c.env, c.req)) {
    return { authorized: true };
  }

  // Path 2: Authenticated founder session
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const email = c.get("userEmail") as string | undefined;
  if (!email || !ADMIN_EMAILS.has(email)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

function parseRange(range: string): number | null {
  return VALID_RANGES[range] ?? null;
}

analytics.post("/analytics/ingest", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";

  if (isRateLimited(clientIp)) {
    return c.json({ error: "Rate limited", retryAfter: 60 }, 429);
  }

  const body = await c.req.json<unknown>();
  if (!Array.isArray(body)) {
    return c.json({ error: "Request body must be an array of events" }, 400);
  }

  const events = body.filter(isValidEvent);
  if (events.length === 0) {
    return c.json({ error: "No valid events in batch" }, 400);
  }

  // 1. Try to get stable ID (Cookie or IP)
  let clientId = await getClientId(c.req.raw);

  // 2. Try to get authenticated User ID (optional)
  const cookie = c.req.header("cookie");
  if (cookie?.includes("auth_session")) {
    try {
      const sessionReq = new Request("https://auth-mcp.spike.land/api/auth/get-session", {
        headers: {
          cookie,
          "X-Forwarded-Host": "spike.land",
          "X-Forwarded-Proto": "https",
        },
      });
      const sessionRes = await c.env.AUTH_MCP.fetch(sessionReq);
      if (sessionRes.ok) {
        const session = await sessionRes.json<{ user?: { id: string } }>();
        if (session?.user?.id) {
          clientId = `user_${session.user.id}`;
        }
      }
    } catch {
      /* auth-mcp might be down — fallback to anonymous clientId */
    }
  }

  // Store events in D1
  const d1Promise = (async () => {
    const stmt = c.env.DB.prepare(
      "INSERT INTO analytics_events (source, event_type, metadata, client_id) VALUES (?, ?, ?, ?)",
    );
    const batch = events.map((event) =>
      stmt.bind(
        event.source,
        event.eventType,
        event.metadata ? JSON.stringify(event.metadata) : null,
        clientId,
      ),
    );
    await c.env.DB.batch(batch);
  })();

  // Convert to GA4 events and forward in background
  const ga4Events: GA4Event[] = events.map((event) => {
    const params: Record<string, string | number | boolean> = {
      event_source: event.source,
    };
    if (event.metadata) {
      for (const [key, value] of Object.entries(event.metadata)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          params[key] = value;
        }
      }
    }
    return { name: event.eventType, params };
  });

  const ga4Promise = sendGA4Events(c.env, clientId, ga4Events);

  const allWork = Promise.all([d1Promise, ga4Promise]).catch(() => {
    /* best-effort — failures are logged by individual handlers */
  });

  try {
    c.executionCtx.waitUntil(allWork);
  } catch {
    /* no ExecutionContext in test environment — await instead */
    await allWork;
  }

  return c.json({ accepted: events.length });
});

analytics.get("/analytics/events", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const range = c.req.query("range") ?? "24h";
  const type = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

  const rangeMs = parseRange(range);
  if (!rangeMs) {
    return c.json({ error: `Invalid range. Use one of: ${VALID_RANGE_KEYS}` }, 400);
  }

  const cutoff = Date.now() - rangeMs;

  let query =
    "SELECT id, source, event_type, metadata, client_id, created_at FROM analytics_events WHERE created_at >= ?";
  const params: (string | number)[] = [cutoff];

  if (type) {
    query += " AND event_type = ?";
    params.push(type);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const stmt = c.env.DB.prepare(query);
  const result = await stmt.bind(...params).all();

  return c.json(result.results);
});

analytics.get("/analytics/summary", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const range = c.req.query("range") ?? "24h";

  const rangeMs = parseRange(range);
  if (!rangeMs) {
    return c.json({ error: `Invalid range. Use one of: ${VALID_RANGE_KEYS}` }, 400);
  }

  const cutoff = Date.now() - rangeMs;

  const results = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) as total FROM analytics_events WHERE created_at >= ?").bind(
      cutoff,
    ),
    c.env.DB.prepare(
      "SELECT COUNT(DISTINCT client_id) as unique_users FROM analytics_events WHERE created_at >= ?",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT event_type, COUNT(*) as count FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT json_extract(metadata, '$.toolName') as tool_name, COUNT(*) as count FROM analytics_events WHERE created_at >= ? AND event_type = 'tool_use' AND metadata IS NOT NULL GROUP BY tool_name ORDER BY count DESC LIMIT 20",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT json_extract(metadata, '$.slug') as slug, COUNT(*) as count FROM analytics_events WHERE created_at >= ? AND event_type = 'blog_view' AND metadata IS NOT NULL GROUP BY slug ORDER BY count DESC LIMIT 20",
    ).bind(cutoff),
  ]);

  const totalRow = results[0]?.results[0] as Record<string, unknown> | undefined;
  const usersRow = results[1]?.results[0] as Record<string, unknown> | undefined;

  return c.json({
    totalEvents: totalRow?.["total"] ?? 0,
    uniqueUsers: usersRow?.["unique_users"] ?? 0,
    eventsByType: results[2]?.results ?? [],
    toolUsage: results[3]?.results ?? [],
    blogViews: results[4]?.results ?? [],
  });
});

analytics.get("/analytics/dashboard", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const range = c.req.query("range") ?? "24h";

  const rangeMs = parseRange(range);
  if (!rangeMs) {
    return c.json({ error: `Invalid range. Use one of: ${VALID_RANGE_KEYS}` }, 400);
  }

  const cutoff = Date.now() - rangeMs;
  const realtimeCutoff = Date.now() - 5 * 60_000;
  const includeFunnel = rangeMs >= 7 * 24 * 60 * 60_000;

  const queries = [
    // 0: total events
    c.env.DB.prepare("SELECT COUNT(*) as total FROM analytics_events WHERE created_at >= ?").bind(
      cutoff,
    ),
    // 1: unique users
    c.env.DB.prepare(
      "SELECT COUNT(DISTINCT client_id) as unique_users FROM analytics_events WHERE created_at >= ?",
    ).bind(cutoff),
    // 2: events by type
    c.env.DB.prepare(
      "SELECT event_type, COUNT(*) as count FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC",
    ).bind(cutoff),
    // 3: tool usage
    c.env.DB.prepare(
      "SELECT json_extract(metadata, '$.toolName') as tool_name, COUNT(*) as count FROM analytics_events WHERE created_at >= ? AND event_type = 'tool_use' AND metadata IS NOT NULL GROUP BY tool_name ORDER BY count DESC LIMIT 20",
    ).bind(cutoff),
    // 4: blog views
    c.env.DB.prepare(
      "SELECT json_extract(metadata, '$.slug') as slug, COUNT(*) as count FROM analytics_events WHERE created_at >= ? AND event_type = 'blog_view' AND metadata IS NOT NULL GROUP BY slug ORDER BY count DESC LIMIT 20",
    ).bind(cutoff),
    // 5: recent events (last 30)
    c.env.DB.prepare(
      "SELECT id, source, event_type, metadata, client_id, created_at FROM analytics_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT 30",
    ).bind(cutoff),
    // 6: active users (last 5 min)
    c.env.DB.prepare(
      "SELECT COUNT(DISTINCT client_id) as active_users FROM analytics_events WHERE created_at >= ?",
    ).bind(realtimeCutoff),
    // 7: earliest event timestamp
    c.env.DB.prepare("SELECT MIN(created_at) as earliest FROM analytics_events"),
  ];

  // 8: funnel data (only for ranges >= 7d)
  if (includeFunnel) {
    queries.push(
      c.env.DB.prepare(
        `SELECT
           event_type,
           COUNT(*) as count,
           COUNT(DISTINCT client_id) as unique_users
         FROM analytics_events
         WHERE event_type IN (
           'signup_completed', 'mcp_server_connected',
           'first_tool_call', 'second_session', 'upgrade_completed'
         )
         AND created_at >= ?
         GROUP BY event_type
         ORDER BY CASE event_type
           WHEN 'signup_completed' THEN 1
           WHEN 'mcp_server_connected' THEN 2
           WHEN 'first_tool_call' THEN 3
           WHEN 'second_session' THEN 4
           WHEN 'upgrade_completed' THEN 5
         END`,
      ).bind(cutoff),
    );
  }

  const results = await c.env.DB.batch(queries);

  const totalRow = results[0]?.results[0] as Record<string, unknown> | undefined;
  const usersRow = results[1]?.results[0] as Record<string, unknown> | undefined;
  const activeRow = results[6]?.results[0] as Record<string, unknown> | undefined;
  const earliestRow = results[7]?.results[0] as Record<string, unknown> | undefined;

  return c.json({
    summary: {
      totalEvents: totalRow?.["total"] ?? 0,
      uniqueUsers: usersRow?.["unique_users"] ?? 0,
      eventsByType: results[2]?.results ?? [],
      toolUsage: results[3]?.results ?? [],
      blogViews: results[4]?.results ?? [],
    },
    recentEvents: results[5]?.results ?? [],
    funnel: includeFunnel ? (results[8]?.results ?? null) : null,
    activeUsers: (activeRow?.["active_users"] as number) ?? null,
    meta: {
      range,
      queriedAt: Date.now(),
      earliestEvent: (earliestRow?.["earliest"] as number) ?? null,
    },
  });
});

analytics.get("/analytics/funnel", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const result = await c.env.DB.prepare(
    `SELECT
       event_type,
       COUNT(*) as count,
       COUNT(DISTINCT client_id) as unique_users,
       date(created_at / 1000, 'unixepoch') as day
     FROM analytics_events
     WHERE event_type IN (
       'signup_completed', 'mcp_server_connected',
       'first_tool_call', 'second_session', 'upgrade_completed'
     )
     AND created_at > ?
     GROUP BY event_type, day
     ORDER BY day DESC`,
  )
    .bind(cutoffMs)
    .all();

  return c.json(result.results);
});

// ─── MCP Analytics Proxy (to spike-land-mcp internal API) ────────────────────

analytics.get("/analytics/mcp/tools", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const url = new URL("https://mcp.spike.land/internal/analytics/tools");
  const rangeParam = c.req.query("range");
  if (rangeParam) url.searchParams.set("range", rangeParam);
  const limitParam = c.req.query("limit");
  if (limitParam) url.searchParams.set("limit", limitParam);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

analytics.get("/analytics/mcp/users", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const url = new URL("https://mcp.spike.land/internal/analytics/users");
  const rangeParam = c.req.query("range");
  if (rangeParam) url.searchParams.set("range", rangeParam);
  const toolParam = c.req.query("tool");
  if (toolParam) url.searchParams.set("tool", toolParam);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

analytics.get("/analytics/mcp/summary", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) {
    return c.json({ error: auth.error }, auth.status as 401 | 403);
  }

  const url = new URL("https://mcp.spike.land/internal/analytics/summary");
  const rangeParam = c.req.query("range");
  if (rangeParam) url.searchParams.set("range", rangeParam);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

export { analytics };
