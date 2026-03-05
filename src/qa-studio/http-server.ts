import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Keep track of active transports to route messages
const transports = new Map<string, SSEServerTransport>();

export function startHttpServer(server: McpServer, port: number, host: string) {
  const app = express();

  app.use(
    cors({
      origin: [/^http:\/\/localhost:\d+$/, "https://spike.land"],
      credentials: true,
      exposedHeaders: ["mcp-session-id"],
    })
  );

  // Parse JSON bodies for POST requests (except SSE which has its own format)
  app.use(express.json());

  app.get("/mcp", async (_req, res) => {
    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.setHeader("mcp-session-id", sessionId);

    // When the transport is closed, clean it up
    transport.onclose = () => {
      transports.delete(sessionId);
    };

    await server.connect(transport);
  });

  app.post("/mcp/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send("Missing sessionId query parameter");
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling message:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing message");
      }
    }
  });

  app.delete("/mcp", (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (sessionId) {
      const transport = transports.get(sessionId);
      if (transport) {
        transport.close();
        transports.delete(sessionId);
      }
    }
    res.status(200).send("Session cleaned up");
  });

  app.listen(port, host, () => {
    console.log(`QA Studio MCP Server listening on http://${host}:${port}/mcp`);
  });
}
