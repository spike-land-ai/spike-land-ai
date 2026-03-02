import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "spike-land-mcp-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});
