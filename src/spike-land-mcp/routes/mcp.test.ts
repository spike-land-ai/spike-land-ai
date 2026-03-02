import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../auth/middleware";
import { createMockKV, mockEnv } from "../__test-utils__/mock-env";

// Mock the MCP server creation to avoid pulling in all tool dependencies
vi.mock("../mcp/server", () => ({
  createMcpServer: vi.fn().mockImplementation(async () => ({
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock the transport with a real class (vi.fn arrow functions aren't constructable)
vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => {
  class MockTransport {
    async handleRequest() {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            tools: [
              { name: "search_tools" },
              { name: "enable_category" },
              { name: "disable_category" },
              { name: "list_categories" },
              { name: "get_status" },
            ],
          },
          id: 1,
        }),
        { status: 200, headers: new Headers({ "Content-Type": "application/json" }) },
      );
    }
  }
  return { WebStandardStreamableHTTPServerTransport: MockTransport };
});

/**
 * Build a test app that mirrors the real app's mount structure.
 * Uses the real createApp pattern: auth middleware on /mcp/*, route on /mcp.
 */
async function buildTestApp() {
  const { mcpRoute } = await import("./mcp");

  // Test the mcpRoute directly, pre-setting userId as the auth middleware would
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  // Simulate auth: set userId for authenticated requests, reject unauthenticated
  app.use("*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice("Bearer ".length);
    if (token === "valid-test-token") {
      c.set("userId", "user-test-123");
      return next();
    } else {
      return c.json({ error: "Unauthorized", message: "Invalid token" }, 401);
    }
  });

  // Mount the mcpRoute at root -- test requests go to "/"
  app.route("/", mcpRoute);
  return app;
}

describe("POST /mcp (mcpRoute handler)", () => {
  let env: ReturnType<typeof mockEnv>;

  beforeEach(() => {
    env = mockEnv({ KV: createMockKV() });
  });

  it("returns 401 without auth header", async () => {
    const app = await buildTestApp();

    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid token", async () => {
    const app = await buildTestApp();

    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("returns 200 with valid auth and JSON-RPC body", async () => {
    const app = await buildTestApp();

    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-test-token",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { jsonrpc: string; result: { tools: unknown[] } };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.result.tools).toHaveLength(5);
  });

  it("returns 429 when rate limited", async () => {
    const app = await buildTestApp();

    // Pre-fill KV with exhausted rate limit
    const kvKey = "rl:mcp-rpc:user-test-123";
    const entry = { count: 121, windowStart: Date.now() };
    await env.KV.put(kvKey, JSON.stringify(entry), { expirationTtl: 70 });

    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-test-token",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
      },
      env,
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Rate limit exceeded");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = await buildTestApp();

    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-test-token",
        },
        body: "not valid json {{{",
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });
});

describe("GET /mcp (mcpRoute handler)", () => {
  it("returns 401 without auth", async () => {
    const app = await buildTestApp();
    const env = mockEnv();

    const res = await app.request("/", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  it("returns 405 with auth", async () => {
    const app = await buildTestApp();
    const env = mockEnv();

    const res = await app.request(
      "/",
      {
        method: "GET",
        headers: { Authorization: "Bearer valid-test-token" },
      },
      env,
    );

    expect(res.status).toBe(405);
  });
});
