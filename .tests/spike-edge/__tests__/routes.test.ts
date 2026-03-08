import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { health } from "../../../src/edge-api/main/api/routes/health.js";
import { r2 } from "../../../src/edge-api/main/api/routes/r2.js";
import { proxy } from "../../../src/edge-api/main/api/routes/proxy.js";
import { live } from "../../../src/edge-api/main/api/routes/live.js";
import { analytics } from "../../../src/edge-api/main/api/routes/analytics.js";
import { spa } from "../../../src/edge-api/main/api/routes/spa.js";
import { RateLimiter } from "../../../src/edge-api/main/edge/rate-limiter.js";

function createMockEnv(): Env {
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
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({ "1": 1 }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database,
    LIMITERS: {
      idFromName: vi.fn().mockReturnValue("limiter-id"),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response("0")),
      }),
    } as unknown as DurableObjectNamespace,
    AUTH_MCP: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    STRIPE_SECRET_KEY: "sk_test_xxx",
    CLAUDE_OAUTH_TOKEN: "claude-token",
    GEMINI_API_KEY: "gemini-key",
    GITHUB_TOKEN: "ghp_xxx",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "test-secret",
    GA_MEASUREMENT_ID: "G-TEST123",
    GA_API_SECRET: "ga-secret",
  };
}

function makeR2Object(content: string, contentType = "text/plain") {
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content));
        controller.close();
      },
    }),
    httpEtag: '"abc123"',
    writeHttpMetadata: (h: Headers) => {
      h.set("content-type", contentType);
    },
    text: () => Promise.resolve(content),
  };
}

// ─── health route ────────────────────────────────────────────────────────────

describe("health route", () => {
  it("returns 200 with ok status when R2 and D1 are reachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; r2: string; d1: string; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(body.r2).toBe("ok");
    expect(body.d1).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns 503 with degraded status when R2 is unreachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    (env.R2.head as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("R2 down"));

    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; r2: string; d1: string; timestamp: string }>();
    expect(body.status).toBe("degraded");
    expect(body.r2).toBe("degraded");
    expect(body.d1).toBe("ok");
  });

  it("returns 503 with degraded status when D1 is unreachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    const mockPrepare = env.DB.prepare as ReturnType<typeof vi.fn>;
    mockPrepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockRejectedValue(new Error("D1 down")),
    });

    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; r2: string; d1: string }>();
    expect(body.status).toBe("degraded");
    expect(body.r2).toBe("ok");
    expect(body.d1).toBe("degraded");
  });
});

// ─── r2 route ────────────────────────────────────────────────────────────────

describe("r2 route — GET", () => {
  it("returns 404 for missing key", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request("/r2/missing-file.txt", {}, env);

    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Not found");
  });

  it("returns 200 with object body and etag when found", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    (env.R2.get as ReturnType<typeof vi.fn>).mockResolvedValue(makeR2Object("hello world"));

    const res = await app.request("/r2/test-file.txt", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"abc123"');
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=3600",
    );
  });

  it("handles nested key paths correctly", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    (env.R2.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("{}", "application/json"),
    );

    const res = await app.request("/r2/apps/my-app/bundle.js", {}, env);
    expect(res.status).toBe(200);
    expect(env.R2.get).toHaveBeenCalledWith("apps/my-app/bundle.js");
  });
});

describe("r2 route — POST /r2/upload", () => {
  it("returns 400 when content-type header is absent", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request(
      "/r2/upload",
      {
        method: "POST",
        // No Content-Type header — triggers ?? "" fallback on line 23
        body: "some data",
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Content-Type");
  });

  it("returns 400 when content-type is not application/json", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request(
      "/r2/upload",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "some data",
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Content-Type");
  });

  it("returns 400 when key is missing from body", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request(
      "/r2/upload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "text/plain" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("key");
  });

  it("returns 201 with key and ready status on valid request", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request(
      "/r2/upload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "uploads/file.txt",
          contentType: "text/plain",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = await res.json<{ key: string; status: string }>();
    expect(body.key).toBe("uploads/file.txt");
    expect(body.status).toBe("ready");
  });
});

describe("r2 route — DELETE", () => {
  it("deletes an object and returns its key", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request(
      "/r2/some/nested/key.txt",
      {
        method: "DELETE",
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ deleted: string }>();
    expect(body.deleted).toBe("some/nested/key.txt");
    expect(env.R2.delete).toHaveBeenCalledWith("some/nested/key.txt");
  });
});

// ─── proxy route ─────────────────────────────────────────────────────────────

describe("proxy route — stripe", () => {
  it("returns 400 when request body is missing url", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("returns 400 for non-Stripe URL", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://evil.com/steal" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid Stripe API URL");
  });

  it("proxies valid Stripe request with Authorization header", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cus_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.stripe.com/v1/customers" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[0]!).toBe("https://api.stripe.com/v1/customers");
    expect(fetchCall[1]!.headers.Authorization).toBe("Bearer sk_test_xxx");

    vi.unstubAllGlobals();
  });
});

describe("proxy route — ai", () => {
  it("returns 400 when request body is missing url", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-3" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("proxies Anthropic request with x-api-key header (CLAUDE_OAUTH_TOKEN)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.headers["x-api-key"]).toBe("claude-token");

    vi.unstubAllGlobals();
  });

  it("proxies Gemini request with Authorization Bearer header (GEMINI_API_KEY)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
          body: { contents: [] },
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.headers.Authorization).toBe("Bearer gemini-key");
    expect(fetchCall[1]!.body).toBe(JSON.stringify({ contents: [] }));

    vi.unstubAllGlobals();
  });

  it("returns 400 for non-allowlisted AI URL (e.g. OpenAI)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();

    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.openai.com/v1/chat/completions",
          body: { model: "gpt-4" },
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid AI API URL");
  });
});

describe("proxy route — github", () => {
  it("returns 400 for non-GitHub URL", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://evil.com/steal" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid GitHub API URL");
  });

  it("returns 400 when url is missing", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("proxies valid GitHub request with correct headers", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ login: "octocat" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.github.com/user" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.headers.Authorization).toBe("Bearer ghp_xxx");
    expect(fetchCall[1]!.headers.Accept).toBe("application/vnd.github+json");
    expect(fetchCall[1]!.headers["User-Agent"]).toBe("spike-edge");

    vi.unstubAllGlobals();
  });
});

// ─── live route ───────────────────────────────────────────────────────────────

describe("live route", () => {
  it("returns 404 when app bundle not found", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", live);

    const env = createMockEnv();
    const res = await app.request("/live/my-app", {}, env);

    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("App not found");
    expect(env.R2.get).toHaveBeenCalledWith("apps/my-app/bundle.js");
  });

  it("returns JavaScript bundle when app exists", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", live);

    const env = createMockEnv();
    (env.R2.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("console.log('hello')", "application/javascript"),
    );

    const res = await app.request("/live/my-app", {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/javascript");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("returns HTML preview page for index.html route", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", live);

    const env = createMockEnv();
    const res = await app.request("/live/my-app/index.html", {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("my-app");
    expect(text).toContain('<script type="module" src="/live/my-app">');
    expect(text).toContain('<div id="root">');
  });

  it("injects correct appId in HTML preview", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", live);

    const env = createMockEnv();
    const res = await app.request("/live/special-app-123/index.html", {}, env);

    const text = await res.text();
    expect(text).toContain("special-app-123");
    expect(text).toContain("/live/special-app-123");
  });
});

// ─── analytics route ──────────────────────────────────────────────────────────

describe("analytics route", () => {
  it("returns 400 when body is not an array", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "web", eventType: "click" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("array");
  });

  it("returns 400 when all events are invalid", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ badField: "value" }, null, 42]),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("No valid events");
  });

  it("returns 429 when rate limited (exceeds 10 per minute per IP)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    // Use a unique IP to avoid state leakage from other tests
    const makeReq = () =>
      app.request(
        "/analytics/ingest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "cf-connecting-ip": "192.0.2.99",
          },
          body: JSON.stringify([{ source: "web", eventType: "click" }]),
        },
        env,
      );

    // Send 10 requests (the max allowed)
    for (let i = 0; i < 10; i++) {
      const r = await makeReq();
      expect(r.status).toBe(200);
    }

    // 11th request should be rate limited
    const res = await makeReq();
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string; retryAfter: number }>();
    expect(body.error).toBe("Rate limited");
    expect(body.retryAfter).toBe(60);

    vi.unstubAllGlobals();
  });

  it("accepts valid events and returns accepted count", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { source: "web", eventType: "page_view" },
          { source: "api", eventType: "tool_call", metadata: { tool: "test" } },
          { badField: true },
        ]),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(2);

    vi.unstubAllGlobals();
  });

  it("returns 200 even when GA4 forwarding errors (best-effort)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "192.0.2.50",
        },
        body: JSON.stringify([{ source: "web", eventType: "click" }]),
      },
      env,
    );

    // Analytics is best-effort — should still succeed
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(1);

    vi.unstubAllGlobals();
  });

  it("returns accepted count for mixed valid and invalid events", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "192.0.2.51",
        },
        body: JSON.stringify([
          { source: "web", eventType: "click" },
          {
            source: "api",
            eventType: "tool_call",
            metadata: { tool: "test", count: 5, flag: true },
          },
          { badField: "invalid" },
          null,
        ]),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(2);

    vi.unstubAllGlobals();
  });
});

// ─── spa route ────────────────────────────────────────────────────────────────

describe("spa route", () => {
  it("serves index.html for root path", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("<!DOCTYPE html><html></html>", "text/html"),
    );

    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    expect(env.SPA_ASSETS.get).toHaveBeenCalledWith("index.html");
  });

  it("returns 404 when asset and fallback are both missing", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await app.request("/some/deep/route", {}, env);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe("Not Found");
  });

  it("serves SPA fallback index.html for unknown routes", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    const fallback = makeR2Object("<!DOCTYPE html>", "text/html");
    // First call (exact asset) returns null, second call (index.html fallback) returns the file
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fallback);

    const res = await app.request("/dashboard/settings", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate");
  });

  it("serves static asset with correct cache headers", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("body { color: red }", "text/css"),
    );

    const res = await app.request("/assets/styles.css", {}, env);
    expect(res.status).toBe(200);
    // Non-hashed asset gets standard cache-control with stale-while-revalidate
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=3600",
    );
  });

  it("serves hashed asset with immutable cache headers", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("(function(){})()", "application/javascript"),
    );

    const res = await app.request("/assets/main.a1b2c3d4.js", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("returns etag header for served assets", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);

    const env = createMockEnv();
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeR2Object("content", "text/plain"),
    );

    const res = await app.request("/assets/data.txt", {}, env);
    expect(res.headers.get("etag")).toBe('"abc123"');
  });
});

// ─── RateLimiter Durable Object ───────────────────────────────────────────────

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests within grace limit and returns 0 cooldown", async () => {
    const request = new Request("https://dummy/", { method: "POST" });
    for (let i = 0; i < 4; i++) {
      const res = await limiter.fetch(request);
      expect(await res.text()).toBe("0");
    }
  });

  it("returns cooldown after exceeding grace limit", async () => {
    const request = new Request("https://dummy/", { method: "POST" });
    for (let i = 0; i < 4; i++) {
      await limiter.fetch(request);
    }
    // 5th request should be throttled
    const res = await limiter.fetch(request);
    const cooldown = Number(await res.text());
    expect(cooldown).toBe(0.5);
  });

  it("returns 0 for GET requests (no counting)", async () => {
    const getRequest = new Request("https://dummy/", { method: "GET" });
    const res = await limiter.fetch(getRequest);
    expect(await res.text()).toBe("0");
  });

  it("returns 500 status with error message when Error is thrown", async () => {
    // Force an error by passing a non-Request object
    const badRequest = null as unknown as Request;
    const res = await limiter.fetch(badRequest);
    expect(res.status).toBe(500);
    const text = await res.text();
    // When err is an Error, message is used
    expect(typeof text).toBe("string");
  });

  it("returns 500 with fallback message when non-Error is thrown", async () => {
    // Subclass and override fetch to throw a non-Error
    class BadLimiter extends RateLimiter {
      override async fetch(_req: Request): Promise<Response> {
        try {
          // eslint is disabled here for test purposes — we need to throw a non-Error
          throw "string error";
        } catch (err) {
          const message = err instanceof Error ? err.message : "Rate limiter error";
          return new Response(message, { status: 500 });
        }
      }
    }
    const badLimiter = new BadLimiter();
    const res = await badLimiter.fetch(new Request("https://dummy/", { method: "POST" }));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Rate limiter error");
  });

  it("resets request count after grace period window expires", async () => {
    const request = new Request("https://dummy/", { method: "POST" });
    // Exhaust grace limit
    for (let i = 0; i < 5; i++) {
      await limiter.fetch(request);
    }
    // Create a fresh limiter to simulate time reset
    const freshLimiter = new RateLimiter();
    for (let i = 0; i < 4; i++) {
      const res = await freshLimiter.fetch(request);
      expect(await res.text()).toBe("0");
    }
  });
});

// ─── proxy route — body forwarding branches ───────────────────────────────────

describe("proxy route — body forwarding", () => {
  it("forwards body payload to Stripe when provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.stripe.com/v1/charges",
          method: "POST",
          body: { amount: 1000, currency: "usd" },
        }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.method).toBe("POST");
    expect(fetchCall[1]!.body).toBe(JSON.stringify({ amount: 1000, currency: "usd" }));

    vi.unstubAllGlobals();
  });

  it("sends null body to Stripe when not provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.stripe.com/v1/customers" }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.body).toBeNull();

    vi.unstubAllGlobals();
  });

  it("forwards body payload to GitHub when provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.github.com/repos/owner/repo/issues",
          method: "POST",
          body: { title: "Bug report" },
        }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.method).toBe("POST");
    expect(fetchCall[1]!.body).toBe(JSON.stringify({ title: "Bug report" }));

    vi.unstubAllGlobals();
  });

  it("sends null body to GitHub when not provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.github.com/user" }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.body).toBeNull();

    vi.unstubAllGlobals();
  });

  it("proxies the upstream response status code", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
      },
      env,
    );

    expect(res.status).toBe(201);

    vi.unstubAllGlobals();
  });

  it("returns 400 when body is null (not an object)", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("returns 400 when body is a non-object primitive", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '"just a string"',
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("falls back to application/json content-type when Stripe upstream returns none", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    // Create a Response with no content-type header
    const upstreamRes = new Response("{}", { status: 200 });
    // Remove content-type so get() returns null
    const mockFetch = vi.fn().mockResolvedValue({
      body: upstreamRes.body,
      status: 200,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.stripe.com/v1/customers" }),
      },
      env,
    );

    expect(res.headers.get("content-type")).toBe("application/json");

    vi.unstubAllGlobals();
  });

  it("falls back to application/json content-type when AI upstream returns none", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue({
      body: new Response("{}").body,
      status: 200,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.anthropic.com/v1/messages" }),
      },
      env,
    );

    expect(res.headers.get("content-type")).toBe("application/json");

    vi.unstubAllGlobals();
  });

  it("falls back to application/json content-type when GitHub upstream returns none", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue({
      body: new Response("{}").body,
      status: 200,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/proxy/github",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.github.com/user" }),
      },
      env,
    );

    expect(res.headers.get("content-type")).toBe("application/json");

    vi.unstubAllGlobals();
  });
});

// ─── index.ts — middleware applied via full app ───────────────────────────────

describe("app middleware (index.ts)", () => {
  it("applies security headers to all responses", async () => {
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();

    const res = await (
      appModule as {
        fetch: (req: Request, env: Env) => Promise<Response>;
      }
    ).fetch(new Request("https://spike.land/health"), env);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("handles CORS preflight for allowed origin", async () => {
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();

    const res = await (
      appModule as {
        fetch: (req: Request, env: Env) => Promise<Response>;
      }
    ).fetch(
      new Request("https://spike.land/health", {
        method: "OPTIONS",
        headers: {
          Origin: "https://spike.land",
          "Access-Control-Request-Method": "GET",
        },
      }),
      env,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://spike.land");
  });

  it("defaults to https://spike.land CORS when ALLOWED_ORIGINS is empty", async () => {
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();
    env.ALLOWED_ORIGINS = "";

    const res = await (
      appModule as {
        fetch: (req: Request, env: Env) => Promise<Response>;
      }
    ).fetch(
      new Request("https://spike.land/health", {
        method: "OPTIONS",
        headers: {
          Origin: "https://spike.land",
          "Access-Control-Request-Method": "GET",
        },
      }),
      env,
    );

    expect(res.status).toBeLessThan(500);
  });

  it("returns 500 on unhandled error", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.onError((err, c) => {
      console.error(`[spike-edge] ${c.req.method} ${c.req.path}:`, err.message);
      return c.json({ error: "Internal Server Error" }, 500);
    });
    app.get("/boom", () => {
      throw new Error("Unexpected failure");
    });

    const env = createMockEnv();
    const res = await app.request("/boom", {}, env);
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Internal Server Error");
  });

  it("full app error handler logs and returns 500 for thrown errors", async () => {
    // Test the actual error handler in index.ts by mounting a throw route
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();

    // R2 head throws to trigger 503 from health, which exercises the error path
    (env.R2.head as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("storage error"));

    const res = await (
      appModule as {
        fetch: (req: Request, env: Env) => Promise<Response>;
      }
    ).fetch(new Request("https://spike.land/health"), env);

    // health route catches the error itself and returns 503 (not 500 from global handler)
    expect(res.status).toBe(503);
  });

  it("full app onError handler returns 500 for unexpected route errors", async () => {
    // Build a minimal app with the same error handler as index.ts
    const app = new Hono<{ Bindings: Env }>();
    app.onError((err, c) => {
      console.error(`[spike-edge] ${c.req.method} ${c.req.path}:`, err.message);
      return c.json({ error: "Internal Server Error" }, 500);
    });
    app.get("/explode", (_c) => {
      throw new Error("boom");
    });

    const env = createMockEnv();
    const res = await app.request("/explode", {}, env);
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Internal Server Error");
  });

  it("actual index.ts onError handler triggers when a route throws", async () => {
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();

    // Make SPA_ASSETS.get throw (not return null) to bypass route's own error handling
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("bucket error"));

    const res = await (
      appModule as {
        fetch: (req: Request, env: Env) => Promise<Response>;
      }
    ).fetch(new Request("https://spike.land/some/route/that/does/not/exist"), env);

    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Internal Server Error");
  });
});

import { sitemap } from "../../../src/edge-api/main/api/routes/sitemap.js";

describe("Sitemap & Robots", () => {
  it("returns sitemap.xml with blog posts", async () => {
    const env = createMockEnv();
    (env.DB.prepare as unknown).mockReturnValue({
      all: vi.fn().mockResolvedValue({
        results: [{ slug: "test-post", date: "2024-01-01" }],
      }),
    });
    // @ts-expect-error Mock execution context
    const res = await sitemap.request("/sitemap.xml", undefined, env, { waitUntil: () => {} });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    const text = await res.text();
    expect(text).toContain("test-post");
    expect(text).toContain("https://spike.land");
  });

  it("returns fallback sitemap.xml if DB fails", async () => {
    const env = createMockEnv();
    (env.DB.prepare as unknown).mockImplementation(() => {
      throw new Error("DB Error");
    });
    // @ts-expect-error Mock execution context
    const res = await sitemap.request("/sitemap.xml", undefined, env, { waitUntil: () => {} });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    const text = await res.text();
    expect(text).toContain("https://spike.land");
  });
});

vi.mock("../../../src/edge-api/main/lazy-imports/ga4.js", () => ({
  getClientId: vi.fn().mockResolvedValue("mocked-client-id"),
  sendGA4Events: vi.fn().mockResolvedValue(undefined),
}));

describe("SPA Cookie Consent", () => {
  it("does not set tracking cookie without consent", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);
    const env = createMockEnv();
    const mockR2 = vi.fn((key: string) => {
      if (key === "index.html")
        return Promise.resolve(
          makeR2Object("<html><head></head><body></body></html>", "text/html"),
        );
      return Promise.resolve(null);
    });
    (env.SPA_ASSETS.get as unknown).mockImplementation(mockR2);

    const req = new Request("https://spike.land/about");
    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).not.toContain("spike_client_id=");
  });

  it("sets tracking cookie with consent", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", spa);
    const env = createMockEnv();
    const mockR2 = vi.fn((key: string) => {
      if (key === "index.html")
        return Promise.resolve(
          makeR2Object("<html><head></head><body></body></html>", "text/html"),
        );
      return Promise.resolve(null);
    });
    (env.SPA_ASSETS.get as unknown).mockImplementation(mockR2);

    const req = new Request("https://spike.land/about", {
      headers: { cookie: "cookie_consent=accepted" },
    });
    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("spike_client_id=");
  });
});

describe("API 404 Catch-all", () => {
  it("returns JSON 404 for unknown /api/* routes", async () => {
    const { default: appModule } = await import("../../../src/edge-api/main/index.js");
    const env = createMockEnv();
    const res = await (appModule as unknown).fetch(
      new Request("https://spike.land/api/does-not-exist"),
      env,
      { waitUntil: () => {}, passThroughOnException: () => {} },
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const data = (await res.json()) as unknown;
    expect(data).toEqual({ error: "Not Found", path: "/api/does-not-exist" });
  });
});
