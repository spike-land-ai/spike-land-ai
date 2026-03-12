import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as Sentry from "@sentry/cloudflare";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createAuth, type Env } from "../db-auth/auth";
import {
  recordServiceRequestMetric,
  shouldTrackServiceMetricRequest,
} from "../../common/core-logic/service-metrics";
import {
  captureWorkerException,
  createWorkerSentryOptions,
  instrumentD1Bindings,
} from "../../common/core-logic/sentry";

// CORS configuration for Better Auth and MCP
const ALLOWED_ORIGINS = [
  "https://spike.land",
  "https://image-studio-mcp.spike.land",
  "https://auth-mcp.spike.land",
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "");
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Cookie",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Set-Cookie",
};

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  headers.set("Access-Control-Allow-Origin", getCorsOrigin(request));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default Sentry.withSentry((env: Env) => createWorkerSentryOptions("mcp-auth", env), {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const instrumentedEnv = instrumentD1Bindings(env, ["AUTH_DB", "STATUS_DB"]);
    const startedAt = Date.now();
    const shouldTrack = shouldTrackServiceMetricRequest(request);

    try {
      if (request.method === "OPTIONS") {
        const corsOrigin = getCorsOrigin(request);
        return new Response(null, {
          status: 204,
          headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": corsOrigin },
        });
      }

      const url = new URL(request.url);

      // Health endpoint
      if (url.pathname === "/health") {
        const deep = url.searchParams.get("deep") === "true";
        let d1Status = "ok";

        if (deep) {
          try {
            await instrumentedEnv.AUTH_DB.prepare("SELECT 1").first();
          } catch {
            d1Status = "degraded";
          }
        }

        const overall = d1Status === "ok" ? "ok" : "degraded";
        return withCors(
          new Response(
            JSON.stringify({
              status: overall,
              service: "mcp-auth",
              timestamp: new Date().toISOString(),
              ...(deep ? { d1: d1Status } : {}),
            }),
            {
              status: overall === "ok" ? 200 : 503,
              headers: { "Content-Type": "application/json" },
            },
          ),
          request,
        );
      }

      // Root redirect
      if (url.pathname === "/") {
        return withCors(
          new Response(null, {
            status: 302,
            headers: { Location: "https://spike.land" },
          }),
          request,
        );
      }

      // Suppress favicon noise
      if (url.pathname === "/favicon.ico") {
        return new Response(null, { status: 204 });
      }

      // 1. Better Auth catch-all API routes (OAuth, Magic Links, Session queries)
      if (url.pathname.startsWith("/api/auth/")) {
        const auth = createAuth(instrumentedEnv);
        const authResponse = await auth.handler(request);
        return withCors(authResponse, request);
      }

      // 2. MCP Server Configuration
      const mcpServer = new McpServer(
        { name: "Spike Auth Data Service", version: "1.0.0" },
        { capabilities: { tools: {} } },
      );

      // MCP Tools (Secure access for AI Agents & internal spikes)
      mcpServer.tool(
        "verify-session",
        "Verify if a user session token is valid and returns user ID and roles",
        { sessionToken: z.string() },
        async ({ sessionToken }) => {
          try {
            const auth = createAuth(instrumentedEnv);
            // We simulate a request since better-auth typically extracts the token from headers
            const req = new Request(url.href, {
              headers: {
                cookie: `better-auth.session_token=${sessionToken}`,
              },
            });
            const sessionResult = await auth.api.getSession({
              headers: req.headers,
            });
            if (!sessionResult?.session) {
              return {
                content: [{ type: "text", text: JSON.stringify({ valid: false }) }],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      valid: true,
                      user: sessionResult.user,
                      session: sessionResult.session,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (err) {
            captureWorkerException("mcp-auth", err, {
              request,
              tags: { tool: "verify-session" },
            });
            console.error("[mcp-auth] verify-session error:", err);
            return {
              content: [
                { type: "text", text: JSON.stringify({ valid: false, error: "Internal error" }) },
              ],
              isError: true,
            };
          }
        },
      );

      mcpServer.tool(
        "get-user-by-email",
        "Lookup a user's ID by their email address",
        { email: z.string().email() },
        async ({ email }) => {
          try {
            const db = drizzle(instrumentedEnv.AUTH_DB, { schema });
            const result = await db.query.user.findFirst({
              where: (u, { eq }) => eq(u.email, email),
            });
            if (!result) {
              return {
                content: [{ type: "text", text: JSON.stringify({ found: false }) }],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      found: true,
                      user: {
                        id: result.id,
                        email: result.email,
                        name: result.name,
                        role: result.role,
                      },
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (err) {
            captureWorkerException("mcp-auth", err, {
              request,
              tags: { tool: "get-user-by-email" },
              extras: { email },
            });
            console.error("[mcp-auth] get-user-by-email error:", err);
            return {
              content: [
                { type: "text", text: JSON.stringify({ found: false, error: "Internal error" }) },
              ],
              isError: true,
            };
          }
        },
      );

      // 3. Setup standard MCP WebTransport Endpoint
      if (url.pathname !== "/mcp") {
        return withCors(new Response("Not found", { status: 404 }), request);
      }

      // Gate MCP endpoint with internal secret to prevent user enumeration
      const internalSecret = request.headers.get("X-Internal-Secret");
      if (!internalSecret || internalSecret !== instrumentedEnv.MCP_INTERNAL_SECRET) {
        return withCors(
          new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
          request,
        );
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
      });

      try {
        await mcpServer.connect(transport);
      } catch (connectError) {
        captureWorkerException("mcp-auth", connectError, {
          request,
          tags: { operation: "connect-mcp-transport" },
        });
        console.error("[mcp-auth] Failed to connect MCP transport:", connectError);
        return withCors(
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "MCP transport connection failed" },
              id: null,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
          request,
        );
      }

      const response = await transport.handleRequest(request);
      return withCors(response, request);
    } catch (error) {
      captureWorkerException("mcp-auth", error, { request });
      console.error("[mcp-auth] Unhandled error:", error);
      return withCors(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
        request,
      );
    } finally {
      if (shouldTrack) {
        try {
          ctx?.waitUntil(
            recordServiceRequestMetric(
              instrumentedEnv.STATUS_DB,
              "Auth MCP",
              Date.now() - startedAt,
            ).catch((error) => {
              console.error("[service-metrics] failed to record auth request", error);
            }),
          );
        } catch {
          /* no ExecutionContext outside Workers runtime */
        }
      }
    }
  },
} satisfies ExportedHandler<Env>);
