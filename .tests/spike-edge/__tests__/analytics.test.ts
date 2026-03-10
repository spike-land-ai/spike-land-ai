import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { analytics } from "../../../src/edge-api/main/api/routes/analytics.js";

function createMockD1(): D1Database {
  const mockStmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    raw: vi.fn().mockResolvedValue([]),
  };
  return {
    prepare: vi.fn().mockReturnValue(mockStmt),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    R2: {} as unknown as R2Bucket,
    SPA_ASSETS: {} as unknown as R2Bucket,
    DB: createMockD1(),
    LIMITERS: {} as unknown as DurableObjectNamespace,
    AUTH_MCP: {} as unknown as Fetcher,
    MCP_SERVICE: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    GEMINI_API_KEY: "",
    CLAUDE_OAUTH_TOKEN: "",
    GITHUB_TOKEN: "",
    ALLOWED_ORIGINS: "https://spike.land",
    QUIZ_BADGE_SECRET: "",
    GA_MEASUREMENT_ID: "G-TEST123",
    GA_API_SECRET: "secret123",
    CACHE_VERSION: "v1",
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
  app.route("/", analytics);
  return app;
}

function makeExecutionCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

const INTERNAL_HEADERS = { "x-internal-secret": "internal" };

describe("analytics ingest endpoint", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 429 when rate limited", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const ctx = makeExecutionCtx();

    // Exhaust the in-memory rate limit (10 requests per minute per IP)
    for (let i = 0; i < 10; i++) {
      await app.request(
        "/analytics/ingest",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
          body: JSON.stringify([{ source: "web", eventType: "click" }]),
        },
        env,
        ctx,
      );
    }

    // 11th request should be rate limited
    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
        body: JSON.stringify([{ source: "web", eventType: "click" }]),
      },
      env,
    );

    expect(res.status).toBe(429);
    const body = await res.json<{ error: string; retryAfter: number }>();
    expect(body.error).toBe("Rate limited");
    expect(body.retryAfter).toBe(60);
  });

  it("returns 400 for non-array body", async () => {
    const app = makeApp();
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

  it("returns 400 when all events are invalid (missing source/eventType)", async () => {
    const app = makeApp();
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

  it("accepts valid events and returns { accepted: count }", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const ctx = makeExecutionCtx();

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
      ctx,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(2);
  });

  it("calls sendGA4Events via waitUntil", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const ctx = makeExecutionCtx();

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ source: "web", eventType: "page_view" }]),
      },
      env,
      ctx,
    );

    expect(res.status).toBe(200);

    // waitUntil should have been called with the GA4 promise
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);

    // Await the promise passed to waitUntil so GA4 fetch runs
    const ga4Promise = (ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    await ga4Promise;

    // GA4 fetch should have been called
    expect(mockFetch).toHaveBeenCalled();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain("google-analytics.com/mp/collect");
  });

  it("filters invalid events - only valid events are counted", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const ctx = makeExecutionCtx();

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { source: "web", eventType: "click" },
          { eventType: "missing_source" },
          { source: "missing_event_type" },
          { source: "api", eventType: "tool_use" },
        ]),
      },
      env,
      ctx,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(2);
  });

  it("fetches user ID from auth session cookie when auth_session cookie present", async () => {
    const app = makeApp();
    const authMcpFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ user: { id: "user-session-xyz" } }), { status: 200 }),
      );
    const env = createMockEnv({
      AUTH_MCP: { fetch: authMcpFetch } as unknown as Fetcher,
    });

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "99.99.99.99",
          cookie: "auth_session=valid-session",
        },
        body: JSON.stringify([{ source: "web", eventType: "page_view" }]),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(authMcpFetch).toHaveBeenCalled();
  });

  it("falls back to anonymous clientId when auth session fetch fails", async () => {
    const app = makeApp();
    const env = createMockEnv({
      AUTH_MCP: {
        fetch: vi.fn().mockRejectedValue(new Error("network error")),
      } as unknown as Fetcher,
    });

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "77.77.77.77",
          cookie: "auth_session=bad-session",
        },
        body: JSON.stringify([{ source: "web", eventType: "page_view" }]),
      },
      env,
    );

    expect(res.status).toBe(200);
  });

  it("handles metadata with scalar and non-scalar values in GA4 params", async () => {
    const app = makeApp();
    const env = createMockEnv();

    const res = await app.request(
      "/analytics/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": "55.55.55.55" },
        body: JSON.stringify([
          {
            source: "web",
            eventType: "test",
            metadata: {
              str: "hello",
              num: 42,
              bool: true,
              obj: { nested: "skip" },
              arr: [1, 2, 3],
            },
          },
        ]),
      },
      env,
    );

    expect(res.status).toBe(200);
  });
});

// ─── GET /analytics/events ────────────────────────────────────────────────────

describe("GET /analytics/events", () => {
  it("returns 400 for invalid range", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const res = await app.request(
      "/analytics/events?range=invalid",
      { headers: INTERNAL_HEADERS },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("Invalid range");
  });

  it("returns events for 24h range (default)", async () => {
    const db = createMockD1();
    const allMock = (
      db.prepare("") as unknown as { all: MockedFunction<() => Promise<{ results: unknown[] }>> }
    ).all;
    allMock.mockResolvedValue({ results: [{ id: "1", source: "web" }] });
    const app = makeApp();
    const res = await app.request(
      "/analytics/events",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ DB: db }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts 7d range with type filter and custom limit", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const res = await app.request(
      "/analytics/events?range=7d&type=page_view&limit=100",
      { headers: INTERNAL_HEADERS },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("accepts 30d range", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const res = await app.request(
      "/analytics/events?range=30d",
      { headers: INTERNAL_HEADERS },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("caps limit at 200", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const res = await app.request(
      "/analytics/events?range=24h&limit=99999",
      { headers: INTERNAL_HEADERS },
      env,
    );
    expect(res.status).toBe(200);
  });
});

// ─── GET /analytics/summary ───────────────────────────────────────────────────

describe("GET /analytics/summary", () => {
  it("returns 400 for invalid range", async () => {
    const app = makeApp();
    const env = createMockEnv();
    const res = await app.request(
      "/analytics/summary?range=invalid",
      { headers: INTERNAL_HEADERS },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns summary with counts", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi
        .fn()
        .mockResolvedValue([
          { results: [{ total: 100 }] },
          { results: [{ unique_users: 25 }] },
          { results: [{ event_type: "page_view", count: 80 }] },
          { results: [{ tool_name: "my-tool", count: 20 }] },
        ]),
    } as unknown as D1Database;
    const app = makeApp();
    const res = await app.request(
      "/analytics/summary?range=7d",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ DB: db }),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      totalEvents: number;
      uniqueUsers: number;
      eventsByType: unknown[];
      toolUsage: unknown[];
    }>();
    expect(body.totalEvents).toBe(100);
    expect(body.uniqueUsers).toBe(25);
    expect(body.eventsByType).toHaveLength(1);
    expect(body.toolUsage).toHaveLength(1);
  });

  it("handles null batch results gracefully", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([null, null, null, null]),
    } as unknown as D1Database;
    const app = makeApp();
    const res = await app.request(
      "/analytics/summary",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ DB: db }),
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ totalEvents: number }>();
    expect(body.totalEvents).toBe(0);
  });
});

// ─── MCP analytics proxy endpoints ───────────────────────────────────────────

describe("GET /analytics/mcp/tools", () => {
  it("proxies to MCP service with query params", async () => {
    const mcpFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ tools: [] }), { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/tools?range=7d&limit=20",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
    expect(mcpFetch).toHaveBeenCalled();
  });

  it("proxies without query params", async () => {
    const mcpFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/tools",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /analytics/mcp/users", () => {
  it("proxies with range and tool query params", async () => {
    const mcpFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/users?range=24h&tool=my-tool",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
    expect(mcpFetch).toHaveBeenCalled();
  });

  it("proxies without params", async () => {
    const mcpFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/users",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /analytics/mcp/summary", () => {
  it("proxies with range param", async () => {
    const mcpFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/summary?range=30d",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
  });

  it("proxies without params", async () => {
    const mcpFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const app = makeApp();
    const res = await app.request(
      "/analytics/mcp/summary",
      { headers: INTERNAL_HEADERS },
      createMockEnv({ MCP_SERVICE: { fetch: mcpFetch } as unknown as Fetcher }),
    );
    expect(res.status).toBe(200);
  });
});
