import {  describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { authMiddleware } from "../../../src/edge-api/main/api/middleware/auth.js";
import { creditMeterMiddleware } from "../../../src/edge-api/main/api/middleware/credit-meter.js";

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {} as R2Bucket,
    SPA_ASSETS: {} as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    LIMITERS: {} as DurableObjectNamespace,
    AUTH_MCP: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    MCP_SERVICE: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    STRIPE_SECRET_KEY: "sk_test_xxx",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    GEMINI_API_KEY: "gemini-key",
    CLAUDE_OAUTH_TOKEN: "claude-token",
    GITHUB_TOKEN: "ghp_xxx",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "test-secret",
    GA_MEASUREMENT_ID: "G-TEST123",
    CACHE_VERSION: "v1",
    GA_API_SECRET: "ga-secret",
    INTERNAL_SERVICE_SECRET: "internal-secret-123",
    WHATSAPP_APP_SECRET: "wa-secret",
    WHATSAPP_ACCESS_TOKEN: "wa-token",
    WHATSAPP_PHONE_NUMBER_ID: "wa-phone",
    WHATSAPP_VERIFY_TOKEN: "wa-verify",
    MCP_INTERNAL_SECRET: "mcp-secret",
    ...overrides,
  };
}

// ─── authMiddleware ────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  it("returns 401 when no cookie and no auth header", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    const res = await app.request("/protected", {}, env);
    expect(res.status).toBe(401);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Authentication required");
  });

  it("passes through with valid internal secret and userId", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ userId: c.get("userId" as never) }));

    const env = createMockEnv();
    const res = await app.request(
      "/protected",
      {
        headers: {
          "x-internal-secret": "internal-secret-123",
          "x-user-id": "user-abc",
        },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ userId: string }>();
    expect(body.userId).toBe("user-abc");
  });

  it("returns 401 when internal secret is wrong", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    const res = await app.request(
      "/protected",
      {
        headers: {
          "x-internal-secret": "wrong-secret",
          "x-user-id": "user-abc",
          cookie: "session=abc",
        },
      },
      env,
    );
    // Falls through to cookie-based auth
    // AUTH_MCP returns 200 by default but no session
    expect(res.status).toBe(401);
  });

  it("returns 401 when internal secret present but no userId header", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    // Has secret but no x-user-id, and no cookie => 401
    const res = await app.request(
      "/protected",
      {
        headers: {
          "x-internal-secret": "internal-secret-123",
          // no x-user-id
        },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when AUTH_MCP returns non-ok", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    (env.AUTH_MCP.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("{}", { status: 401 }),
    );

    const res = await app.request(
      "/protected",
      {
        headers: { cookie: "session=bad" },
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid or expired session");
  });

  it("returns 401 when session response has no user", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    (env.AUTH_MCP.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ session: null, user: null }), { status: 200 }),
    );

    const res = await app.request(
      "/protected",
      {
        headers: { cookie: "session=abc" },
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid or expired session");
  });

  it("returns 401 when session exists but user is missing", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const env = createMockEnv();
    (env.AUTH_MCP.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ session: { id: "sess1" }, user: null }), { status: 200 }),
    );

    const res = await app.request(
      "/protected",
      {
        headers: { cookie: "session=abc" },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("sets userId in context and proceeds when session is valid", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ userId: c.get("userId" as never) }));

    const env = createMockEnv();
    (env.AUTH_MCP.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ session: { id: "sess1" }, user: { id: "user-xyz" } }), {
        status: 200,
      }),
    );

    const res = await app.request(
      "/protected",
      {
        headers: { cookie: "session=valid-session" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ userId: string }>();
    expect(body.userId).toBe("user-xyz");
  });

  it("uses authorization header when present", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware);
    app.get("/protected", (c) => c.json({ userId: c.get("userId" as never) }));

    const env = createMockEnv();
    (env.AUTH_MCP.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ session: { id: "sess1" }, user: { id: "user-bearer" } }), {
        status: 200,
      }),
    );

    const res = await app.request(
      "/protected",
      {
        headers: { authorization: "Bearer token123" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ userId: string }>();
    expect(body.userId).toBe("user-bearer");
  });
});

// ─── creditMeterMiddleware ─────────────────────────────────────────────────────

describe("creditMeterMiddleware", () => {
  function makeCreditApp(userId: string | undefined) {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      if (userId) c.set("userId" as never, userId as never);
      await next();
    });
    app.use("*", creditMeterMiddleware);
    app.post("/proxy/ai", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns 401 when no userId", async () => {
    const app = makeCreditApp(undefined);
    const env = createMockEnv();
    const res = await app.request("/proxy/ai", { method: "POST" }, env);
    expect(res.status).toBe(401);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Unauthorized");
  });

  it("allows business tier users without checking balance", async () => {
    const app = makeCreditApp("user-biz");
    const today = new Date().toISOString().slice(0, 10);
    // Build DB that returns business subscription
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes("access_grants")) return Promise.resolve(null);
          if (sql.includes("subscriptions"))
            return Promise.resolve({ plan: "business", status: "active" });
          return Promise.resolve({ balance: 999, daily_limit: 999999, last_daily_grant: today });
        }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const env = createMockEnv({ DB: db });
    const res = await app.request("/proxy/ai", { method: "POST" }, env);
    expect(res.status).toBe(200);
  });

  it("returns 402 when free user has insufficient credits", async () => {
    const app = makeCreditApp("user-free");
    const today = new Date().toISOString().slice(0, 10);
    // Free user with 0 credits (grant already given today)
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes("access_grants")) return Promise.resolve(null);
          if (sql.includes("subscriptions")) return Promise.resolve(null); // free tier
          if (sql.includes("credit_balances")) {
            return Promise.resolve({ balance: 0, daily_limit: 50, last_daily_grant: today });
          }
          return Promise.resolve(null);
        }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const env = createMockEnv({ DB: db });
    const res = await app.request("/proxy/ai", { method: "POST" }, env);
    expect(res.status).toBe(402);
    const body = await res.json<{ error: string; balance: number; required: number }>();
    expect(body.error).toBe("insufficient_credits");
    expect(body.required).toBe(1);
  });

  it("deducts credit after successful AI proxy call", async () => {
    const app = makeCreditApp("user-pro");
    const today = new Date().toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes("access_grants")) return Promise.resolve(null);
          if (sql.includes("subscriptions")) return Promise.resolve(null);
          if (sql.includes("credit_balances")) {
            return Promise.resolve({ balance: 50, daily_limit: 50, last_daily_grant: today });
          }
          return Promise.resolve(null);
        }),
      })),
      batch: batchMock,
    } as unknown as D1Database;

    const env = createMockEnv({ DB: db });
    const res = await app.request("/proxy/ai", { method: "POST" }, env);
    expect(res.status).toBe(200);
    // batch called for deduction
    expect(batchMock).toHaveBeenCalled();
  });
});
