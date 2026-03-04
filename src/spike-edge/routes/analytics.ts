import { Hono } from "hono";
import type { Env } from "../env.js";
import { getClientId, sendGA4Events } from "../lib/ga4.js";
import type { GA4Event } from "../lib/ga4.js";

const analytics = new Hono<{ Bindings: Env }>();

// Simple in-memory rate limiter — no Durable Object overhead.
// Map<clientIp, { count, windowStart }>
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10; // 10 analytics POSTs per minute per IP

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(clientIp, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_MAX_REQUESTS) {
    return true;
  }
  return false;
}

// Periodically clean stale entries to prevent unbounded growth
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < RATE_WINDOW_MS * 2) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}

interface AnalyticsEvent {
  source: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

function isValidEvent(event: unknown): event is AnalyticsEvent {
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return typeof e.source === "string" && typeof e.eventType === "string";
}

const VALID_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

analytics.post("/analytics/ingest", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";

  maybeCleanup();

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
    } catch { /* auth-mcp might be down — fallback to anonymous clientId */ }
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
  } catch { /* no ExecutionContext in test environment — await instead */
    await allWork;
  }

  return c.json({ accepted: events.length });
});

analytics.get("/analytics/events", async (c) => {
  const range = c.req.query("range") ?? "24h";
  const type = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);

  const rangeMs = VALID_RANGES[range];
  if (!rangeMs) {
    return c.json({ error: "Invalid range. Use 24h, 7d, or 30d" }, 400);
  }

  const cutoff = Date.now() - rangeMs;

  let query = "SELECT id, source, event_type, metadata, client_id, created_at FROM analytics_events WHERE created_at >= ?";
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
  const range = c.req.query("range") ?? "24h";

  const rangeMs = VALID_RANGES[range];
  if (!rangeMs) {
    return c.json({ error: "Invalid range. Use 24h, 7d, or 30d" }, 400);
  }

  const cutoff = Date.now() - rangeMs;

  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM analytics_events WHERE created_at >= ?",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT COUNT(DISTINCT client_id) as unique_users FROM analytics_events WHERE created_at >= ?",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT event_type, COUNT(*) as count FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC",
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT json_extract(metadata, '$.toolName') as tool_name, COUNT(*) as count FROM analytics_events WHERE created_at >= ? AND event_type = 'tool_use' AND metadata IS NOT NULL GROUP BY tool_name ORDER BY count DESC LIMIT 20",
    ).bind(cutoff),
  ]);

  const totalRow = results[0]?.results[0] as Record<string, unknown> | undefined;
  const usersRow = results[1]?.results[0] as Record<string, unknown> | undefined;

  return c.json({
    totalEvents: totalRow?.total ?? 0,
    uniqueUsers: usersRow?.unique_users ?? 0,
    eventsByType: results[2]?.results ?? [],
    toolUsage: results[3]?.results ?? [],
  });
});

// ─── MCP Analytics Proxy (to spike-land-mcp internal API) ────────────────────

analytics.get("/analytics/mcp/tools", async (c) => {
  const url = new URL("https://mcp.spike.land/internal/analytics/tools");
  if (c.req.query("range")) url.searchParams.set("range", c.req.query("range")!);
  if (c.req.query("limit")) url.searchParams.set("limit", c.req.query("limit")!);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

analytics.get("/analytics/mcp/users", async (c) => {
  const url = new URL("https://mcp.spike.land/internal/analytics/users");
  if (c.req.query("range")) url.searchParams.set("range", c.req.query("range")!);
  if (c.req.query("tool")) url.searchParams.set("tool", c.req.query("tool")!);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

analytics.get("/analytics/mcp/summary", async (c) => {
  const url = new URL("https://mcp.spike.land/internal/analytics/summary");
  if (c.req.query("range")) url.searchParams.set("range", c.req.query("range")!);

  const res = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
});

export { analytics };
