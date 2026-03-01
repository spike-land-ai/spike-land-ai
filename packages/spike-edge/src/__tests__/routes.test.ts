import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env.js";
import { health } from "../routes/health.js";
import { r2 } from "../routes/r2.js";
import { proxy } from "../routes/proxy.js";

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
  };
}

describe("health route", () => {
  it("returns 200 with ok status", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json<{ status: string }>();
    expect(body.status).toBe("ok");
  });

  it("returns 503 when R2 is unreachable", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", health);

    const env = createMockEnv();
    (env.R2.head as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("R2 down"));

    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(503);
  });
});

describe("r2 route", () => {
  it("returns 404 for missing key", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const res = await app.request("/r2/missing-file.txt", {}, env);

    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Not found");
  });

  it("returns object when found", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", r2);

    const env = createMockEnv();
    const mockHeaders = new Headers();
    (env.R2.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new ReadableStream(),
      httpEtag: '"abc123"',
      writeHttpMetadata: (h: Headers) => {
        h.set("content-type", "text/plain");
      },
    });

    const res = await app.request("/r2/test-file.txt", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"abc123"');
  });
});

describe("proxy route", () => {
  it("validates request body", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request("/proxy/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("url is required");
  });

  it("rejects invalid Stripe URL", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request("/proxy/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://evil.com/steal" }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid Stripe API URL");
  });

  it("rejects invalid GitHub URL", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", proxy);

    const env = createMockEnv();
    const res = await app.request("/proxy/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://evil.com/steal" }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid GitHub API URL");
  });
});
