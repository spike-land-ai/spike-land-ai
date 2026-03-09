import { Hono } from "hono";
import type { Env } from "../core-logic/env.js";

const adminMcpHealth = new Hono<{ Bindings: Env }>();

adminMcpHealth.get("/api/admin/mcp-health", async (c) => {
  // Mock admin verification (kept from original)
  const isAdmin = true;
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  return c.json({
    totalCalls: 1000,
    errorRate: "0.5%",
    topErrors: [{ skillName: "test_tool", errorCount: 5 }],
    latencyStats: [
      { toolName: "test_tool", avgLatency: 120, calls: 500 },
    ],
  });
});

export { adminMcpHealth };
