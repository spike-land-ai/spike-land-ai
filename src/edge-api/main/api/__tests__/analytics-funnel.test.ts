/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { analytics } from "../routes/analytics.js";
import type { Env } from "../../core-logic/env.js";

// ── D1 mock helpers ────────────────────────────────────────────────

function mockDb(rows: unknown[]) {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: async () => ({ results: rows, success: true, meta: {} }),
      }),
    }),
  } as unknown as D1Database;
}

// ── App factory ────────────────────────────────────────────────────

function createApp(db: D1Database) {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/", analytics);
  return { app, db };
}

const TEST_INTERNAL_SECRET = "test-internal-secret";

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    // Stub remaining Env fields to satisfy TypeScript — not exercised by these tests
    GA_MEASUREMENT_ID: "",
    GA_API_SECRET: "",
    INTERNAL_SERVICE_SECRET: TEST_INTERNAL_SECRET,
  } as unknown as Env;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("GET /analytics/funnel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with an array of funnel data rows", async () => {
    const fakeRows = [
      {
        event_type: "signup_completed",
        count: 42,
        unique_users: 38,
        day: "2026-03-01",
      },
      {
        event_type: "mcp_server_connected",
        count: 20,
        unique_users: 18,
        day: "2026-03-01",
      },
    ];

    const db = mockDb(fakeRows);
    const { app } = createApp(db);

    const res = await app.request(
      "/analytics/funnel",
      { method: "GET", headers: { "x-internal-secret": TEST_INTERNAL_SECRET } },
      makeEnv(db),
    );

    expect(res.status).toBe(200);

    const body = await res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);

    const first = body[0] as Record<string, unknown>;
    expect(first.event_type).toBe("signup_completed");
    expect(first.count).toBe(42);
  });

  it("returns 200 with an empty array when D1 returns no rows", async () => {
    const db = mockDb([]);
    const { app } = createApp(db);

    const res = await app.request(
      "/analytics/funnel",
      { method: "GET", headers: { "x-internal-secret": TEST_INTERNAL_SECRET } },
      makeEnv(db),
    );

    expect(res.status).toBe(200);

    const body = await res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("returns 401 without internal secret", async () => {
    const db = mockDb([]);
    const { app } = createApp(db);

    const res = await app.request("/analytics/funnel", { method: "GET" }, makeEnv(db));

    expect(res.status).toBe(401);
  });
});
