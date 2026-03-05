import { Hono } from "hono";
import type { Env } from "../env.js";
import { createRateLimiter } from "../lib/in-memory-rate-limiter.js";

const errors = new Hono<{ Bindings: Env }>();

const isRateLimited = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });

interface ErrorLogEntry {
  service_name: string;
  error_code?: string;
  message: string;
  stack_trace?: string;
  metadata?: Record<string, unknown>;
  severity?: string;
}

function isValidErrorLog(e: unknown): e is ErrorLogEntry {
  if (typeof e !== "object" || e === null) return false;
  const obj = e as Record<string, unknown>;
  return typeof obj.service_name === "string" && typeof obj.message === "string";
}

const VALID_SEVERITIES = new Set(["warning", "error", "fatal"]);

/** POST /errors/ingest — batch insert error logs from any service. */
errors.post("/errors/ingest", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";
  if (isRateLimited(clientIp)) {
    return c.json({ error: "Rate limited", retryAfter: 60 }, 429);
  }

  const body = await c.req.json<unknown>();
  if (!Array.isArray(body)) {
    return c.json({ error: "Request body must be an array of error logs" }, 400);
  }

  const entries = body.filter(isValidErrorLog);
  if (entries.length === 0) {
    return c.json({ error: "No valid error logs in batch" }, 400);
  }

  const stmt = c.env.DB.prepare(
    "INSERT INTO error_logs (service_name, error_code, message, stack_trace, metadata, client_id, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const batch = entries.map((e) =>
    stmt.bind(
      e.service_name,
      e.error_code ?? null,
      e.message,
      e.stack_trace ?? null,
      e.metadata ? JSON.stringify(e.metadata) : null,
      clientIp,
      VALID_SEVERITIES.has(e.severity ?? "") ? e.severity! : "error",
    ),
  );

  const work = c.env.DB.batch(batch);
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    await work;
  }

  return c.json({ accepted: entries.length });
});

/** GET /errors — list recent errors (internal/admin). */
errors.get("/errors", async (c) => {
  const service = c.req.query("service");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const range = c.req.query("range") ?? "24h";

  const rangeMs: Record<string, number> = {
    "1h": 3_600_000,
    "24h": 86_400_000,
    "7d": 604_800_000,
  };
  const cutoff = Date.now() - (rangeMs[range] ?? 86_400_000);

  let query = "SELECT * FROM error_logs WHERE created_at >= ?";
  const params: (string | number)[] = [cutoff];

  if (service) {
    query += " AND service_name = ?";
    params.push(service);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(result.results);
});

/** GET /errors/summary — aggregated error stats for cockpit dashboard. */
errors.get("/errors/summary", async (c) => {
  const range = c.req.query("range") ?? "24h";
  const rangeMs: Record<string, number> = {
    "1h": 3_600_000,
    "24h": 86_400_000,
    "7d": 604_800_000,
  };
  const cutoff = Date.now() - (rangeMs[range] ?? 86_400_000);

  const [countResult, topCodes] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM error_logs WHERE created_at >= ?",
    ).bind(cutoff).first<{ total: number }>(),
    c.env.DB.prepare(
      "SELECT error_code, COUNT(*) as count FROM error_logs WHERE created_at >= ? GROUP BY error_code ORDER BY count DESC LIMIT 5",
    ).bind(cutoff).all<{ error_code: string; count: number }>(),
  ]);

  return c.json({
    total: countResult?.total ?? 0,
    topCodes: topCodes.results ?? [],
    range,
  });
});

export { errors };
