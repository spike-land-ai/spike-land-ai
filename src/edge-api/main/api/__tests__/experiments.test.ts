import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { experiments } from "../../routes/experiments.js";
import type { Env } from "../../../core-logic/env.js";

// ─── Mock DB ────────────────────────────────────────────────────────────────

interface MockStmt {
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function createMockDB(state: {
  experiments?: Array<Record<string, unknown>>;
  assignments?: Map<string, string>; // "expId:clientId" → variantId
  metrics?: Array<Record<string, unknown>>;
}) {
  const stmts: MockStmt[] = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      const stmt: MockStmt = {
        bind: vi.fn((..._args: unknown[]) => stmt),
        all: vi.fn(async () => {
          if (sql.includes("FROM experiments")) {
            return { results: state.experiments ?? [] };
          }
          if (sql.includes("FROM experiment_metrics")) {
            return { results: state.metrics ?? [] };
          }
          return { results: [] };
        }),
        first: vi.fn(async () => {
          if (sql.includes("FROM experiment_assignments")) {
            // Check assignments map based on bind args
            return null; // Default: no existing assignment
          }
          if (sql.includes("FROM experiments WHERE id")) {
            return state.experiments?.[0] ?? null;
          }
          return null;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      stmts.push(stmt);
      return stmt;
    }),
    batch: vi.fn(async () => []),
  } as unknown as D1Database;

  return { db, stmts };
}

function createApp(envOverrides: Partial<Env> = {}) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", async (c, next) => {
    const context = c as unknown as { env?: Partial<Env> };
    context.env = {
      ...(context.env ?? {}),
      ...envOverrides,
    };
    await next();
  });
  app.route("/", experiments);
  return app;
}

const MOCK_EXPERIMENT = {
  id: "exp-test",
  name: "Test Experiment",
  dimension: "test_dim",
  variants: JSON.stringify([
    { id: "control", config: { defaultSliderIdx: 3 }, weight: 50 },
    { id: "variant-a", config: { defaultSliderIdx: 0 }, weight: 50 },
  ]),
  status: "active",
  winner_variant_id: null,
  traffic_pct: 100,
  created_at: Date.now() - 72 * 60 * 60 * 1000, // 72h ago
  updated_at: Date.now(),
};

// ─── Assignment Tests ───────────────────────────────────────────────────────

describe("POST /api/experiments/assign", () => {
  it("requires clientId", async () => {
    const { db } = createMockDB({});
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns assignments for active experiments", async () => {
    const { db } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "test-client-123" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      assignments: Record<string, { variantId: string; config: Record<string, unknown> }>;
    };
    expect(data.assignments).toBeDefined();
    const expAssign = data.assignments["exp-test"];
    expect(expAssign).toBeDefined();
    expect(expAssign!.variantId).toBeTruthy();
  });

  it("deterministic: same clientId always gets same variant", async () => {
    const { db: db1 } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
    const { db: db2 } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
    const app1 = createApp({ DB: db1 });
    const app2 = createApp({ DB: db2 });

    const body = JSON.stringify({ clientId: "deterministic-test-id" });
    const opts = { method: "POST" as const, headers: { "Content-Type": "application/json" }, body };

    const res1 = await app1.request("/api/experiments/assign", opts);
    const res2 = await app2.request("/api/experiments/assign", opts);

    const data1 = (await res1.json()) as { assignments: Record<string, { variantId: string }> };
    const data2 = (await res2.json()) as { assignments: Record<string, { variantId: string }> };

    expect(data1.assignments["exp-test"]!.variantId).toBe(data2.assignments["exp-test"]!.variantId);
  });
});

// ─── Distribution Test ──────────────────────────────────────────────────────

describe("FNV-1a distribution", () => {
  it("distributes 1000 random clientIds roughly equally (within 15%)", async () => {
    // We test the hash function directly by importing the route and checking assignments
    const counts: Record<string, number> = { control: 0, "variant-a": 0 };

    for (let i = 0; i < 1000; i++) {
      const { db } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
      const app = createApp({ DB: db });

      const res = await app.request("/api/experiments/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: `random-client-${i}-${Math.random()}` }),
      });

      const data = (await res.json()) as { assignments: Record<string, { variantId: string }> };
      const vid = data.assignments["exp-test"]?.variantId;
      if (vid && counts[vid] !== undefined) counts[vid]++;
    }

    // Each variant should get roughly 500 (50% weight)
    // Allow 15% deviation: 350-650 range
    expect(counts.control).toBeGreaterThan(350);
    expect(counts.control).toBeLessThan(650);
    expect(counts["variant-a"]).toBeGreaterThan(350);
    expect(counts["variant-a"]).toBeLessThan(650);
  });
});

// ─── Event Tracking Tests ───────────────────────────────────────────────────

describe("POST /api/experiments/track", () => {
  it("accepts valid events", async () => {
    const { db } = createMockDB({});
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            clientId: "c1",
            slug: "test-post",
            eventType: "widget_impression",
            experimentId: "exp-test",
            variantId: "control",
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { accepted: number };
    expect(data.accepted).toBeGreaterThan(0);
  });

  it("rejects empty events array", async () => {
    const { db } = createMockDB({});
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    expect(res.status).toBe(400);
  });

  it("filters out invalid event types", async () => {
    const { db } = createMockDB({});
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          { clientId: "c1", slug: "s", eventType: "invalid_type" },
          { clientId: "c1", slug: "s", eventType: "widget_impression" },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { accepted: number };
    // Only valid event + possible metrics upserts
    expect(data.accepted).toBeGreaterThanOrEqual(1);
  });
});

// ─── Active Experiments ─────────────────────────────────────────────────────

describe("GET /api/experiments/active", () => {
  it("returns active experiments with parsed variants", async () => {
    const { db } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/active");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { experiments: Array<{ id: string; variants: unknown[] }> };
    expect(data.experiments).toHaveLength(1);
    expect(data.experiments[0]!.id).toBe("exp-test");
    expect(Array.isArray(data.experiments[0]!.variants)).toBe(true);
  });

  it("sets cache header", async () => {
    const { db } = createMockDB({ experiments: [] });
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/active");
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });
});

// ─── Metrics ────────────────────────────────────────────────────────────────

describe("GET /api/experiments/:id/metrics", () => {
  it("returns 404 for unknown experiment", async () => {
    const { db } = createMockDB({ experiments: [] });
    // Override the first call to return null for the experiment lookup
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((_sql: string) => {
      const stmt = {
        bind: vi.fn((..._args: unknown[]) => stmt),
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    });
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/nonexistent/metrics");
    expect(res.status).toBe(404);
  });
});

// ─── Dashboard ──────────────────────────────────────────────────────────────

describe("GET /api/experiments/dashboard", () => {
  it("returns experiments list and 24h revenue", async () => {
    const { db } = createMockDB({ experiments: [MOCK_EXPERIMENT] });
    // Override to handle the dashboard's Promise.all pattern
    let callCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((_sql: string) => {
      callCount++;
      const stmt = {
        bind: vi.fn((..._args: unknown[]) => stmt),
        all: vi.fn(async () => ({ results: callCount === 1 ? [MOCK_EXPERIMENT] : [] })),
        first: vi.fn(async () => (callCount === 2 ? { total: 5000 } : null)),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    });
    const app = createApp({ DB: db });

    const res = await app.request("/api/experiments/dashboard");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { experiments: unknown[]; revenue24h: number };
    expect(data.experiments).toBeDefined();
    expect(typeof data.revenue24h).toBe("number");
  });
});
