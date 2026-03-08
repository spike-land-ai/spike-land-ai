/**
 * Tests for routes/internal-analytics.ts
 */
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/spike-land/core-logic/env";
import { internalAnalytics } from "../../../src/edge-api/spike-land/api/internal-analytics";

function buildAppWithEnv(
  queryResult: Record<string, unknown>[] = [],
  batchResults?: Record<string, unknown>[][],
) {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/internal", internalAnalytics);

  // Override env for each request
  const mockDB = {
    prepare: (_sql: string) => {
      let _boundValues: unknown[] = [];
      const stmt = {
        bind: (...values: unknown[]) => {
          _boundValues = values;
          return stmt;
        },
        all: async () => ({ results: queryResult, success: true, meta: {} }),
        run: async () => ({ results: queryResult, success: true, meta: {} }),
        first: async () => queryResult[0] ?? null,
        raw: async () => queryResult,
      };
      return stmt;
    },
    batch: async (stmts: unknown[]) => {
      if (batchResults) {
        return batchResults.map((r) => ({ results: r, success: true, meta: {} }));
      }
      return stmts.map(() => ({ results: queryResult, success: true, meta: {} }));
    },
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;

  return { app, mockDB };
}

describe("internalAnalytics - GET /analytics/tools", () => {
  it("returns tools with default range 7d", async () => {
    const { app, mockDB } = buildAppWithEnv([
      {
        tool_name: "search_tools",
        server_name: "mcp",
        total_calls: 100,
        total_errors: 2,
        total_ms: 5000,
      },
    ]);

    const res = await app.request(
      "/internal/analytics/tools",
      {
        headers: { "Content-Type": "application/json" },
      },
      { DB: mockDB } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: unknown[]; range: string };
    expect(body.range).toBe("7d");
    expect(body.tools).toHaveLength(1);
  });

  it("returns tools with explicit range=24h", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/tools?range=24h", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { range: string };
    expect(body.range).toBe("24h");
  });

  it("returns tools with range=30d", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/tools?range=30d", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { range: string };
    expect(body.range).toBe("30d");
  });

  it("returns 400 for invalid range", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/tools?range=1y", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Invalid range");
  });

  it("respects limit parameter", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/tools?limit=5", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
  });

  it("caps limit at 100", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/tools?limit=9999", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
  });
});

describe("internalAnalytics - GET /analytics/users", () => {
  it("returns all tools user stats with default range", async () => {
    const { app, mockDB } = buildAppWithEnv([
      { tool_name: "search_tools", server_name: "mcp", unique_users: 42 },
    ]);

    const res = await app.request("/internal/analytics/users", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: unknown[]; range: string };
    expect(body.range).toBe("7d");
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("filters by specific tool", async () => {
    const { app, mockDB } = buildAppWithEnv([
      { tool_name: "search_tools", server_name: "mcp", unique_users: 10 },
    ]);

    const res = await app.request("/internal/analytics/users?tool=search_tools", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tool: string; range: string };
    expect(body.tool).toBe("search_tools");
  });

  it("returns 400 for invalid range in users endpoint", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/users?range=bad", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(400);
  });
});

describe("internalAnalytics - GET /analytics/summary", () => {
  it("returns summary stats with default range", async () => {
    const { app, mockDB } = buildAppWithEnv(
      [],
      [
        [{ total_calls: 500, total_errors: 10, total_ms: 25000 }],
        [{ unique_users: 50 }],
        [{ unique_tools: 20 }],
      ],
    );

    const res = await app.request("/internal/analytics/summary", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalCalls: number;
      totalErrors: number;
      errorRate: number;
      uniqueUsers: number;
      uniqueTools: number;
      range: string;
    };
    expect(body.range).toBe("7d");
    expect(body.totalCalls).toBe(500);
    expect(body.totalErrors).toBe(10);
    expect(body.errorRate).toBeCloseTo(0.02);
    expect(body.uniqueUsers).toBe(50);
    expect(body.uniqueTools).toBe(20);
  });

  it("returns 0 error rate when no calls", async () => {
    const { app, mockDB } = buildAppWithEnv(
      [],
      [
        [{ total_calls: 0, total_errors: 0, total_ms: 0 }],
        [{ unique_users: 0 }],
        [{ unique_tools: 0 }],
      ],
    );

    const res = await app.request("/internal/analytics/summary", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { errorRate: number };
    expect(body.errorRate).toBe(0);
  });

  it("returns 400 for invalid range in summary", async () => {
    const { app, mockDB } = buildAppWithEnv([]);

    const res = await app.request("/internal/analytics/summary?range=invalid", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(400);
  });

  it("handles undefined db results gracefully", async () => {
    const { app, mockDB } = buildAppWithEnv(
      [],
      [
        [], // empty batch results
        [],
        [],
      ],
    );

    const res = await app.request("/internal/analytics/summary", {}, {
      DB: mockDB,
    } as unknown as Env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalCalls: number };
    expect(body.totalCalls).toBe(0);
  });
});
