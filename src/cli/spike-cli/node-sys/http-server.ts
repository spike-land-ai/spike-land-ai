/**
 * HTTP (StreamableHTTP) transport for the MCP multiplexer.
 *
 * Implements the MCP Streamable HTTP transport spec using Node.js http module.
 * Each incoming request gets its own transport instance (stateful session model).
 */

import http from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { NamespacedTool, ServerManager } from "../core-logic/multiplexer/server-manager.js";

export interface HttpServerOptions {
  port: number;
  /** Optional API key — if provided, all /mcp requests must include x-api-key header. */
  apiKey?: string;
}

export interface ServerHandle {
  /** Close the HTTP server gracefully. */
  close: () => Promise<void>;
}

/**
 * Build an McpServer that exposes all tools from the given manager.
 */
export function createMcpServer(manager: ServerManager): McpServer {
  const server = new McpServer(
    { name: "spike-multiplexer", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // Register all tools. McpServer's tool() method handles ListTools + CallTool.
  // We re-register when tools change but for simplicity register once at start.
  const tools: NamespacedTool[] = manager.getAllTools();
  for (const tool of tools) {
    server.tool(
      tool.namespacedName,
      tool.description ?? "",
      tool.inputSchema as Parameters<typeof server.tool>[2],
      async (args: Record<string, unknown>) => {
        const result = await manager.callTool(tool.namespacedName, args);
        return result as unknown as CallToolResult;
      },
    );
  }

  return server;
}

/**
 * Start a StreamableHTTP MCP server on the given port.
 * Returns a handle with a `close()` method.
 */
export async function startHttpServer(
  manager: ServerManager,
  options: HttpServerOptions,
): Promise<ServerHandle> {
  const { port, apiKey } = options;

  // Map from session ID to transport instance
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const rawServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // Health check — no auth required
    if (pathname === "/health") {
      const toolCount = manager.getAllTools().length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: toolCount }));
      return;
    }

    // API key check for /mcp — hash both keys to constant length before comparing to
    // prevent timing attacks including key-length leakage (CWE-208)
    if (pathname === "/mcp" && apiKey) {
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

    if (pathname === "/mcp") {
      const method = req.method?.toUpperCase();

      if (method === "DELETE") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (sessionId) {
          const transport = sessions.get(sessionId);
          if (transport) {
            await transport.close();
            sessions.delete(sessionId);
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (method === "GET") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (!sessionId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No session ID provided" }));
          return;
        }
        if (!sessions.has(sessionId)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unknown session ID" }));
          return;
        }
        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found" }));
          return;
        }
        await transport.handleRequest(req, res);
        return;
      }

      if (method === "POST") {
        // Read body with a 1 MiB size cap to prevent memory exhaustion (CWE-770)
        const MAX_BODY_BYTES = 1 * 1024 * 1024;
        const bodyChunks: Buffer[] = [];
        let totalBytes = 0;
        for await (const chunk of req) {
          totalBytes += (chunk as Buffer).length;
          if (totalBytes > MAX_BODY_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request body too large" }));
            return;
          }
          bodyChunks.push(chunk as Buffer);
        }
        const bodyText = Buffer.concat(bodyChunks).toString("utf8");
        let parsedBody: unknown;
        try {
          parsedBody = bodyText ? JSON.parse(bodyText) : undefined;
        } catch {
          parsedBody = undefined;
        }

        const existingSessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (existingSessionId && sessions.has(existingSessionId)) {
          transport = sessions.get(existingSessionId) as StreamableHTTPServerTransport;
        } else {
          // New session
          const sessionId = randomUUID();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
          });

          const mcpServer = createMcpServer(manager);
          await mcpServer.connect(transport as unknown as Transport);
          sessions.set(sessionId, transport);

          transport.onclose = () => {
            sessions.delete(sessionId);
          };
        }

        await transport.handleRequest(req, res, parsedBody);
        return;
      }

      // Unsupported method
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
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
