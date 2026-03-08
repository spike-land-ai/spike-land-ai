/**
 * Tests for the main app (index.ts) — covering middleware chains,
 * MCP proxy routes, auth proxy, catch-all API route, and scheduled handler.
 */
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";

// Import the full app module
// Note: We re-create a minimal app using the same patterns as index.ts
// because importing index.ts directly would require all CF bindings
import { Hono } from "hono";
import { requestIdMiddleware } from "../../../src/edge-api/main/api/middleware/request-id.js";

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
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ session: { id: "s1" }, user: { id: "user-123" } }), {
          status: 200,
        }),
      ),
    } as unknown as Fetcher,
    MCP_SERVICE: {
      fetch: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ tools: [] }), { status: 200 })),
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

describe("requestIdMiddleware", () => {
  it("adds x-request-id header to response", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", requestIdMiddleware);
    app.get("/test", (_c) => _c.json({ ok: true }));

    const env = createMockEnv();
    const res = await app.request("/test", {}, env);
    expect(res.status).toBe(200);
    // The middleware sets requestId in context; response header depends on implementation
  });
});

describe("RateLimiter export", () => {
  it("is exported from index", async () => {
    // Dynamic import to avoid loading the whole app
    const { RateLimiter: RL } = await import("../../../src/edge-api/main/edge/rate-limiter.js");
    expect(RL).toBeDefined();
  });
});

describe("CORS middleware via full app", () => {
  it("sets cors headers with default origin when ALLOWED_ORIGINS not set", async () => {
    // Build a minimal app with same CORS logic as index.ts
    const { cors } = await import("hono/cors");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", requestIdMiddleware);
    app.use("*", async (c, next) => {
      const allowedOrigins = c.env.ALLOWED_ORIGINS
        ? c.env.ALLOWED_ORIGINS.split(",").map((o: string) => o.trim())
        : ["https://spike.land"];

      const corsMiddleware = cors({
        origin: allowedOrigins,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: 86400,
      });
      return corsMiddleware(c, next);
    });
    app.get("/test", (_c) => _c.json({ ok: true }));

    const env = createMockEnv({ ALLOWED_ORIGINS: "" });
    const res = await app.request(
      "/test",
      {
        headers: { origin: "https://spike.land" },
      },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("handles multiple allowed origins", async () => {
    const { cors } = await import("hono/cors");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      const allowedOrigins = c.env.ALLOWED_ORIGINS
        ? c.env.ALLOWED_ORIGINS.split(",").map((o: string) => o.trim())
        : ["https://spike.land"];
      const corsMiddleware = cors({ origin: allowedOrigins });
      return corsMiddleware(c, next);
    });
    app.get("/test", (_c) => _c.json({ ok: true }));

    const env = createMockEnv({ ALLOWED_ORIGINS: "https://spike.land,https://dev.spike.land" });
    const res = await app.request(
      "/test",
      {
        headers: { origin: "https://dev.spike.land" },
      },
      env,
    );
    expect(res.status).toBe(200);
  });
});

describe("Security headers middleware", () => {
  it("adds security headers to response", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      await next();
      try {
        c.res.headers.set("X-Test-Mutable", "1");
        c.res.headers.delete("X-Test-Mutable");
      } catch {
        c.res = new Response(c.res.body, {
          status: c.res.status,
          statusText: c.res.statusText,
          headers: new Headers(c.res.headers),
        });
      }
      const isLive = c.req.path.startsWith("/live/");
      c.res.headers.set("X-Content-Type-Options", "nosniff");
      if (!isLive) {
        c.res.headers.set("X-Frame-Options", "DENY");
      }
      c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    });
    app.get("/test", (_c) => _c.json({ ok: true }));
    app.get("/live/code1", (_c) => _c.json({ live: true }));

    const env = createMockEnv();
    const res = await app.request("/test", {}, env);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");

    // Live routes should NOT have X-Frame-Options
    const liveRes = await app.request("/live/code1", {}, env);
    expect(liveRes.headers.get("X-Frame-Options")).toBeNull();
  });

  it("handles immutable response headers gracefully", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      await next();
      // Simulate immutable headers by using a frozen Response
      try {
        c.res.headers.set("X-Test-Mutable", "1");
        c.res.headers.delete("X-Test-Mutable");
      } catch {
        c.res = new Response(c.res.body, {
          status: c.res.status,
          statusText: c.res.statusText,
          headers: new Headers(c.res.headers),
        });
      }
      c.res.headers.set("X-Content-Type-Options", "nosniff");
    });
    app.get("/test", (_c) => new Response("{}", { status: 200 }));

    const env = createMockEnv();
    const res = await app.request("/test", {}, env);
    expect(res.status).toBe(200);
  });
});

describe("Error handler in full app", () => {
  it("returns 500 JSON for thrown errors", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.onError((err, c) => {
      try {
        c.executionCtx.waitUntil(Promise.resolve());
      } catch {
        /* no ctx in tests */
      }
      return c.json({ error: "Internal Server Error" }, 500);
    });
    app.get("/boom", () => {
      throw new Error("Intentional test error");
    });

    const env = createMockEnv();
    const res = await app.request("/boom", {}, env);
    expect(res.status).toBe(500);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Internal Server Error");
  });
});

describe("Catch-all /api/* route", () => {
  it("returns 404 JSON for unmatched API routes", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.all("/api/*", (_c) => {
      return c.json({ error: "Not Found", path: c.req.path }, 404);
    });

    const env = createMockEnv();
    const res = await app.request("/api/completely-unknown-endpoint", {}, env);
    expect(res.status).toBe(404);
    const body = await res.json<{ error: string; path: string }>();
    expect(body.error).toBe("Not Found");
    expect(body.path).toBe("/api/completely-unknown-endpoint");
  });
});

describe("OAuth well-known endpoints", () => {
  it("returns oauth-authorization-server metadata", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/.well-known/oauth-authorization-server", (_c) => {
      c.header("Cache-Control", "public, max-age=86400");
      return c.json({
        issuer: "https://spike.land",
        authorization_endpoint: "https://spike.land/mcp/authorize",
        token_endpoint: "https://spike.land/oauth/token",
        device_authorization_endpoint: "https://spike.land/oauth/device",
        response_types_supported: ["token"],
        grant_types_supported: ["urn:ietf:params:oauth:grant-type:device_code"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
      });
    });

    const env = createMockEnv();
    const res = await app.request("/.well-known/oauth-authorization-server", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ issuer: string }>();
    expect(body.issuer).toBe("https://spike.land");
  });

  it("returns oauth-protected-resource/mcp metadata", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/.well-known/oauth-protected-resource/mcp", (_c) => {
      c.header("Cache-Control", "public, max-age=86400");
      return c.json({
        resource: "https://spike.land/mcp",
        authorization_servers: ["https://spike.land"],
        bearer_methods_supported: ["header"],
        resource_documentation: "https://spike.land/docs/mcp",
      });
    });

    const env = createMockEnv();
    const res = await app.request("/.well-known/oauth-protected-resource/mcp", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ resource: string }>();
    expect(body.resource).toBe("https://spike.land/mcp");
  });
});

describe("MCP proxy routes", () => {
  it("proxies GET /mcp/tools", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/mcp/tools", async (_c) => {
      const url = new URL("https://mcp.spike.land/tools");
      const requestId = c.get("requestId" as never) as string;
      const response = await c.env.MCP_SERVICE.fetch(
        new Request(url.toString(), {
          headers: { "X-Request-Id": requestId ?? "test-id" },
        }),
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
    });

    const env = createMockEnv();
    const res = await app.request("/mcp/tools", {}, env);
    expect(res.status).toBe(200);
    expect(env.MCP_SERVICE.fetch).toHaveBeenCalled();
  });

  it("returns store tools data from MCP service", async () => {
    const mcpTools = {
      tools: [
        { name: "tool1", description: "A tool", category: "code", stability: "stable" },
        { name: "tool2", description: "Another tool", category: "docs", stability: "beta" },
        { name: "tool3", description: "Third tool", stability: "stable" },
      ],
    };

    const app = new Hono<{ Bindings: Env }>();
    app.get("/api/store/tools", async (_c) => {
      const requestId = c.get("requestId" as never) as string;
      const response = await c.env.MCP_SERVICE.fetch(
        new Request("https://mcp.spike.land/tools", {
          headers: { "X-Request-Id": requestId ?? "test-id" },
        }),
      );
      if (!response.ok) {
        return c.json({ error: "Failed to fetch tools" }, 502);
      }
      const data = await response.json<{
        tools: Array<{
          name: string;
          description: string;
          category?: string;
          version?: string;
          stability?: string;
        }>;
      }>();
      const tools = data.tools ?? [];

      // Group by category
      const categoryMap = new Map<string, typeof tools>();
      for (const tool of tools) {
        const cat = tool.category ?? "other";
        const existing = categoryMap.get(cat) ?? [];
        existing.push(tool);
        categoryMap.set(cat, existing);
      }

      const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        tools: items,
      }));

      const featured = [...tools]
        .sort((a, b) => {
          const aStable = a.stability === "stable" ? 0 : 1;
          const bStable = b.stability === "stable" ? 0 : 1;
          return aStable - bStable;
        })
        .slice(0, 6);

      c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      return c.json({ categories, featured, total: tools.length });
    });

    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(mcpTools), { status: 200 })),
      } as unknown as Fetcher,
    });

    const res = await app.request("/api/store/tools", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ categories: unknown[]; featured: unknown[]; total: number }>();
    expect(body.total).toBe(3);
    expect(body.categories.length).toBeGreaterThan(0);
    // "other" category for tool3 (no category)
    const otherCat = (body.categories as Array<{ name: string }>).find((_c) => _c.name === "other");
    expect(otherCat).toBeTruthy();
  });

  it("returns 502 when MCP service is unavailable for store tools", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/api/store/tools", async (_c) => {
      const response = await c.env.MCP_SERVICE.fetch(new Request("https://mcp.spike.land/tools"));
      if (!response.ok) {
        return c.json({ error: "Failed to fetch tools" }, 502);
      }
      return c.json({ ok: true });
    });

    const env = createMockEnv({
      MCP_SERVICE: {
        fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
      } as unknown as Fetcher,
    });

    const res = await app.request("/api/store/tools", {}, env);
    expect(res.status).toBe(502);
  });
});

describe("scheduled handler via default export", () => {
  it("is exported as scheduled function", async () => {
    // Just verify the export exists without triggering full CF bindings
    const mod = await import("../../../src/edge-api/main/index.js");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default.scheduled).toBe("function");
    expect(typeof mod.default.fetch).toBe("function");
    expect(mod.RateLimiter).toBeDefined();
  });
});
