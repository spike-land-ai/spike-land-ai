import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { proxy } from "../../../src/edge-api/main/api/routes/proxy.js";

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {} as R2Bucket,
    SPA_ASSETS: {} as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    AUTH_MCP: { fetch: vi.fn() } as unknown as Fetcher,
    MCP_SERVICE: {
      fetch: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ key: null }), { status: 200 })),
    } as unknown as Fetcher,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test_xxx",
    STRIPE_WEBHOOK_SECRET: "whsec",
    GEMINI_API_KEY: "gemini-key",
    CLAUDE_OAUTH_TOKEN: "claude-token",
    GITHUB_TOKEN: "ghp_xxx",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "secret",
    GA_MEASUREMENT_ID: "G-TEST",
    CACHE_VERSION: "v1",
    GA_API_SECRET: "ga",
    INTERNAL_SERVICE_SECRET: "internal",
    WHATSAPP_APP_SECRET: "wa",
    WHATSAPP_ACCESS_TOKEN: "token",
    WHATSAPP_PHONE_NUMBER_ID: "phone",
    WHATSAPP_VERIFY_TOKEN: "verify",
    MCP_INTERNAL_SECRET: "mcp",
    ...overrides,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", proxy);
  return app;
}

// ─── POST /proxy/stripe ───────────────────────────────────────────────────────

describe("POST /proxy/stripe", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "pi_test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid body (missing url)", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({ data: "no url" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("returns 400 for non-Stripe URL", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://evil.com/steal" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid Stripe");
  });

  it("returns 405 for non-POST method", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.stripe.com/v1/charges", method: "GET" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(405);
  });

  it("proxies valid Stripe request with authorization header", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.stripe.com/v1/payment_intents" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalled();
    const [[url, options]] = mockFetch.mock.calls;
    expect(url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(options.headers.Authorization).toContain("sk_test_xxx");
    expect(options.headers["Stripe-Version"]).toBe("2024-06-20");
  });

  it("sanitizes caller headers — only allows safe headers", async () => {
    const env = createMockEnv();
    const app = makeApp();
    await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://api.stripe.com/v1/charges",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            Authorization: "Bearer hacker-token", // should be stripped
            "x-request-id": "req-123", // allowed
            "x-evil-header": "injected", // should be stripped
          },
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["Authorization"]).toContain("sk_test_xxx"); // platform key used
    expect(options.headers["x-evil-header"]).toBeUndefined();
    expect(options.headers["x-request-id"]).toBe("req-123");
  });

  it("passes body when provided", async () => {
    const env = createMockEnv();
    const app = makeApp();
    await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://api.stripe.com/v1/payment_intents",
          body: { amount: 100, currency: "usd" },
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    const [[, options]] = mockFetch.mock.calls;
    expect(options.body).toBe("amount=100&currency=usd");
  });
});

// ─── POST /proxy/ai ───────────────────────────────────────────────────────────

describe("POST /proxy/ai", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid body", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-AI URL", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://evil.com/steal" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid AI API");
  });

  it("returns 405 for non-POST method to AI", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages", method: "GET" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(405);
  });

  it("proxies Anthropic request with x-api-key header", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["x-api-key"]).toBe("claude-token");
  });

  it("proxies Gemini request with Bearer Authorization", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://generativelanguage.googleapis.com/v1/models" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["Authorization"]).toContain("gemini-key");
  });

  it("uses BYOK key when MCP_SERVICE returns one", async () => {
    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ key: "byok-user-key" }), { status: 200 }),
          ),
      } as unknown as Fetcher,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user-with-byok" as never);
      await next();
    });
    app.route("/", proxy);
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    // The BYOK key should be used
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["x-api-key"]).toBe("byok-user-key");
  });

  it("falls back to platform key when BYOK resolves null", async () => {
    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ key: null }), { status: 200 })),
      } as unknown as Fetcher,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user-no-byok" as never);
      await next();
    });
    app.route("/", proxy);
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["x-api-key"]).toBe("claude-token");
  });

  it("returns 503 when AI key not configured and BYOK resolves null", async () => {
    const env = createMockEnv({
      CLAUDE_OAUTH_TOKEN: "",
      MCP_SERVICE: {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ key: null }), { status: 200 })),
      } as unknown as Fetcher,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user" as never);
      await next();
    });
    app.route("/", proxy);
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(503);
  });

  it("handles BYOK lookup failure gracefully (falls back to platform key)", async () => {
    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi.fn().mockRejectedValue(new Error("MCP unavailable")),
      } as unknown as Fetcher,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user" as never);
      await next();
    });
    app.route("/", proxy);
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    // Falls back to platform claude-token
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers["x-api-key"]).toBe("claude-token");
  });
});

// ─── POST /proxy/github ───────────────────────────────────────────────────────

describe("POST /proxy/github", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ login: "testuser" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid body", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-GitHub URL", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://evil.com" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid GitHub");
  });

  it("returns 405 for disallowed method (DELETE)", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        body: JSON.stringify({ url: "https://api.github.com/repos", method: "DELETE" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(405);
  });

  it("proxies GET request to GitHub with token", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://api.github.com/repos/spike-land/spike-land",
          method: "GET",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const [[, options]] = mockFetch.mock.calls;
    expect(options.headers.Authorization).toContain("ghp_xxx");
    expect(options.headers.Accept).toBe("application/vnd.github+json");
    expect(options.headers["User-Agent"]).toBe("spike-edge");
  });

  it("proxies POST request to GitHub", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://api.github.com/repos/spike-land/spike-land/issues",
          method: "POST",
          body: { title: "Test issue" },
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const [[, options]] = mockFetch.mock.calls;
    expect(options.method).toBe("POST");
    expect(options.body).toContain("Test issue");
  });
});
