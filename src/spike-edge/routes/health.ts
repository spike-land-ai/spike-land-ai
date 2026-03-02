import { Hono } from "hono";
import type { Env } from "../env.js";

const health = new Hono<{ Bindings: Env }>();

health.get("/health", async (c) => {
  try {
    // Verify R2 connectivity with a lightweight HEAD request
    await c.env.R2.head("__health_check__");
  } catch {
    return c.json({ status: "degraded", timestamp: new Date().toISOString() }, 503);
  }

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export { health };
