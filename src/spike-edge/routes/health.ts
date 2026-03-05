import { Hono } from "hono";
import type { Env } from "../env.js";

const health = new Hono<{ Bindings: Env }>();

health.get("/health", async (c) => {
  const deep = c.req.query("deep") === "true";

  let r2Status = "ok";
  let d1Status = "ok";

  try {
    await c.env.R2.head("__health_check__");
  } catch {
    r2Status = "degraded";
  }

  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    d1Status = "degraded";
  }

  const result: Record<string, unknown> = {
    status: "ok",
    r2: r2Status,
    d1: d1Status,
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    const checkBinding = async (binding: Fetcher): Promise<string> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await binding.fetch(new Request("https://internal/health"), {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok ? "ok" : "degraded";
      } catch {
        return "degraded";
      }
    };

    const [authResult, mcpResult] = await Promise.allSettled([
      checkBinding(c.env.AUTH_MCP),
      checkBinding(c.env.MCP_SERVICE),
    ]);

    result.authMcp = authResult.status === "fulfilled" ? authResult.value : "degraded";
    result.mcpService = mcpResult.status === "fulfilled" ? mcpResult.value : "degraded";
  }

  const overall = Object.values(result).every(
    (v) => v === "ok" || typeof v !== "string",
  )
    ? "ok"
    : "degraded";
  result.status = overall;

  return c.json(result, overall === "ok" ? 200 : 503);
});

export { health };
