import { Hono } from "hono";
import type { Env } from "../env.js";

const analytics = new Hono<{ Bindings: Env }>();

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

analytics.post("/analytics/ingest", async (c) => {
  // Rate limit check
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";
  const limiterId = c.env.LIMITERS.idFromName(clientIp);
  const limiter = c.env.LIMITERS.get(limiterId);
  const limitResponse = await limiter.fetch(new Request("https://dummy/", { method: "POST" }));
  const cooldown = Number(await limitResponse.text());

  if (cooldown > 0) {
    return c.json({ error: "Rate limited", retryAfter: cooldown }, 429);
  }

  const body = await c.req.json<unknown>();
  if (!Array.isArray(body)) {
    return c.json({ error: "Request body must be an array of events" }, 400);
  }

  const events = body.filter(isValidEvent);
  if (events.length === 0) {
    return c.json({ error: "No valid events in batch" }, 400);
  }

  return c.json({ accepted: events.length });
});

export { analytics };
