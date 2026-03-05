/**
 * Supplemental tests targeting uncovered branches and functions across spike-edge.
 * Focused on cache-throw fallback paths, error handlers, and waitUntil branches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/spike-edge/env.js";
import { blog } from "../../../src/spike-edge/routes/blog.js";
import { githubStars } from "../../../src/spike-edge/routes/github-stars.js";
import { sitemap } from "../../../src/spike-edge/routes/sitemap.js";
import { r2 } from "../../../src/spike-edge/routes/r2.js";
import { stripeWebhook } from "../../../src/spike-edge/routes/stripe-webhook.js";
import { cockpit } from "../../../src/spike-edge/routes/cockpit.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

const SAMPLE_ROW = {
  slug: "hello-world",
  title: "Hello World",
  description: "Test post",
  primer: "Intro",
  date: "2025-01-01",
  author: "Alice",
  category: "tech",
  tags: '["ts"]',
  featured: 1,
  hero_image: "/images/hero.png",
  content: "# Hello",
  created_at: 1700000000000,
  updated_at: 1700000000000,
};

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as R2Bucket,
    SPA_ASSETS: {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    AUTH_MCP: { fetch: vi.fn() } as unknown as Fetcher,
    MCP_SERVICE: { fetch: vi.fn() } as unknown as Fetcher,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret_1234",
    GEMINI_API_KEY: "key",
    CLAUDE_OAUTH_TOKEN: "token",
    GITHUB_TOKEN: "ghp_test",
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

// ── blog.ts coverage gaps ─────────────────────────────────────────────────────

describe("blog.ts — cache throw fallback paths", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("GET /api/blog: returns posts via D1 fallback when cache throws", async () => {
    // Simulate Cache API throwing
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [SAMPLE_ROW] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);

    const ctx = makeCtx();
    const res = await app.request(
      "/api/blog",
      {},
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = await res.json<unknown[]>();
    expect(body).toHaveLength(1);
  });

  it("GET /api/blog: returns 404 when cache throws and D1 has no results", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    const env = createMockEnv(); // DB returns empty results
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);

    const res = await app.request("/api/blog", {}, env);
    expect(res.status).toBe(404);
  });

  it("GET /api/blog: fires GA4 waitUntil with executionCtx", async () => {
    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [SAMPLE_ROW] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);
    const ctx = makeCtx();

    const res = await app.request(
      "/api/blog",
      {},
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    // waitUntil called for GA4 tracking
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("GET /api/blog/:slug: returns post via D1 fallback when cache throws", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(SAMPLE_ROW),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);

    const res = await app.request("/api/blog/hello-world", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ slug: string }>();
    expect(body.slug).toBe("hello-world");
  });

  it("GET /api/blog/:slug: returns 404 when cache throws and D1 returns null", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    const env = createMockEnv(); // DB returns null
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);

    const res = await app.request("/api/blog/missing-slug", {}, env);
    expect(res.status).toBe(404);
  });

  it("GET /api/blog/:slug: fires GA4 waitUntil with executionCtx", async () => {
    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(SAMPLE_ROW),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", blog);
    const ctx = makeCtx();

    const res = await app.request(
      "/api/blog/hello-world",
      {},
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });
});

// ── github-stars.ts coverage gaps ────────────────────────────────────────────

describe("github-stars.ts — cache throw fallback path", () => {
  let mockGlobalFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGlobalFetch = vi.fn();
    vi.stubGlobal("fetch", mockGlobalFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("falls back to direct fetch when withEdgeCache throws and returns stars", async () => {
    // Make withEdgeCache throw by making caches.default.match throw
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    // Direct GitHub API call returns ok
    mockGlobalFetch.mockResolvedValue(
      new Response(JSON.stringify({ stargazers_count: 42 }), { status: 200 }),
    );

    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", githubStars);

    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: number }>();
    expect(body.stars).toBe(42);
  });

  it("returns null stars when GitHub API returns non-ok in fallback", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    // GitHub API returns non-ok
    mockGlobalFetch.mockResolvedValue(new Response("{}", { status: 403 }));

    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", githubStars);

    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: null; error: string }>();
    expect(body.stars).toBeNull();
    expect(body.error).toContain("unavailable");
  });

  it("returns null stars when both cache and direct fetch throw", async () => {
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });
    mockGlobalFetch.mockRejectedValue(new Error("Network error"));

    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", githubStars);

    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: null }>();
    expect(body.stars).toBeNull();
  });
});

// ── sitemap.ts coverage gaps ──────────────────────────────────────────────────

describe("sitemap.ts — inner D1 catch path", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns fallback XML when both cache and D1 throw", async () => {
    // Make cache throw, and D1 prepare throw
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockRejectedValue(new Error("Cache unavailable")),
        put: vi.fn(),
      },
    });

    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error("D1 unavailable");
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", sitemap);

    const res = await app.request("/sitemap.xml", {}, env);
    // Should fallback to minimal sitemap (lines 80-84) or empty sitemap
    expect([200]).toContain(res.status);
    const text = await res.text();
    expect(text).toContain("<?xml");
  });
});

// ── r2.ts coverage gaps ───────────────────────────────────────────────────────

describe("r2.ts — waitUntil paths with executionCtx", () => {
  it("GET /r2/:key: fires GA4 waitUntil with executionCtx", async () => {
    const mockR2Object = {
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("data")); c.close(); } }),
      httpEtag: '"abc"',
      writeHttpMetadata: vi.fn((h: Headers) => h.set("content-type", "text/plain")),
    };

    const env = createMockEnv({
      R2: {
        get: vi.fn().mockResolvedValue(mockR2Object),
        delete: vi.fn(),
      } as unknown as R2Bucket,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);
    const ctx = makeCtx();

    const res = await app.request(
      "/r2/some/key",
      {},
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("POST /r2/upload: fires GA4 waitUntil with executionCtx", async () => {
    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);
    const ctx = makeCtx();

    const res = await app.request(
      "/r2/upload",
      {
        method: "POST",
        body: JSON.stringify({ key: "my-file.txt" }),
        headers: { "content-type": "application/json" },
      },
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(201);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("DELETE /r2/:key: fires GA4 waitUntil with executionCtx", async () => {
    const env = createMockEnv({
      R2: {
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
      } as unknown as R2Bucket,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);
    const ctx = makeCtx();

    const res = await app.request(
      "/r2/some-file.txt",
      { method: "DELETE" },
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });
});

// ── stripe-webhook.ts error handler paths ─────────────────────────────────────

async function makeStripeSignature(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("stripe-webhook.ts — error catch branches", () => {
  const secret = "whsec_test_secret_1234";

  it("handles invoice.paid error in catch block (lines 386-388)", async () => {
    const event = {
      id: "evt_invoice_paid",
      type: "invoice.paid",
      data: { object: { subscription: "sub_test_123", period_end: 9999999999 } },
    };
    const payload = JSON.stringify(event);
    const sig = await makeStripeSignature(payload, secret);

    const env = createMockEnv({
      STRIPE_WEBHOOK_SECRET: secret,
      DB: {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("webhook_events") || sql.includes("error_logs")) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          // UPDATE subscriptions throws to trigger the catch block
          throw new Error("DB error on UPDATE subscriptions");
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", stripeWebhook);
    const ctx = makeCtx();

    const res = await app.request(
      "/stripe/webhook",
      {
        method: "POST",
        body: payload,
        headers: {
          "stripe-signature": sig,
          "content-type": "application/json",
        },
      },
      env,
      ctx as unknown as ExecutionContext,
    );
    // Should return 200 (error is caught internally by the try/catch in invoice.paid handler)
    expect(res.status).toBe(200);
  });

  it("handles invoice.payment_failed error in catch block (lines 405-407)", async () => {
    const event = {
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_test_456" } },
    };
    const payload = JSON.stringify(event);
    const sig = await makeStripeSignature(payload, secret);

    const env = createMockEnv({
      STRIPE_WEBHOOK_SECRET: secret,
      DB: {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("webhook_events") || sql.includes("error_logs")) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          // UPDATE subscriptions throws
          throw new Error("DB error on UPDATE subscriptions");
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", stripeWebhook);
    const ctx = makeCtx();

    const res = await app.request(
      "/stripe/webhook",
      {
        method: "POST",
        body: payload,
        headers: {
          "stripe-signature": sig,
          "content-type": "application/json",
        },
      },
      env,
      ctx as unknown as ExecutionContext,
    );
    expect(res.status).toBe(200);
  });

  it("handles invoice.paid with non-subscription (subId null branch)", async () => {
    const event = {
      id: "evt_invoice_paid_nosub",
      type: "invoice.paid",
      data: { object: { subscription: null, period_end: 9999999999 } },
    };
    const payload = JSON.stringify(event);
    const sig = await makeStripeSignature(payload, secret);

    const env = createMockEnv({
      STRIPE_WEBHOOK_SECRET: secret,
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", stripeWebhook);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": sig,
        "content-type": "application/json",
      },
    }, env);
    expect(res.status).toBe(200);
  });

  it("handles invoice.payment_failed with non-subscription (subId null branch)", async () => {
    const event = {
      id: "evt_invoice_failed_nosub",
      type: "invoice.payment_failed",
      data: { object: { subscription: 12345 } }, // not a string
    };
    const payload = JSON.stringify(event);
    const sig = await makeStripeSignature(payload, secret);

    const env = createMockEnv({
      STRIPE_WEBHOOK_SECRET: secret,
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", stripeWebhook);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": sig,
        "content-type": "application/json",
      },
    }, env);
    expect(res.status).toBe(200);
  });
});

// ── cockpit.ts — null coalescence branches ────────────────────────────────────

describe("cockpit.ts — null value branches (lines 76-79)", () => {
  it("returns zeros when all DB metric rows are null", async () => {
    // DB returns admin email for user lookup, but null for all metric queries
    const ADMIN_EMAIL = "zoltan.erdos@spike.land";
    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("WHERE id = ?")) {
            // User lookup — return admin user
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue({ email: ADMIN_EMAIL }),
              all: vi.fn().mockResolvedValue({ results: [] }),
              run: vi.fn().mockResolvedValue({}),
            };
          }
          // All metric queries return null / empty
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({}),
          };
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });

    const app = new Hono<{ Bindings: Env }>();
    // Inject userId so auth check passes
    app.use("/api/cockpit/*", async (c, next) => {
      c.set("userId" as never, "user-admin" as never);
      await next();
    });
    app.route("/", cockpit);

    const res = await app.request("/api/cockpit/metrics", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ userCount: number; activeSubscriptions: number; toolCount: number; mrr: number }>();
    // All null DB rows → fallback to 0 via ?? operator
    expect(body.userCount).toBe(0);
    expect(body.activeSubscriptions).toBe(0);
    expect(body.toolCount).toBe(0);
    expect(body.mrr).toBe(0);
  });
});
