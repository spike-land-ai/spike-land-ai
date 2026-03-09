import { Hono } from "hono";
import type { Env } from "../core-logic/env.js";

const healthDetailed = new Hono<{ Bindings: Env }>();

healthDetailed.get("/api/health/detailed", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export { healthDetailed };
