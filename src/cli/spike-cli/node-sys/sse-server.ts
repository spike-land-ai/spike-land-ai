/**
 * SSE transport for the MCP multiplexer (legacy SSE protocol).
 *
 * Uses the deprecated SSEServerTransport from the MCP SDK for backwards compatibility.
 * Each GET /sse request gets its own SSEServerTransport instance keyed by session ID.
 */

import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerManager } from "../core-logic/multiplexer/server-manager.js";

export interface SseServerOptions {
  port: number;
  /** Optional API key — if provided, all /sse and /messages requests must include x-api-key. */
  apiKey?: string;
}

export interface ServerHandle {
  /** Close the SSE server gracefully. */
  close: () => Promise<void>;
}

function buildMcpServer(manager: ServerManager): Server {
  const server = new Server(
    { name: "spike-multiplexer-sse", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: manager.getAllTools().map((t) => ({
      name: t.namespacedName,
      description: t.description ?? "",
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req, _extra) => {
    const { name, arguments: args } = req.params;
    try {
      const result = await manager.callTool(name, (args ?? {}) as Record<string, unknown>);
      return result as unknown as CallToolResult;
    } catch (err) {
      return {
        content: [{ type: "text", text: String(err) }],
        isError: true,
      } as CallToolResult;
    }
  });

  return server;
}

/**
 * Start a legacy SSE MCP server on the given port.
 * Returns a handle with a `close()` method.
 */
export async function startSseServer(
  manager: ServerManager,
  options: SseServerOptions,
): Promise<ServerHandle> {
  const { port, apiKey } = options;

  const sessions = new Map<string, SSEServerTransport>();

  const rawServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase();

    // Health check — no auth required
    if (pathname === "/health") {
      const toolCount = manager.getAllTools().length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: toolCount }));
      return;
    }

    // API key check — hash both keys to constant length before comparing to
    // prevent timing attacks including key-length leakage (CWE-208)
    if (apiKey && (pathname === "/sse" || pathname === "/messages")) {
      const _hmacKey = Buffer.alloc(32);
      const _hash = (s: string) => createHmac("sha256", _hmacKey).update(s).digest();
      const providedKey = req.headers["x-api-key"];
      const authorized =
        typeof providedKey === "string" && timingSafeEqual(_hash(providedKey), _hash(apiKey));
      if (!authorized) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // SSE connection endpoint
    if (pathname === "/sse" && method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      sessions.set(sessionId, transport);

      transport.onclose = () => {
        sessions.delete(sessionId);
      };

      const server = buildMcpServer(manager);
      await server.connect(transport);
      return;
    }

    // Message POST endpoint
    if (pathname === "/messages" && method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
        return;
      }

      const transport = sessions.get(sessionId);
      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Unknown session: ${sessionId}` }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    // Unknown path
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    rawServer.once("error", reject);
    rawServer.listen(port, () => resolve());
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        rawServer.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
