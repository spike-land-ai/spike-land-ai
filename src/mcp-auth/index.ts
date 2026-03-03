import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { createAuth, type Env } from "./auth";

// CORS configuration for Better Auth and MCP
const ALLOWED_ORIGINS = [
  "https://image-studio-mcp.spike.land",
  "https://auth-mcp.spike.land",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "");
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      const corsOrigin = getCorsOrigin(request);
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": corsOrigin },
      });
    }

    const url = new URL(request.url);

    // 1. Better Auth catch-all API routes (OAuth, Magic Links, Session queries)
    if (url.pathname.startsWith("/api/auth/")) {
      const auth = createAuth(env);
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
        const auth = createAuth(env);
        // We simulate a request since better-auth typically extracts the token from headers
        const req = new Request(url.href, {
          headers: {
            cookie: `better-auth.session_token=${sessionToken}`,
          },
        });
        const sessionResult = await auth.api.getSession({ headers: req.headers });
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
      },
    );

    mcpServer.tool(
      "get-user-by-email",
      "Lookup a user's ID by their email address",
      { email: z.string().email() },
      async ({ email }) => {
        const db = drizzle(env.AUTH_DB, { schema });
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
      },
    );

    // 3. Setup standard MCP WebTransport Endpoint
    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await mcpServer.connect(transport);

    const response = await transport.handleRequest(request);
    return withCors(response, request);
  },
};
