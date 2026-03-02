/**
 * Tests for routes/oauth.ts
 *
 * Covers: POST /oauth/device, POST /oauth/token, POST /oauth/device/approve
 */

import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { oauthRoute } from "./oauth";
import { createMockD1, createMockKV } from "../__test-utils__/mock-env";
import type { Env } from "../env";

function makeApp(d1Handler?: Parameters<typeof createMockD1>[0]) {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/oauth", oauthRoute);
  return app;
}

function makeEnv(d1Handler?: Parameters<typeof createMockD1>[0]) {
  return {
    DB: createMockD1(d1Handler),
    KV: createMockKV(),
    MCP_JWT_SECRET: "test-jwt-secret-at-least-32-chars-long",
    MCP_INTERNAL_SECRET: "test-internal-secret",
    ANTHROPIC_API_KEY: "sk-ant-test",
    OPENAI_API_KEY: "sk-test",
    GEMINI_API_KEY: "gemini-test",
    ELEVENLABS_API_KEY: "el-test",
    APP_ENV: "test",
    SPIKE_LAND_URL: "https://spike.land",
  };
}

// ─── POST /oauth/device ───────────────────────────────────────────────────────

describe("POST /oauth/device", () => {
  it("returns device_code, user_code, verification_uri, expires_in, interval", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: "client-1", scope: "mcp" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.device_code).toMatch(/^dc_[a-f0-9]+$/);
    expect(body.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(body.verification_uri).toContain("spike.land");
    expect(body.verification_uri_complete).toContain(body.user_code as string);
    expect(body.expires_in).toBe(600);
    expect(body.interval).toBe(5);
  });

  it("works with empty body (no client_id or scope)", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { device_code: string };
    expect(body.device_code).toMatch(/^dc_/);
  });

  it("uses SPIKE_LAND_URL env var for verification_uri", async () => {
    const env = makeEnv();
    env.SPIKE_LAND_URL = "https://custom.example.com";

    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      env,
    );

    const body = (await res.json()) as { verification_uri: string };
    expect(body.verification_uri).toContain("custom.example.com");
  });

  it("handles invalid JSON body gracefully", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device", {
        method: "POST",
        body: "not-json",
      }),
      makeEnv(),
    );

    // Should still return 200 (defaults to empty object)
    expect(res.status).toBe(200);
  });
});

// ─── POST /oauth/token ────────────────────────────────────────────────────────

describe("POST /oauth/token", () => {
  it("returns 400 for unsupported grant type", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unsupported_grant_type");
  });

  it("returns 400 when device_code is missing", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 with expired_token when code not found", async () => {
    const app = makeApp(() => ({ results: [], success: true, meta: {} }));
    const res = await app.fetch(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "dc_nonexistent",
        }),
      }),
      makeEnv(() => ({ results: [], success: true, meta: {} })),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("expired_token");
  });

  it("returns 400 with authorization_pending for un-approved code", async () => {
    const now = Date.now();
    const d1Handler = (sql: string) => {
      if (sql.toLowerCase().includes("select")) {
        return {
          results: [
            {
              id: "dc-1",
              user_id: null,
              device_code: "dc_pending",
              user_code: "ABCD-EFGH",
              scope: "mcp",
              client_id: null,
              expires_at: now + 300_000,
              approved: 0,
              created_at: now,
            },
          ],
          success: true,
          meta: {},
        };
      }
      return { results: [], success: true, meta: {} };
    };

    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "dc_pending",
        }),
      }),
      makeEnv(d1Handler),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("authorization_pending");
  });

  it("handles invalid JSON body gracefully", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        body: "not-json",
      }),
      makeEnv(),
    );

    // Falls through to unsupported_grant_type since grant_type is undefined
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unsupported_grant_type");
  });
});

// ─── POST /oauth/device/approve ───────────────────────────────────────────────

describe("POST /oauth/device/approve", () => {
  it("returns 401 when X-Internal-Secret header is missing", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: "ABCD-EFGH", user_id: "user-1" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(401);
  });

  it("returns 401 when X-Internal-Secret is wrong", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": "wrong-secret",
        },
        body: JSON.stringify({ user_code: "ABCD-EFGH", user_id: "user-1" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when user_code is missing", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": "test-internal-secret",
        },
        body: JSON.stringify({ user_id: "user-1" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when user_id is missing", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": "test-internal-secret",
        },
        body: JSON.stringify({ user_code: "ABCD-EFGH" }),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when user_code not found in DB", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/oauth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": "test-internal-secret",
        },
        body: JSON.stringify({ user_code: "FAKE-CODE", user_id: "user-1" }),
      }),
      makeEnv(() => ({ results: [], success: true, meta: {} })),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });
});
