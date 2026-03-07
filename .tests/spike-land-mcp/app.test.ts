import { describe, expect, it } from "vitest";
import { createApp } from "../../src/edge-api/spike-land/api/app.js";

describe("app", () => {
  it("GET /health returns 200 ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "spike-land-mcp", timestamp: expect.any(String) });
  });

  it("has expected routes", () => {
    const app = createApp();
    // Check if routes are registered
    const routes = app.routes.map((r) => r.path);
    expect(routes).toContain("/health");
    // Hono might register .well-known as something else or sub-routes
    expect(routes.some((r) => r.includes(".well-known"))).toBe(true);
    expect(routes.some((r) => r.includes("oauth"))).toBe(true);
    expect(routes.some((r) => r.includes("mcp"))).toBe(true);
  });
});
