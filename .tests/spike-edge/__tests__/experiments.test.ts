import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";
import { experiments } from "../../../src/edge-api/main/api/routes/experiments.js";

const BASE_VARIANTS = JSON.stringify([
  { id: "control", config: { color: "blue" }, weight: 50 },
  { id: "variant-a", config: { color: "red" }, weight: 50 },
]);

function makeMockDB(
  overrides: {
    allResults?: unknown[];
    firstResult?: unknown;
    allResults2?: unknown[];
    firstResult2?: unknown;
  } = {},
) {
  let allCallCount = 0;
  let firstCallCount = 0;
  const allResults = overrides.allResults ?? [];
  const allResults2 = overrides.allResults2 ?? [];
  const firstResult = overrides.firstResult ?? null;
  const firstResult2 = overrides.firstResult2 ?? null;

  return {
    prepare: vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockImplementation(() => {
        allCallCount++;
        return Promise.resolve({ results: allCallCount <= 1 ? allResults : allResults2 });
      }),
      first: vi.fn().mockImplementation(() => {
        firstCallCount++;
        return Promise.resolve(firstCallCount <= 1 ? firstResult : firstResult2);
      }),
      run: vi.fn().mockResolvedValue({}),
    })),
    batch: vi.fn().mockResolvedValue([]),
  } as unknown as D1Database;
}

function createMockEnv(dbOverrides: Record<string, unknown> = {}): Env {
  return {
    R2: {} as R2Bucket,
    SPA_ASSETS: {} as R2Bucket,
    DB: makeMockDB(dbOverrides),
    AUTH_MCP: {
      fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    } as unknown as Fetcher,
    MCP_SERVICE: { fetch: vi.fn() } as unknown as Fetcher,
    LIMITERS: {} as DurableObjectNamespace,
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec",
    GEMINI_API_KEY: "key",
    CLAUDE_OAUTH_TOKEN: "token",
    GITHUB_TOKEN: "ghp",
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
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  // Apply auth middleware for evaluate endpoint
  app.use("/api/experiments/*/evaluate", async (c, next) => {
    // Simulate authMiddleware passing — set userId
    c.set("userId" as never, "user-test" as never);
    await next();
  });
  app.route("/", experiments);
  return app;
}

// ─── POST /api/experiments/assign ────────────────────────────────────────────

describe("POST /api/experiments/assign", () => {
  it("returns 400 when clientId missing", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("clientId");
  });

  it("returns 400 when clientId too long", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: JSON.stringify({ clientId: "a".repeat(101) }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns empty assignments when no active experiments", async () => {
    const env = createMockEnv({ allResults: [] });
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: JSON.stringify({ clientId: "client-abc" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ assignments: Record<string, unknown> }>();
    expect(body.assignments).toEqual({});
  });

  it("uses existing assignment when found", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      traffic_pct: 100,
    };
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: _sql.includes("experiments") ? [exp] : [] }),
        first: vi
          .fn()
          .mockResolvedValue(
            _sql.includes("experiment_assignments") ? { variant_id: "control" } : null,
          ),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: JSON.stringify({ clientId: "client-abc" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ assignments: Record<string, { variantId: string }> }>();
    expect(body.assignments["exp-1"]?.variantId).toBe("control");
  });

  it("creates new assignment and inserts when not found", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      traffic_pct: 100,
    };
    const runMock = vi.fn().mockResolvedValue({});
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: _sql.includes("experiments") ? [exp] : [] }),
        first: vi.fn().mockResolvedValue(_sql.includes("experiment_assignments") ? null : null),
        run: runMock,
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: JSON.stringify({ clientId: "new-client" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(runMock).toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/assign",
      {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/experiments/track ─────────────────────────────────────────────

describe("POST /api/experiments/track", () => {
  it("returns 400 when events array missing", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/track",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toContain("events array");
  });

  it("returns 400 when events is empty array", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/track",
      {
        method: "POST",
        body: JSON.stringify({ events: [] }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("accepts valid events and returns accepted count", async () => {
    const batchMock = vi.fn().mockResolvedValue([]);
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
      }),
      batch: batchMock,
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/track",
      {
        method: "POST",
        body: JSON.stringify({
          events: [
            {
              clientId: "client-1",
              slug: "my-page",
              eventType: "widget_impression",
              experimentId: "exp-1",
              variantId: "control",
            },
            {
              clientId: "client-1",
              slug: "my-page",
              eventType: "donate_click",
              experimentId: "exp-1",
              variantId: "variant-a",
            },
            {
              clientId: "client-1",
              slug: "my-page",
              eventType: "fistbump_click",
              experimentId: "exp-1",
              variantId: "control",
            },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBeGreaterThan(0);
  });

  it("skips events with invalid eventType", async () => {
    const batchMock = vi.fn().mockResolvedValue([]);
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
      }),
      batch: batchMock,
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/track",
      {
        method: "POST",
        body: JSON.stringify({
          events: [{ clientId: "c1", slug: "s", eventType: "invalid_event" }],
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ accepted: number }>();
    expect(body.accepted).toBe(0);
  });

  it("returns 429 when rate limited", async () => {
    const env = createMockEnv();
    const app = makeApp();
    // Send many requests from same IP to trigger rate limit
    const requests = Array.from({ length: 25 }, () =>
      app.request(
        "/api/experiments/track",
        {
          method: "POST",
          body: JSON.stringify({
            events: [{ clientId: "c", slug: "s", eventType: "widget_impression" }],
          }),
          headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.0.1" },
        },
        env,
      ),
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(429);
  });

  it("handles invalid JSON gracefully", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/track",
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

// ─── GET /api/experiments/active ─────────────────────────────────────────────

describe("GET /api/experiments/active", () => {
  it("returns empty experiments list when none active", async () => {
    const env = createMockEnv({ allResults: [] });
    const app = makeApp();
    const res = await app.request("/api/experiments/active", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ experiments: unknown[] }>();
    expect(body.experiments).toEqual([]);
  });

  it("returns active experiments with parsed variants", async () => {
    const exp = {
      id: "exp-1",
      name: "Test Exp",
      dimension: "hero",
      variants: BASE_VARIANTS,
      status: "active",
      winner_variant_id: null,
      traffic_pct: 100,
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [exp] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request("/api/experiments/active", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ experiments: Array<{ id: string; variants: unknown[] }> }>();
    expect(body.experiments[0].id).toBe("exp-1");
    expect(Array.isArray(body.experiments[0].variants)).toBe(true);
  });
});

// ─── GET /api/experiments/:id/metrics ────────────────────────────────────────

describe("GET /api/experiments/:id/metrics", () => {
  it("returns 404 when experiment not found", async () => {
    const env = createMockEnv({ firstResult: null });
    const app = makeApp();
    const res = await app.request("/api/experiments/exp-999/metrics", {}, env);
    expect(res.status).toBe(404);
  });

  it("returns metrics for existing experiment", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      winner_variant_id: null,
      traffic_pct: 100,
    };
    const metricRows = [
      { variant_id: "control", metric_name: "impressions", metric_value: 100, sample_size: 100 },
      { variant_id: "control", metric_name: "donations", metric_value: 5, sample_size: 5 },
    ];
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(_sql.includes("WHERE id") ? exp : null),
        all: vi
          .fn()
          .mockResolvedValue({ results: _sql.includes("experiment_metrics") ? metricRows : [] }),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request("/api/experiments/exp-1/metrics", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{
      experimentId: string;
      variants: Array<{ variantId: string; impressions: number }>;
    }>();
    expect(body.experimentId).toBe("exp-1");
    const controlMetric = body.variants.find((v) => v.variantId === "control");
    expect(controlMetric?.impressions).toBe(100);
    expect(controlMetric?.donateRate).toBeCloseTo(0.05);
  });
});

// ─── POST /api/experiments/:id/evaluate ──────────────────────────────────────

describe("POST /api/experiments/:id/evaluate", () => {
  it("returns 404 when experiment not found", async () => {
    const env = createMockEnv({ firstResult: null });
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/exp-999/evaluate",
      {
        method: "POST",
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when experiment is not active", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "graduated",
      winner_variant_id: "control",
      traffic_pct: 100,
      created_at: Date.now() - 99 * 3600000,
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(exp),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/exp-1/evaluate",
      {
        method: "POST",
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns not ready when runtime < 48h", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      winner_variant_id: null,
      traffic_pct: 100,
      created_at: Date.now() - 10 * 3600000, // 10h
    };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(exp),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/exp-1/evaluate",
      {
        method: "POST",
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ready: boolean; reason: string }>();
    expect(body.ready).toBe(false);
    expect(body.reason).toContain("48h");
  });

  it("returns not ready when insufficient impressions", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      winner_variant_id: null,
      traffic_pct: 100,
      created_at: Date.now() - 100 * 3600000, // 100h
    };
    // Less than 500 impressions per variant
    const metricRows = [
      { variant_id: "control", metric_name: "impressions", metric_value: 100, sample_size: 100 },
    ];
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(exp),
        all: vi
          .fn()
          .mockResolvedValue({ results: _sql.includes("experiment_metrics") ? metricRows : [] }),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/exp-1/evaluate",
      {
        method: "POST",
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ready: boolean; reason: string }>();
    expect(body.ready).toBe(false);
    expect(body.reason).toContain("impressions");
  });

  it("runs Bayesian evaluation when sufficient data", async () => {
    const exp = {
      id: "exp-1",
      name: "Test",
      variants: BASE_VARIANTS,
      status: "active",
      winner_variant_id: null,
      traffic_pct: 100,
      created_at: Date.now() - 100 * 3600000,
    };
    // Enough impressions for both variants
    const metricRows = [
      { variant_id: "control", metric_name: "impressions", metric_value: 1000, sample_size: 1000 },
      { variant_id: "control", metric_name: "donations", metric_value: 50, sample_size: 50 },
      {
        variant_id: "variant-a",
        metric_name: "impressions",
        metric_value: 1000,
        sample_size: 1000,
      },
      { variant_id: "variant-a", metric_name: "donations", metric_value: 80, sample_size: 80 },
    ];
    const runMock = vi.fn().mockResolvedValue({});
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(exp),
        all: vi
          .fn()
          .mockResolvedValue({ results: _sql.includes("experiment_metrics") ? metricRows : [] }),
        run: runMock,
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request(
      "/api/experiments/exp-1/evaluate",
      {
        method: "POST",
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ready: boolean; probabilities: Record<string, number> }>();
    expect(body.ready).toBe(true);
    expect(body.probabilities).toBeDefined();
    expect(Object.keys(body.probabilities)).toContain("control");
    expect(Object.keys(body.probabilities)).toContain("variant-a");
  });
});

// ─── GET /api/experiments/dashboard ──────────────────────────────────────────

describe("GET /api/experiments/dashboard", () => {
  it("returns all experiments and revenue", async () => {
    const exps = [
      {
        id: "exp-1",
        name: "Test",
        dimension: "hero",
        status: "active",
        winner_variant_id: null,
        traffic_pct: 100,
        created_at: 1000,
      },
    ];
    const db = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: exps }),
        first: vi.fn().mockResolvedValue({ total: 1500 }),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request("/api/experiments/dashboard", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ experiments: unknown[]; revenue24h: number }>();
    expect(body.experiments).toHaveLength(1);
    expect(body.revenue24h).toBe(15); // 1500 cents / 100
  });

  it("handles null revenue", async () => {
    const db = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue({ total: null }),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request("/api/experiments/dashboard", {}, env);
    const body = await res.json<{ revenue24h: number }>();
    expect(body.revenue24h).toBe(0);
  });
});

// ─── GET /api/experiments/monitor ────────────────────────────────────────────

describe("GET /api/experiments/monitor", () => {
  it("returns event counts and anomalies", async () => {
    const eventCounts = [
      { experiment_id: "exp-1", variant_id: "control", event_type: "widget_impression", cnt: 10 },
    ];
    const activeExps = [{ id: "exp-1", name: "Test", variants: BASE_VARIANTS }];
    let allCallCount = 0;
    const db = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(() => {
          allCallCount++;
          return Promise.resolve({
            results: allCallCount <= 1 ? eventCounts : activeExps,
          });
        }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
      })),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const env = createMockEnv();
    (env as unknown as { DB: D1Database }).DB = db;
    const app = makeApp();
    const res = await app.request("/api/experiments/monitor?hours=8", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{
      windowHours: number;
      events: unknown[];
      anomalies: unknown[];
      activeExperiments: number;
    }>();
    expect(body.windowHours).toBe(8);
    // variant-a has no impressions → anomaly
    expect(body.anomalies.some((a: Record<string, unknown>) => a.variantId === "variant-a")).toBe(true);
  });

  it("accepts large hours value (clamps window internally)", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/api/experiments/monitor?hours=9999", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ windowHours: number }>();
    // windowHours reflects the raw parsed value; windowMs is clamped to 168h internally
    expect(body.windowHours).toBe(9999);
  });

  it("defaults to 4 hours when no param provided", async () => {
    const env = createMockEnv();
    const app = makeApp();
    const res = await app.request("/api/experiments/monitor", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ windowHours: number }>();
    expect(body.windowHours).toBe(4);
  });
});
