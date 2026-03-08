import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { version } from "../../../src/edge-api/main/api/routes/version.js";
import { wellKnown } from "../../../src/edge-api/main/api/routes/well-known.js";
import { sitemap } from "../../../src/edge-api/main/api/routes/sitemap.js";
import { githubStars } from "../../../src/edge-api/main/api/routes/github-stars.js";
import { docsApi } from "../../../src/edge-api/main/api/routes/docs-api.js";
import { userProfile } from "../../../src/edge-api/main/api/routes/user-profile.js";
import { billing } from "../../../src/edge-api/main/api/routes/billing.js";
import { apiKeys } from "../../../src/edge-api/main/api/routes/api-keys.js";
import { cockpit } from "../../../src/edge-api/main/api/routes/cockpit.js";
import { credits } from "../../../src/edge-api/main/api/routes/credits.js";
import { support } from "../../../src/edge-api/main/api/routes/support.js";
import { errors } from "../../../src/edge-api/main/api/routes/errors.js";

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    } as unknown as R2Bucket,
    SPA_ASSETS: {
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    } as unknown as R2Bucket,
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

function makeApp<T extends Hono>(route: T): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", route);
  return app;
}

function withUser(userId: string) {
  return (app: Hono<{ Bindings: Env }>) => {
    const wrapped = new Hono<{ Bindings: Env }>();
    wrapped.use("*", async (c, next) => {
      c.set("userId" as never, userId as never);
      await next();
    });
    wrapped.route("/", app as unknown as Hono<{ Bindings: Env }>);
    return wrapped;
  };
}

// ─── version route ────────────────────────────────────────────────────────────

describe("version route", () => {
  it("returns version info when no index.html found", async () => {
    const app = makeApp(version as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/version", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ sha: string; buildTime: string }>();
    expect(body.sha).toBe("unknown");
    expect(body.buildTime).toBe("unknown");
  });

  it("extracts sha and buildTime from index.html meta tags", async () => {
    const html = `<html><head>
      <meta name="build-sha" content="abc123def">
      <meta name="build-time" content="2026-03-05T00:00:00Z">
    </head></html>`;

    const spaAssetsGet = vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(html),
    });

    const env = createMockEnv({
      SPA_ASSETS: {
        get: spaAssetsGet,
        list: vi.fn().mockResolvedValue({
          objects: [
            { key: "index.html", size: 1000, etag: "abc", uploaded: new Date() },
            { key: "builds/abc123def/app.js", size: 500, etag: "def", uploaded: new Date() },
          ],
          truncated: false,
        }),
      } as unknown as R2Bucket,
    });

    const app = makeApp(version as unknown as Hono);
    const res = await app.request("/api/version", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ sha: string; buildTime: string; rollbackShas: string[] }>();
    expect(body.sha).toBe("abc123def");
    expect(body.buildTime).toBe("2026-03-05T00:00:00Z");
    expect(body.rollbackShas).toContain("abc123def");
  });

  it("handles paginated listing with cursor", async () => {
    let listCallCount = 0;
    const spaList = vi.fn().mockImplementation(() => {
      listCallCount++;
      if (listCallCount === 1) {
        return Promise.resolve({
          objects: [{ key: "page1.js", size: 100, etag: "e1", uploaded: new Date() }],
          truncated: true,
          cursor: "cursor-abc",
        });
      }
      return Promise.resolve({
        objects: [{ key: "page2.js", size: 200, etag: "e2", uploaded: new Date() }],
        truncated: false,
      });
    });

    const env = createMockEnv({
      SPA_ASSETS: { get: vi.fn().mockResolvedValue(null), list: spaList } as unknown as R2Bucket,
    });

    const app = makeApp(version as unknown as Hono);
    const res = await app.request("/api/version", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ assets: Array<{ key: string }> }>();
    expect(body.assets.length).toBe(2);
    expect(spaList).toHaveBeenCalledTimes(2);
  });
});

// ─── well-known route ─────────────────────────────────────────────────────────

describe("well-known route", () => {
  it("returns security.txt with contact info", async () => {
    const app = makeApp(wellKnown as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/.well-known/security.txt", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Contact: mailto:zoltan.erdos@spike.land");
    expect(text).toContain("Expires:");
    expect(text).toContain("Canonical: https://spike.land/.well-known/security.txt");
  });
});

// ─── sitemap route ────────────────────────────────────────────────────────────

describe("sitemap route", () => {
  it("returns sitemap XML with static routes", async () => {
    const app = makeApp(sitemap as unknown as Hono);
    const env = createMockEnv();
    // withEdgeCache throws in test env (no Cache API) — fallback path
    const res = await app.request("/sitemap.xml", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<?xml");
    expect(text).toContain("spike.land");
  });

  it("includes blog posts in sitemap", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [{ slug: "my-post", date: "2026-01-01" }],
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const env = createMockEnv({ DB: db });
    const app = makeApp(sitemap as unknown as Hono);
    const res = await app.request("/sitemap.xml", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("/blog/my-post");
  });

  it("returns robots.txt", async () => {
    const app = makeApp(sitemap as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/robots.txt", {}, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Sitemap: https://spike.land/sitemap.xml");
  });
});

// ─── github-stars route ───────────────────────────────────────────────────────

describe("github-stars route", () => {
  it("returns null stars when GitHub API unavailable", async () => {
    // withEdgeCache throws => fallback => fetch fails
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const app = makeApp(githubStars as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: null; error: string }>();
    expect(body.stars).toBeNull();
  });

  it("returns star count when GitHub API succeeds", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ stargazers_count: 42 }), { status: 200 }));

    const app = makeApp(githubStars as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: number }>();
    expect(body.stars).toBe(42);
  });

  it("handles GitHub API non-ok response in fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));

    const app = makeApp(githubStars as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/github/stars", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ stars: null }>();
    expect(body.stars).toBeNull();
  });
});

// ─── docs-api route ───────────────────────────────────────────────────────────

describe("docs-api route", () => {
  it("lists all docs grouped by category", async () => {
    const app = makeApp(docsApi as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/docs", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{
      categories: Array<{ category: string; docs: unknown[] }>;
      total: number;
    }>();
    expect(body.total).toBeGreaterThan(0);
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);
  });

  it("returns doc by slug", async () => {
    const app = makeApp(docsApi as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/docs/getting-started", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ slug: string; content: string }>();
    expect(body.slug).toBe("getting-started");
    expect(body.content).toContain("# Getting Started");
  });

  it("returns 404 for unknown doc slug", async () => {
    const app = makeApp(docsApi as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/docs/nonexistent-doc", {}, env);
    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Document not found");
  });
});

// ─── user-profile route ───────────────────────────────────────────────────────

describe("user-profile route", () => {
  it("returns 401 when no userId in context", async () => {
    const app = makeApp(userProfile as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: JSON.stringify({ name: "Alice" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const base = makeApp(userProfile as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when name is not provided", async () => {
    const base = makeApp(userProfile as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("name is required");
  });

  it("updates name successfully", async () => {
    const base = makeApp(userProfile as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: JSON.stringify({ name: "Alice" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it("returns 400 when only email provided (email changes blocked)", async () => {
    const base = makeApp(userProfile as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Email cannot be changed");
  });

  it("returns 400 when email provided alongside name (email changes blocked)", async () => {
    const base = makeApp(userProfile as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/user/profile",
      {
        method: "POST",
        body: JSON.stringify({ name: "Bob", email: "bob@example.com" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Email cannot be changed");
  });
});

// ─── billing route ────────────────────────────────────────────────────────────

describe("billing route", () => {
  it("returns 401 for GET billing/status when no userId", async () => {
    const app = makeApp(billing as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/billing/status", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns free plan when no subscription row found", async () => {
    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/api/billing/status", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ plan: string }>();
    expect(body.plan).toBe("free");
  });

  it("returns subscription info when row exists", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          plan: "pro",
          status: "active",
          current_period_end: 9999999,
          usage_count: 5,
          stripe_customer_id: "cus_123",
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/billing/status", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ plan: string; usage: number }>();
    expect(body.plan).toBe("pro");
    expect(body.usage).toBe(5);
  });

  it("returns 401 for POST billing/cancel when no userId", async () => {
    const app = makeApp(billing as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/billing/cancel", { method: "POST" }, env);
    expect(res.status).toBe(401);
  });

  it("returns 404 when no active subscription for cancel", async () => {
    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/api/billing/cancel", { method: "POST" }, env);
    expect(res.status).toBe(404);
  });

  it("returns billing portal URL when Stripe succeeds", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ stripe_customer_id: "cus_123" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://billing.stripe.com/session/abc" }), {
        status: 200,
      }),
    );

    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/billing/cancel", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ url: string }>();
    expect(body.url).toContain("billing.stripe.com");
  });

  it("returns 502 when Stripe fails", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ stripe_customer_id: "cus_fail" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "stripe error" }), { status: 500 }));

    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/billing/cancel", { method: "POST" }, env);
    expect(res.status).toBe(502);
  });

  it("returns 502 when Stripe response has no URL", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ stripe_customer_id: "cus_no_url" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "sess_123" /* no url */ }), { status: 200 }),
      );

    const base = makeApp(billing as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/billing/cancel", { method: "POST" }, env);
    expect(res.status).toBe(502);
  });
});

// ─── api-keys route ───────────────────────────────────────────────────────────

describe("api-keys route", () => {
  it("returns 401 for GET /api/keys when no userId", async () => {
    const app = makeApp(apiKeys as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/keys", {}, env);
    expect(res.status).toBe(401);
  });

  it("lists masked API keys", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "key1",
              provider: "openai",
              encrypted_key: "sk-abcdefgh1234",
              created_at: "2026-01-01",
            },
          ],
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ keys: Array<{ key: string }> }>();
    expect(body.keys[0].key).toContain("*");
    expect(body.keys[0].key).toContain("1234"); // last 4 chars visible
  });

  it("creates a new API key", async () => {
    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/keys",
      {
        method: "POST",
        body: JSON.stringify({ provider: "openai", apiKey: "sk-newkey" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json<{ id: string; provider: string }>();
    expect(body.provider).toBe("openai");
  });

  it("returns 400 when provider or encryptedKey missing", async () => {
    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/keys",
      {
        method: "POST",
        body: JSON.stringify({ provider: "openai" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON on POST", async () => {
    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request(
      "/api/keys",
      {
        method: "POST",
        body: "bad json",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("deletes API key when ownership verified", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: "key1" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys/key1", { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it("returns 404 when deleting non-existent key", async () => {
    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/api/keys/nonexistent", { method: "DELETE" }, env);
    expect(res.status).toBe(404);
  });

  it("tests openai key — valid", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ provider: "openai", encrypted_key: "sk-test" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys/key1/test", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ valid: boolean }>();
    expect(body.valid).toBe(true);
  });

  it("tests anthropic key — invalid", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ provider: "anthropic", encrypted_key: "bad-key" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys/key1/test", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ valid: boolean; status: number }>();
    expect(body.valid).toBe(false);
    expect(body.status).toBe(401);
  });

  it("tests gemini key — uses query param", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ provider: "gemini", encrypted_key: "gem-key" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys/key1/test", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ valid: boolean }>();
    expect(body.valid).toBe(true);
    // Verify gemini uses query param (URL contains ?key=)
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("key=gem-key");
  });

  it("returns 404 for test when key not found", async () => {
    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/api/keys/no-key/test", { method: "POST" }, env);
    expect(res.status).toBe(404);
  });

  it("returns 400 for unsupported provider in test", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ provider: "unknown-provider", encrypted_key: "key" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys/key1/test", { method: "POST" }, env);
    expect(res.status).toBe(400);
  });

  it("returns 401 for DELETE when no userId", async () => {
    const app = makeApp(apiKeys as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/keys/key1", { method: "DELETE" }, env);
    expect(res.status).toBe(401);
  });

  it("masks short keys as ****", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            { id: "key2", provider: "test", encrypted_key: "abc", created_at: "2026-01-01" },
          ],
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(apiKeys as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/keys", {}, env);
    const body = await res.json<{ keys: Array<{ key: string }> }>();
    expect(body.keys[0].key).toBe("****");
  });
});

// ─── cockpit route ────────────────────────────────────────────────────────────

describe("cockpit route", () => {
  it("returns 401 when no userId", async () => {
    const app = makeApp(cockpit as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request("/api/cockpit/metrics", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ email: "other@example.com" }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(cockpit as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/cockpit/metrics", {}, env);
    expect(res.status).toBe(403);
  });

  it("returns metrics for admin user", async () => {
    let callIdx = 0;
    const responses = [
      { email: "zoltan.erdos@spike.land" }, // userRow
      { count: 100 }, // userCount
      { count: 5 }, // activeSubs
      { count: 80 }, // toolCount
      { mrr: 500 }, // mrr
      { results: [{ id: "u1", email: "test@test.com", created_at: "2026-01-01" }] }, // recentSignups
    ];

    const db = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          return Promise.resolve(responses[callIdx++] ?? null);
        }),
        all: vi.fn().mockResolvedValue({
          results: [{ id: "u1", email: "test@test.com", created_at: "2026-01-01" }],
        }),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(cockpit as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "admin1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/cockpit/metrics", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ userCount: number }>();
    expect(typeof body.userCount).toBe("number");
  });

  it("returns 403 when user row not found", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // no user row
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const base = makeApp(cockpit as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv({ DB: db });
    const res = await app.request("/api/cockpit/metrics", {}, env);
    expect(res.status).toBe(403);
  });
});

// ─── support route ────────────────────────────────────────────────────────────

describe("support route", () => {
  it("returns 400 for invalid JSON on fistbump", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug or clientId missing", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("records fistbump successfully", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        first: vi.fn().mockResolvedValue({ cnt: 1 }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv({ DB: db });
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post", clientId: "client-abc" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ count: number }>();
    expect(body.count).toBe(1);
  });

  it("returns alreadyBumped when UNIQUE constraint fires", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error("UNIQUE constraint failed")),
        first: vi.fn().mockResolvedValue({ cnt: 5 }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv({ DB: db });
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post", clientId: "client-abc" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ alreadyBumped: boolean; count: number }>();
    expect(body.alreadyBumped).toBe(true);
    expect(body.count).toBe(5);
  });

  it("returns 500 on other DB errors for fistbump", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error("DB crashed")),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv({ DB: db });
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post", clientId: "client-abc" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 for slug too long in fistbump", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const longSlug = "a".repeat(201);
    const res = await app.request(
      "/api/support/fistbump",
      {
        method: "POST",
        body: JSON.stringify({ slug: longSlug, clientId: "client" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns engagement stats", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ cnt: 3 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as unknown as D1Database,
    });
    const res = await app.request("/api/support/engagement/my-post", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ fistBumps: number; supporters: number }>();
    expect(typeof body.fistBumps).toBe("number");
  });

  it("returns 400 for invalid slug in engagement", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const longSlug = "a".repeat(201);
    const res = await app.request(`/api/support/engagement/${longSlug}`, {}, env);
    expect(res.status).toBe(400);
  });

  it("returns 503 for donate when no Stripe key", async () => {
    const env = createMockEnv({ STRIPE_SECRET_KEY: "" });
    const app = makeApp(support as unknown as Hono);
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: JSON.stringify({ slug: "post", amount: 5, clientId: "c" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid amount in donate", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: JSON.stringify({ slug: "post", amount: 0, clientId: "c" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Amount must be between");
  });

  it("creates donation checkout session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/session", id: "cs_123" }), {
        status: 200,
      }),
    );

    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post", amount: 10, clientId: "c" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ url: string }>();
    expect(body.url).toContain("stripe.com");
  });

  it("returns 400 for invalid slug in donate", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: JSON.stringify({ slug: "a".repeat(201), amount: 5 }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 502 when Stripe fails for donate", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "stripe down" }), { status: 500 }));

    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: JSON.stringify({ slug: "my-post", amount: 5 }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(502);
  });

  it("returns 400 for invalid JSON in donate", async () => {
    const app = makeApp(support as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/api/support/donate",
      {
        method: "POST",
        body: "bad json",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

// ─── errors route ─────────────────────────────────────────────────────────────

describe("errors route", () => {
  it("accepts valid error log batch", async () => {
    const app = makeApp(errors as unknown as Hono);
    const env = createMockEnv();
    const batch = [
      { service_name: "test-svc", message: "Something went wrong", severity: "error" },
    ];
    const res = await app.request(
      "/errors/ingest",
      {
        method: "POST",
        body: JSON.stringify(batch),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(1);
  });

  it("returns 400 when body is not an array", async () => {
    const app = makeApp(errors as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/errors/ingest",
      {
        method: "POST",
        body: JSON.stringify({ service_name: "x", message: "y" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when all entries are invalid", async () => {
    const app = makeApp(errors as unknown as Hono);
    const env = createMockEnv();
    const res = await app.request(
      "/errors/ingest",
      {
        method: "POST",
        body: JSON.stringify([{ message: "missing service_name" }]),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("filters out invalid entries and accepts valid ones", async () => {
    const app = makeApp(errors as unknown as Hono);
    const env = createMockEnv();
    const batch = [
      { service_name: "svc", message: "valid" },
      { message: "no service_name — invalid" },
    ];
    const res = await app.request(
      "/errors/ingest",
      {
        method: "POST",
        body: JSON.stringify(batch),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(1);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const app = makeApp(errors as unknown as Hono);
    const env = createMockEnv();
    const batch = [{ service_name: "svc", message: "msg" }];

    // Send 11 requests from same IP to trigger rate limit
    for (let i = 0; i < 10; i++) {
      await app.request(
        "/errors/ingest",
        {
          method: "POST",
          body: JSON.stringify(batch),
          headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.99" },
        },
        env,
      );
    }

    const res = await app.request(
      "/errors/ingest",
      {
        method: "POST",
        body: JSON.stringify(batch),
        headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.99" },
      },
      env,
    );
    expect(res.status).toBe(429);
  });

  it("lists errors with GET /errors", async () => {
    const base = makeApp(errors as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/errors", {}, env);
    expect(res.status).toBe(200);
  });

  it("lists errors with service filter", async () => {
    const base = makeApp(errors as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const env = createMockEnv();
    const res = await app.request("/errors?service=spike-edge&range=7d&limit=10", {}, env);
    expect(res.status).toBe(200);
  });

  it("returns error summary", async () => {
    const base = makeApp(errors as unknown as Hono);
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.set("userId" as never, "user1" as never);
      await next();
    });
    app.route("/", base);

    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ total: 42 }),
        all: vi.fn().mockResolvedValue({ results: [{ error_code: "ERR_001", count: 10 }] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const env = createMockEnv({ DB: db });
    const res = await app.request("/errors/summary?range=1h", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ total: number; range: string }>();
    expect(body.range).toBe("1h");
  });
});
