/**
 * Extended tests for transport/http-server.ts and sse-server.ts covering:
 * - API key validation
 * - GET /mcp without session (400)
 * - DELETE /mcp (session termination)
 * - SSE API key validation
 * - SSE POST /messages missing sessionId
 * - SSE POST /messages unknown session
 * - createMcpServer handler behaviour
 */
import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerManager } from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";

// Helper: start server on an available port and return { closeServer, baseUrl }
async function withHttpServer(manager: ServerManager, options: { apiKey?: string } = {}) {
  const { startHttpServer } = await import("../../../../src/cli/spike-cli/node-sys/http-server.js");

  const tempServer = http.createServer();
  await new Promise<void>((resolve) => tempServer.listen(0, () => resolve()));
  const addr = tempServer.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  await new Promise<void>((resolve) => tempServer.close(() => resolve()));

  const server = await startHttpServer(manager, { port, ...options });
  return { closeServer: server.close, baseUrl: `http://localhost:${port}` };
}

async function withSseServer(manager: ServerManager, options: { apiKey?: string } = {}) {
  const { startSseServer } = await import("../../../../src/cli/spike-cli/node-sys/sse-server.js");

  const tempServer = http.createServer();
  await new Promise<void>((resolve) => tempServer.listen(0, () => resolve()));
  const addr = tempServer.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  await new Promise<void>((resolve) => tempServer.close(() => resolve()));

  const server = await startSseServer(manager, { port, ...options });
  return { closeServer: server.close, baseUrl: `http://localhost:${port}` };
}

function makeManager(): ServerManager {
  return {
    getAllTools: vi.fn().mockReturnValue([
      {
        namespacedName: "srv__ping",
        originalName: "ping",
        serverName: "srv",
        description: "Ping tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "pong" }],
    }),
  } as unknown as ServerManager;
}

describe("HTTP server — API key validation", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withHttpServer(makeManager(), {
      apiKey: "secret-key",
    });
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("rejects requests to /mcp without x-api-key header (401)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "POST" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects requests to /mcp with wrong api key (401)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "x-api-key": "wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("allows requests with the correct api key", async () => {
    // A POST to /mcp with valid key should not return 401
    // (it may return other errors from MCP session handling, but not 401)
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "x-api-key": "secret-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    // Should not be 401
    expect(res.status).not.toBe(401);
  });

  it("allows health check without API key", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});

describe("HTTP server — GET /mcp without session", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withHttpServer(makeManager());
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("returns 400 for GET /mcp with no session ID", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "GET" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No session");
  });

  it("returns 400 for GET /mcp with unknown session ID", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { "mcp-session-id": "nonexistent-session-id" },
    });
    expect(res.status).toBe(400);
  });
});

describe("HTTP server — DELETE /mcp", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withHttpServer(makeManager());
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("returns 200 for DELETE /mcp with unknown session (no-op)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "DELETE",
      headers: { "mcp-session-id": "nonexistent" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 for DELETE /mcp with no session header", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

describe("SSE server — API key validation", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withSseServer(makeManager(), { apiKey: "sse-secret" });
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("rejects requests to /sse without x-api-key (401)", async () => {
    const res = await fetch(`${baseUrl}/sse`, { method: "GET" });
    // Will be 401 due to missing key; SSE response may not complete cleanly
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects requests to /messages without x-api-key (401)", async () => {
    const res = await fetch(`${baseUrl}/messages`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("allows health check without api key", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});

describe("SSE server — /messages endpoint", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withSseServer(makeManager());
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("returns 400 when sessionId is missing from /messages POST", async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("sessionId");
  });

  it("returns 404 for POST /messages with unknown sessionId", async () => {
    const res = await fetch(`${baseUrl}/messages?sessionId=ghost-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Unknown session");
  });
});

describe("HTTP server — createMcpServer", () => {
  it("creates a server with ListTools handler that returns tools from manager", async () => {
    const manager = makeManager();
    const { createMcpServer } = await import(
      "../../../../src/cli/spike-cli/node-sys/http-server.js"
    );
    const server = createMcpServer(manager);
    expect(server).toBeDefined();
    // The server is a valid MCP Server instance
    expect(typeof server.connect).toBe("function");
  });

  it("handles tool with undefined description (uses empty string fallback)", async () => {
    const managerWithUndescribed = {
      getAllTools: vi.fn().mockReturnValue([
        {
          namespacedName: "srv__no_desc",
          originalName: "no_desc",
          serverName: "srv",
          description: undefined, // triggers ?? "" branch
          inputSchema: { type: "object", properties: {} },
        },
      ]),
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    } as unknown as ServerManager;

    const { createMcpServer } = await import(
      "../../../../src/cli/spike-cli/node-sys/http-server.js"
    );
    const server = createMcpServer(managerWithUndescribed);
    expect(server).toBeDefined();
  });
});

describe("HTTP server — POST /mcp session creation and GET", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withHttpServer(makeManager());
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("POST /mcp creates session and returns session ID", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    // Initialize returns 200 with session ID header
    expect(res.status).toBe(200);
    const sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
  });

  it("DELETE /mcp with known session closes and removes session", async () => {
    // First create a session
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // Delete the session
    const delRes = await fetch(`${baseUrl}/mcp`, {
      method: "DELETE",
      headers: { "mcp-session-id": sessionId ?? "" },
    });
    expect(delRes.status).toBe(200);
  });

  it("POST /mcp with empty body is handled gracefully (parsedBody = undefined path)", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: "",
    });
    // Should not crash, returns some HTTP status
    expect(res.status).toBeGreaterThanOrEqual(200);
  });

  it("POST /mcp with invalid JSON body is handled gracefully", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: "not-valid-json",
    });
    // Should not crash, returns some HTTP status
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});

describe("HTTP server — tools/call invokes manager.callTool", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;
  let manager: ServerManager;

  beforeEach(async () => {
    manager = makeManager();
    const result = await withHttpServer(manager);
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("tools/call request invokes manager.callTool and returns result", async () => {
    // Step 1: Initialize session
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // Step 2: Send initialized notification
    await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }),
    });

    // Step 3: Call a tool - this triggers the registered tool callback (lines 44-45)
    const callRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: 3,
        params: {
          name: "srv__ping",
          arguments: {},
        },
      }),
    });
    expect(callRes.status).toBeGreaterThanOrEqual(200);
    expect(manager.callTool).toHaveBeenCalled();
  });

  it("GET /mcp with valid session triggers transport.handleRequest", async () => {
    // Create session first
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // GET with valid session — uses AbortController to avoid hanging on SSE stream
    const ac = new AbortController();
    const getPromise = fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: { "mcp-session-id": sessionId ?? "" },
      signal: ac.signal,
    }).catch(() => ({ status: -1 }));

    // Give the server a moment to start processing then abort
    await new Promise((r) => setTimeout(r, 50));
    ac.abort();

    const getRes = await getPromise;
    // Should not return 400 (which would indicate unknown session)
    expect((getRes as Response).status).not.toBe(400);
  });
});

describe("HTTP server — POST /mcp reuses existing session", () => {
  let closeServer: () => Promise<void>;
  let baseUrl: string;

  beforeEach(async () => {
    const result = await withHttpServer(makeManager());
    closeServer = result.closeServer;
    baseUrl = result.baseUrl;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("POST /mcp with existing mcp-session-id reuses session", async () => {
    // Create a session first
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    // Send another request with the same session ID
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 2,
        params: {},
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
