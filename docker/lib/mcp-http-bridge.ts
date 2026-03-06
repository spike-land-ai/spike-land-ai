#!/usr/bin/env tsx
/**
 * MCP HTTP Bridge -- wraps a stdio MCP server module as an HTTP endpoint.
 *
 * Usage: npx tsx docker/lib/mcp-http-bridge.ts <server-module-path> <port>
 *
 * The module must export an McpServer instance (default or named `server`).
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const [modulePath, portStr] = process.argv.slice(2);
if (!modulePath || !portStr) {
  console.error("Usage: mcp-http-bridge.ts <server-module> <port>");
  process.exit(1);
}

const port = parseInt(portStr, 10);
const mod = await import(new URL(modulePath, `file://${process.cwd()}/`).href);
const server = mod.default ?? mod.server;

if (!server?.connect) {
  console.error(`Module ${modulePath} does not export an McpServer with connect()`);
  process.exit(1);
}

const sessions = new Map<string, StreamableHTTPServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const method = req.method?.toUpperCase();

  if (method === "DELETE") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.close();
      sessions.delete(sessionId);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (method === "GET") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid session" }));
      return;
    }
    await sessions.get(sessionId)!.handleRequest(req, res);
    return;
  }

  if (method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    let parsed: unknown;
    try {
      parsed = body ? JSON.parse(body) : undefined;
    } catch {
      parsed = undefined;
    }

    const existingId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (existingId && sessions.has(existingId)) {
      transport = sessions.get(existingId)!;
    } else {
      const sessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
      await server.connect(transport as unknown as Transport);
      sessions.set(sessionId, transport);
      transport.onclose = () => sessions.delete(sessionId);
    }

    await transport.handleRequest(req, res, parsed);
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
});

httpServer.listen(port, "0.0.0.0", () => {
  process.stderr.write(`MCP HTTP bridge listening on 0.0.0.0:${port} for ${modulePath}\n`);
});
