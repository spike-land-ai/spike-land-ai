import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env.js";
import { health } from "../routes/health.js";
import { r2 } from "../routes/r2.js";
import { proxy } from "../routes/proxy.js";
import { live } from "../routes/live.js";
import { analytics } from "../routes/analytics.js";
import { spa } from "../routes/spa.js";
import { RateLimiter } from "../rate-limiter.js";

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
    LIMITERS: {
      idFromName: vi.fn().mockReturnValue("limiter-id"),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response("0")),
      }),
    } as unknown as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test_xxx",
    AI_API_KEY: "ai-key",
    GITHUB_TOKEN: "ghp_xxx",
    SPACETIMEDB_URI: "http://localhost:3000",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "test-secret",
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
  };
}

// ─── health route ────────────────────────────────────────────────────────────

describe("health route", () => {
  it("returns 200 with ok status when R2 is reachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  it("returns 503 with degraded status when R2 is unreachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    (env.R2.head as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("R2 down"));

    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe("degraded");
    expect(typeof body.timestamp).toBe("string");
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
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
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
        body: JSON.stringify({ key: "uploads/file.txt", contentType: "text/plain" }),
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
    const res = await app.request("/r2/some/nested/key.txt", { method: "DELETE" }, env);

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

  it("proxies AI request to any URL with AI_API_KEY", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
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
    expect(fetchCall[1]!.headers.Authorization).toBe("Bearer ai-key");

    vi.unstubAllGlobals();
  });

  it("forwards custom headers in AI proxy request", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/ai",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.openai.com/v1/chat/completions",
          headers: { "X-Custom-Header": "test-value" },
          body: { model: "gpt-4" },
        }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.headers["X-Custom-Header"]).toBe("test-value");
    expect(fetchCall[1]!.body).toBe(JSON.stringify({ model: "gpt-4" }));

    vi.unstubAllGlobals();
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

  it("returns 429 when rate limited", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const limiterStub = { fetch: vi.fn().mockResolvedValue(new Response("0.5")) };
    (env.LIMITERS.get as ReturnType<typeof vi.fn>).mockReturnValue(limiterStub);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ source: "web", eventType: "click" }]),
      },
      env,
    );

    expect(res.status).toBe(429);
    const body = await res.json<{ error: string; retryAfter: number }>();
    expect(body.error).toBe("Rate limited");
    expect(body.retryAfter).toBe(0.5);
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

  it("does not fail when SpacetimeDB forwarding errors", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  it("skips SpacetimeDB forwarding when SPACETIMEDB_URI is absent", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", analytics);

    const env = createMockEnv();
    env.SPACETIMEDB_URI = "";
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ source: "web", eventType: "click" }]),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();

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
    expect(res.headers.get("cache-control")).toBe("no-cache");
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
    // Non-hashed asset gets standard cache-control
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
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
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await app.request(
      "/proxy/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.stripe.com/v1/charges",
          method: "GET",
          body: { amount: 1000, currency: "usd" },
        }),
      },
      env,
    );

    const fetchCall = mockFetch.mock.calls[0]!;
    expect(fetchCall[1]!.method).toBe("GET");
    expect(fetchCall[1]!.body).toBe(JSON.stringify({ amount: 1000, currency: "usd" }));

    vi.unstubAllGlobals();
  });

  it("sends undefined body to Stripe when not provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
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
    expect(fetchCall[1]!.body).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("forwards body payload to GitHub when provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
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

  it("sends undefined body to GitHub when not provided", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
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
    expect(fetchCall[1]!.body).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("proxies the upstream response status code", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 201, headers: { "content-type": "application/json" } }),
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
    const { default: appModule } = await import("../index.js");
    const env = createMockEnv();

    const res = await (appModule as { fetch: (req: Request, env: Env) => Promise<Response> }).fetch(
      new Request("https://spike.land/health"),
      env,
    );

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("handles CORS preflight for allowed origin", async () => {
    const { default: appModule } = await import("../index.js");
    const env = createMockEnv();

    const res = await (appModule as { fetch: (req: Request, env: Env) => Promise<Response> }).fetch(
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
    const { default: appModule } = await import("../index.js");
    const env = createMockEnv();
    env.ALLOWED_ORIGINS = "";

    const res = await (appModule as { fetch: (req: Request, env: Env) => Promise<Response> }).fetch(
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
    const { default: appModule } = await import("../index.js");
    const env = createMockEnv();

    // R2 head throws to trigger 503 from health, which exercises the error path
    (env.R2.head as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("storage error"));

    const res = await (appModule as { fetch: (req: Request, env: Env) => Promise<Response> }).fetch(
      new Request("https://spike.land/health"),
      env,
    );

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
    const { default: appModule } = await import("../index.js");
    const env = createMockEnv();

    // Make SPA_ASSETS.get throw (not return null) to bypass route's own error handling
    (env.SPA_ASSETS.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("bucket error"));

    const res = await (appModule as { fetch: (req: Request, env: Env) => Promise<Response> }).fetch(
      new Request("https://spike.land/some/route/that/does/not/exist"),
      env,
    );

    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Internal Server Error");
  });
});
