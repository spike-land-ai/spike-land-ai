/**
 * Streamable HTTP MCP Endpoint (Hono)
 *
 * POST /mcp -- Handle MCP JSON-RPC requests
 * GET /mcp -- Returns 405
 * DELETE /mcp -- Session termination
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Env } from "../env";
import type { AuthVariables } from "../auth/middleware";
import { createMcpServer } from "../mcp/server";
import { loadEnabledCategories } from "../kv/categories";
import { checkRateLimit } from "../kv/rate-limit";

export const mcpRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

mcpRoute.post("/", async (c) => {
  const userId = c.var.userId;
  const db = c.var.db;

  // Rate limit by userId (120 req/60s)
  const { isLimited, resetAt } = await checkRateLimit(`mcp-rpc:${userId}`, c.env.KV);
  if (isLimited) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Rate limit exceeded" },
        id: null,
      },
      429,
      { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
    );
  }

  // Parse JSON-RPC request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error" },
        id: null,
      },
      400,
    );
  }

  // Load persisted categories from KV
  const enabledCategories = await loadEnabledCategories(userId, c.env.KV);

  // Create MCP server for this user
  const mcpServer = await createMcpServer(userId, db, { enabledCategories, kv: c.env.KV });

  // Normalize Accept header for MCP spec compliance
  const headers = new Headers(c.req.raw.headers);
  const accept = headers.get("Accept") ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    headers.set("Accept", "application/json, text/event-stream");
  }

  // parsedBody is passed directly to handleRequest, so no need to serialize body
  const mcpRequest = new Request(c.req.url, {
    method: "POST",
    headers,
    body: null,
  });

  // Stateless transport — always JSON (no hanging SSE streams)
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  await mcpServer.connect(transport);

  try {
    const response = await transport.handleRequest(mcpRequest, {
      parsedBody: body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: Object.fromEntries(
        Array.from(response.headers as unknown as Iterable<[string, string]>),
      ),
    });
  } catch (error) {
    console.error("MCP request error", error);
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      },
      500,
    );
  } finally {
    await mcpServer.close();
  }
});

mcpRoute.get("/", (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(
    {
      error: "SSE server-initiated mode not supported.",
      hint: "POST with Accept: text/event-stream for streaming.",
    },
    405,
  );
});

mcpRoute.delete("/", () => Response.json({ ok: true }));
