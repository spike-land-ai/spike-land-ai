import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";
import { createD1Credits } from "./deps/credits.ts";
import { createD1Db } from "./deps/db.ts";
import { createGeminiGeneration } from "./deps/generation.ts";
import { nanoid } from "./deps/nanoid.ts";
import { createResolvers } from "./deps/resolvers.ts";
import { createR2Storage } from "./deps/storage.ts";
import type { Env } from "./env.d.ts";
import { buildMcpServer } from "./server.ts";
import { createToolRegistry } from "./tool-registry.ts";
import { validateSession } from "./auth.ts";
import { handleChatStream } from "./agent/chat-handler.ts";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version", "X-Gemini-Key", "X-Text-Model", "X-Image-Model", "X-Thinking-Budget"],
    exposeHeaders: ["Mcp-Session-Id"],
    credentials: true,
  }),
);

// Provide R2 image fetching (public)
app.get("/r2/:key", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.IMAGE_R2.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

app.get("/:userId/:filename{.+\\.\\w+$}", async (c) => {
  const userId = c.req.param("userId");
  const filename = c.req.param("filename");
  const obj = await c.env.IMAGE_R2.get(`${userId}/${filename}`);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// Proxy all /api/auth/* requests to the central auth service (auth-mcp.spike.land)
app.all("/api/auth/*", async (c) => {
  const authUrl = c.env.AUTH_SERVICE_URL || "https://auth-mcp.spike.land";
  const url = new URL(c.req.url);
  const targetUrl = `${authUrl}${url.pathname}${url.search}`;

  const forwardHeaders = new Headers(c.req.raw.headers);
  forwardHeaders.delete("host");

  try {
    const res = await fetch(targetUrl, {
      method: c.req.method,
      headers: forwardHeaders,
      body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
      redirect: "manual",
    });

    const ct = res.headers.get("content-type") ?? "";
    const isGetSession = url.pathname.endsWith("/get-session");

    // For get-session: HTML error pages mean "no session" — return null gracefully.
    // For other endpoints (sign-in, callback): forward the actual error so the client can handle it.
    if (!res.ok && ct.includes("text/html")) {
      if (isGetSession) {
        return c.json(null, 200);
      }
      console.error(`[auth-proxy] Upstream HTML error on ${url.pathname}: ${res.status} ${res.statusText}`);
      return c.json({ error: `Auth service error: ${res.status}` }, res.status as 400);
    }

    // Forward the response back, preserving status, headers, and cookies
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set("Access-Control-Allow-Origin", url.origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[auth-proxy] Failed to reach auth service for ${url.pathname}: ${msg}`);

    // For get-session, gracefully return null (no session). For other endpoints, surface the error.
    const isGetSession = url.pathname.endsWith("/get-session");
    if (isGetSession) {
      return c.json(null, 200);
    }
    return c.json({ error: "Auth service unreachable" }, 502);
  }
});

// Build standard deps per request
async function buildDeps(c: { req: { raw: Request; url: string; header: (name: string) => string | undefined; method: string }; env: Env }) {
  let userId = "demo-user"; // Default for MCP/CLI demo access

  // Validate session via auth-mcp.spike.land
  const session = await validateSession(c.req.raw.headers, c.env);
  if (session) {
    userId = session.user.id;
  } else {
    // Check for DEMO_TOKEN
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token && token !== c.env.DEMO_TOKEN) {
      throw new Error("Unauthorized");
    }
  }

  const baseUrl = new URL(c.req.url).origin;
  const userGeminiKey = c.req.header("X-Gemini-Key");
  const imageModel = c.req.header("X-Image-Model");
  const db = createD1Db(c.env);
  const credits = createD1Credits(c.env);
  const storage = createR2Storage(c.env, baseUrl);
  const generation = createGeminiGeneration(c.env, db, credits, storage, {
    userApiKey: userGeminiKey,
    modelName: imageModel
  });
  const resolvers = createResolvers(db, userId);

  return {
    userId,
    deps: { db, credits, storage, generation, resolvers, nanoid } as ImageStudioDeps,
  };
}

// REST APIs
app.get("/api/tools", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const toolRegistry = createToolRegistry(userId, deps);
  return c.json({ tools: toolRegistry.list() });
});

app.get("/api/monitoring/calls", async (c) => {
  const { deps } = await buildDeps(c);
  if (deps.db.toolCallList) {
    const calls = await deps.db.toolCallList({ limit: 1000 });
    return c.json({ calls });
  }
  return c.json({ calls: [] });
});

app.post("/api/tool", async (c) => {
  const body = await c.req.json<{ name: string; arguments?: Record<string, unknown> }>();
  if (!body.name) return c.json({ error: "Missing tool name" }, 400);

  const { userId, deps } = await buildDeps(c);
  const toolRegistry = createToolRegistry(userId, deps);
  const result = await toolRegistry.call(body.name, body.arguments ?? {});
  return c.json({ result });
});

// Chat agent endpoint
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{ message: string; history?: Array<{ role: string; content: string }> }>();
    if (!body.message) return c.json({ error: "Missing message" }, 400);

    const userGeminiKey = c.req.header("X-Gemini-Key");

    const { userId, deps } = await buildDeps(c);
    const toolRegistry = createToolRegistry(userId, deps);
    const textModel = c.req.header("X-Text-Model");
    const thinkingBudget = c.req.header("X-Thinking-Budget");

    const stream = await handleChatStream(body, toolRegistry, c.env, {
      userGeminiKey,
      modelName: textModel,
      thinkingBudget
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat failed";
    console.error("Chat endpoint error:", msg);
    return c.json({ error: msg }, 500);
  }
});

// MCP SSE Transport
// Global mapped transports work in Cloudflare Workers because they run per isolate.
// The WebStandardStreamableHTTPServerTransport handles requests natively.
let globalTransport: WebStandardStreamableHTTPServerTransport | null = null;

app.all("/mcp/*", async (c) => {
  const { userId, deps } = await buildDeps(c);
  const server = buildMcpServer(userId, deps);

  if (!globalTransport) {
    globalTransport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: nanoid, // stateful mode, required for SSE
      enableJsonResponse: true,
    });
    await server.connect(globalTransport);
  }

  // WebStandardStreamableHTTPServerTransport automatically handles SSE initialization on GET
  // and message receiving on POST based on request patterns.
  return globalTransport.handleRequest(c.req.raw);
});

// SPA Fallback for static assets
app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
