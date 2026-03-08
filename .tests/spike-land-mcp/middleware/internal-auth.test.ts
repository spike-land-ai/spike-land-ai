/**
 * Tests for middleware/internal-auth.ts
 */
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/spike-land/core-logic/env";
import { internalAuthMiddleware } from "../../../src/edge-api/spike-land/api/internal-auth";

function buildApp(_internalSecret: string) {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/internal/*", internalAuthMiddleware);
  app.get("/internal/test", (c) => c.json({ ok: true }));

  return app;
}

describe("internalAuthMiddleware", () => {
  it("allows request with correct x-internal-secret header", async () => {
    const app = buildApp("my-secret");

    const res = await app.request(
      "/internal/test",
      { headers: { "x-internal-secret": "my-secret" } },
      { MCP_INTERNAL_SECRET: "my-secret" } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("rejects request with missing x-internal-secret header", async () => {
    const app = buildApp("my-secret");

    const res = await app.request("/internal/test", {}, {
      MCP_INTERNAL_SECRET: "my-secret",
    } as unknown as Env);

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects request with wrong x-internal-secret header", async () => {
    const app = buildApp("my-secret");

    const res = await app.request(
      "/internal/test",
      { headers: { "x-internal-secret": "wrong-secret" } },
      { MCP_INTERNAL_SECRET: "my-secret" } as unknown as Env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects request when MCP_INTERNAL_SECRET is not set", async () => {
    const app = buildApp("");

    const res = await app.request(
      "/internal/test",
      { headers: { "x-internal-secret": "any-value" } },
      { MCP_INTERNAL_SECRET: "" } as unknown as Env,
    );

    expect(res.status).toBe(401);
  });
});
