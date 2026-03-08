import {  describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { health } from "../../../src/edge-api/main/api/routes/health.js";

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {
      head: vi.fn().mockResolvedValue(null),
    } as unknown as R2Bucket,
    SPA_ASSETS: {} as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ "1": 1 }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    AUTH_MCP: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    MCP_SERVICE: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    GEMINI_API_KEY: "gemini-key",
    CLAUDE_OAUTH_TOKEN: "token",
    GITHUB_TOKEN: "ghp_xxx",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "secret",
    GA_MEASUREMENT_ID: "G-TEST",
    CACHE_VERSION: "v1",
    GA_API_SECRET: "ga-secret",
    INTERNAL_SERVICE_SECRET: "internal",
    WHATSAPP_APP_SECRET: "wa-secret",
    WHATSAPP_ACCESS_TOKEN: "wa-token",
    WHATSAPP_PHONE_NUMBER_ID: "wa-phone",
    WHATSAPP_VERIFY_TOKEN: "wa-verify",
    MCP_INTERNAL_SECRET: "mcp-secret",
    ...overrides,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", health);
  return app;
}

describe("health route — shallow (no deep)", () => {
  it("returns 200 ok when R2 and D1 succeed", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; r2: string; d1: string }>();
    expect(body.status).toBe("ok");
    expect(body.r2).toBe("ok");
    expect(body.d1).toBe("ok");
  });

  it("returns 503 degraded when R2 throws", async () => {
    const env = createMockEnv({
      R2: {
        head: vi.fn().mockRejectedValue(new Error("R2 unavailable")),
      } as unknown as R2Bucket,
    });
    const app = makeApp();
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; r2: string }>();
    expect(body.status).toBe("degraded");
    expect(body.r2).toBe("degraded");
  });

  it("returns 503 degraded when D1 throws", async () => {
    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error("D1 unavailable")),
        }),
        batch: vi.fn(),
      } as unknown as D1Database,
    });
    const app = makeApp();
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; d1: string }>();
    expect(body.d1).toBe("degraded");
  });
});

describe("health route — deep=true", () => {
  it("includes authMcp and mcpService when both succeed", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/health?deep=true", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ authMcp: string; mcpService: string }>();
    expect(body.authMcp).toBe("ok");
    expect(body.mcpService).toBe("ok");
  });

  it("marks authMcp as degraded when AUTH_MCP returns non-ok", async () => {
    const env = createMockEnv({
      AUTH_MCP: {
        fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 500 })),
      } as unknown as Fetcher,
    });
    const app = makeApp();
    const res = await app.request("/health?deep=true", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; authMcp: string }>();
    expect(body.authMcp).toBe("degraded");
    expect(body.status).toBe("degraded");
  });

  it("marks mcpService as degraded when MCP_SERVICE throws", async () => {
    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi.fn().mockRejectedValue(new Error("timeout")),
      } as unknown as Fetcher,
    });
    const app = makeApp();
    const res = await app.request("/health?deep=true", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ mcpService: string }>();
    expect(body.mcpService).toBe("degraded");
  });

  it("marks authMcp as degraded when AUTH_MCP fetch throws", async () => {
    const env = createMockEnv({
      AUTH_MCP: {
        fetch: vi.fn().mockRejectedValue(new Error("unreachable")),
      } as unknown as Fetcher,
    });
    const app = makeApp();
    const res = await app.request("/health?deep=true", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ authMcp: string }>();
    expect(body.authMcp).toBe("degraded");
  });

  it("overall status is ok only when all bindings are ok", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/health?deep=true", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string }>();
    expect(body.status).toBe("ok");
  });

  it("includes timestamp in response", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/health", {}, env);
    const body = await res.json<{ timestamp: string }>();
    expect(body.timestamp).toBeTruthy();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
