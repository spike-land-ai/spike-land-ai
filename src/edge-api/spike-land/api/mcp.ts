/**
 * Streamable HTTP MCP Endpoint (Hono)
 *
 * POST /mcp -- Handle MCP JSON-RPC requests
 * GET /mcp -- Returns 405
 * DELETE /mcp -- Session termination
 */
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";
import { createMcpServer } from "../core-logic/mcp/server";
import { loadEnabledCategories } from "../core-logic/kv/categories";
import { checkRateLimit } from "../core-logic/kv/rate-limit";
import { hashClientId, sendGA4Events } from "../core-logic/lib/ga4";
import type { GA4Event } from "../core-logic/lib/ga4";
import { trackPlatformEvents } from "../core-logic/lib/analytics";
import type { AnalyticsEvent } from "../core-logic/lib/analytics";
import { recordSkillCall } from "../core-logic/lib/skill-tracker";
import { detectAbuse } from "../core-logic/middleware/abuse-detector";

function eloRateMultiplier(elo: number): number {
  if (elo < 500) return 4;
  if (elo < 800) return 2;
  return 1;
}

export const mcpRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

mcpRoute.post("/", async (c) => {
  const userId = c.var.userId;
  const db = c.var.db;
  const agentId = c.req.header("X-Agent-Id");

  let callerElo = 1200;
  let callerTier: "free" | "pro" | "business" = "free";
  let isAgent = false;

  try {
    if (agentId) {
      const res = await c.env.SPIKE_EDGE.fetch(
        `https://edge.spike.land/internal/agent-elo/${agentId}`,
        {
          headers: { "x-internal-secret": c.env.MCP_INTERNAL_SECRET },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { elo: number; tier: "free" | "pro" | "business" };
        callerElo = data.elo;
        callerTier = data.tier;
        isAgent = true;
      }
    } else {
      const res = await c.env.SPIKE_EDGE.fetch(`https://edge.spike.land/internal/elo/${userId}`, {
        headers: { "x-internal-secret": c.env.MCP_INTERNAL_SECRET },
      });
      if (res.ok) {
        const data = (await res.json()) as { elo: number; tier: "free" | "pro" | "business" };
        callerElo = data.elo;
        callerTier = data.tier;
      }
    }
  } catch (err) {
    console.error("[mcp] Failed to fetch ELO:", err);
  }

  // Rate limit by userId (120 req/60s)
  const { isLimited, resetAt } = await checkRateLimit(
    `mcp-rpc:${userId}`,
    c.env.KV,
    120,
    60000,
    eloRateMultiplier(callerElo),
  );
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

  const startTime = Date.now();

  // Load persisted categories from KV
  const enabledCategories = await loadEnabledCategories(userId, c.env.KV);

  // Create MCP server for this user
  const mcpServer = await createMcpServer(userId, db, {
    enabledCategories,
    kv: c.env.KV,
    vaultSecret: c.env.VAULT_SECRET,
    mcpInternalSecret: c.env.MCP_INTERNAL_SECRET,
    spikeEdge: c.env.SPIKE_EDGE,
    spaAssets: c.env.SPA_ASSETS,
  });

  // Set caller ELO for tool gating
  const mcpWithRegistry = mcpServer as unknown as Record<string, unknown>;
  if (mcpWithRegistry.registry) {
    const reg = mcpWithRegistry.registry as {
      setCallerElo(elo: number, tier: string, isAgent: boolean): void;
      setCallerRole(role: string): void;
    };
    reg.setCallerElo(callerElo, callerTier, isAgent);
    // Set caller role for RBAC
    const userRole = (c.var as Record<string, unknown>).userRole as string | undefined;
    if (userRole) {
      reg.setCallerRole(userRole);
    }
  }

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

  const sessionId = c.req.header("Mcp-Session-Id");

  // Stateful transport — supports both SSE streaming and JSON depending on headers
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId ?? crypto.randomUUID(),
  });

  await mcpServer.connect(transport);

  try {
    const response = await transport.handleRequest(mcpRequest, {
      parsedBody: body,
    });

    // Track MCP request via GA4 and platform analytics
    const durationMs = Date.now() - startTime;
    const method = (body as { method?: string })?.method ?? "unknown";
    const isToolCall = method === "tools/call";
    const toolName = isToolCall
      ? ((body as { params?: { name?: string } })?.params?.name ?? "unknown")
      : undefined;

    // Determine outcome by inspecting the JSON-RPC response body.
    // MCP returns HTTP 200 even for tool errors — the error is in the body.
    let outcome: "success" | "error" = response.status >= 400 ? "error" : "success";
    let responseBody: string | null = null;
    if (isToolCall && outcome === "success") {
      // Read body first — must succeed before we attempt to parse
      try {
        responseBody = await response.text();
      } catch {
        // Body read failed — responseBody stays null, response.body is consumed
      }
      // Parse separately so responseBody is always set if text() succeeded
      if (responseBody) {
        try {
          const parsed = JSON.parse(responseBody) as Record<string, unknown>;
          if ("error" in parsed) {
            outcome = "error";
          } else if (
            parsed.result &&
            typeof parsed.result === "object" &&
            (parsed.result as Record<string, unknown>).isError
          ) {
            outcome = "error";
          }
        } catch {
          // JSON parse failed — keep outcome as success
        }
      }
    }

    // Determine if flagged for abuse
    const isFlagged = await detectAbuse(c.env.KV, agentId ?? userId, outcome);
    if (isFlagged) {
      const endpoint = isAgent ? "/internal/agent-elo/event" : "/internal/elo/event";
      const payload = isAgent
        ? { agentId, ownerUserId: userId, eventType: "abuse_flag" }
        : { userId, eventType: "abuse_flag" };
      c.executionCtx.waitUntil(
        c.env.SPIKE_EDGE.fetch(`https://edge.spike.land${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": c.env.MCP_INTERNAL_SECRET,
          },
          body: JSON.stringify(payload),
        }).catch((err) => console.error("[mcp] Failed to report abuse:", err)),
      );
    }

    // 1. Send to GA4
    const ga4Events: GA4Event[] = [
      { name: "mcp_request", params: { method, user_id: userId, duration_ms: durationMs } },
    ];
    if (isToolCall && toolName) {
      ga4Events.push({
        name: "mcp_tool_call",
        params: {
          tool_name: toolName,
          server_name: "spike-land-mcp",
          outcome,
          user_id: userId,
          duration_ms: durationMs,
        },
      });
    }
    c.executionCtx.waitUntil(
      hashClientId(userId)
        .then((clientId) => sendGA4Events(c.env, clientId, ga4Events))
        .catch((err) => console.error("[GA4] Failed to send events:", err)),
    );

    // 2. Record skill call in D1 rollup tables
    if (isToolCall && toolName) {
      c.executionCtx.waitUntil(
        recordSkillCall(c.env.DB, {
          userId,
          toolName,
          serverName: "spike-land-mcp",
          outcome,
          durationMs,
        }).catch((err) => console.error("[skill-tracker] Failed to record:", err)),
      );
    }

    // 3. Send to platform analytics (D1 via spike-edge)
    const platformEvents: AnalyticsEvent[] = [
      { source: "spike-land-mcp", eventType: "mcp_request", metadata: { method, durationMs } },
    ];
    if (isToolCall && toolName) {
      platformEvents.push({
        source: "spike-land-mcp",
        eventType: "tool_use",
        metadata: { toolName, serverName: "spike-land-mcp", outcome, durationMs },
      });
    }
    c.executionCtx.waitUntil(trackPlatformEvents(c.env.SPIKE_EDGE, platformEvents));

    // Return response — re-create if body was consumed for outcome detection
    const finalBody = responseBody ?? response.body;
    return new Response(finalBody, {
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

mcpRoute.get("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.var.userId;
  const db = c.var.db;

  const enabledCategories = await loadEnabledCategories(userId, c.env.KV);
  const mcpServer = await createMcpServer(userId, db, {
    enabledCategories,
    kv: c.env.KV,
    vaultSecret: c.env.VAULT_SECRET,
    mcpInternalSecret: c.env.MCP_INTERNAL_SECRET,
    spikeEdge: c.env.SPIKE_EDGE,
    spaAssets: c.env.SPA_ASSETS,
  });

  const sessionId = c.req.header("Mcp-Session-Id");
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId ?? crypto.randomUUID(),
  });

  await mcpServer.connect(transport);

  const headers = new Headers(c.req.raw.headers);
  const accept = headers.get("Accept") ?? "";
  if (!accept.includes("text/event-stream")) {
    headers.set("Accept", "text/event-stream");
  }

  const req = new Request(c.req.url, {
    method: "GET",
    headers,
    body: null,
  });

  return transport.handleRequest(req);
});

mcpRoute.delete("/", () => Response.json({ ok: true }));
