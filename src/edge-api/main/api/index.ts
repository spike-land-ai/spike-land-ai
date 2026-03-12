import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "../core-logic/env.js";
import { createLogger } from "@spike-land-ai/shared";
import { RateLimiter } from "../edge/rate-limiter.js";
import { authMiddleware } from "./middleware/auth.js";
import { health } from "./routes/health.js";
import { r2 } from "./routes/r2.js";
import { proxy } from "./routes/proxy.js";
import { live } from "./routes/live.js";
import { openAiCompatible } from "./routes/openai-compatible.js";
import { analytics } from "./routes/analytics.js";
import { quizBadge } from "./routes/quiz-badge.js";
import { version } from "./routes/version.js";
import { blog } from "./routes/blog.js";
import { errors } from "./routes/errors.js";
import { bugbook } from "./routes/bugbook.js";
import { blogComments } from "./routes/blog-comments.js";
import { whatsapp } from "./routes/whatsapp.js";
import { stripeWebhook } from "./routes/stripe-webhook.js";
import { checkout } from "./routes/checkout.js";
import { userProfile } from "./routes/user-profile.js";
import { billing } from "./routes/billing.js";
import { apiKeys } from "./routes/api-keys.js";
import { cockpit } from "./routes/cockpit.js";
import { credits } from "./routes/credits.js";
import { creditMeterMiddleware } from "./middleware/credit-meter.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { buildMcpProxyHeaders } from "./middleware/mcp-proxy-auth.js";
import { support } from "./routes/support.js";
import { pricingApi } from "./routes/pricing-api.js";
import { experiments } from "./routes/experiments.js";
import { fixer } from "./routes/fixer.js";
import { cachePurge } from "./routes/cache-purge.js";
import { chat } from "./routes/chat.js";
import { settings } from "./routes/settings.js";
import { spikeChat } from "./routes/spike-chat.js";
import { spa } from "./routes/spa.js";
import { wellKnown } from "./routes/well-known.js";
import { sitemap } from "./routes/sitemap.js";
import { githubStars } from "./routes/github-stars.js";
import { docsApi } from "./routes/docs-api.js";
import { handleScheduled } from "../lazy-imports/scheduled.js";
import { applySecurityHeaders, isAllowedBrowserOrigin } from "./lib/security-headers.js";
import {
  recordServiceRequestMetric,
  shouldTrackServiceMetricRequest,
} from "../../common/core-logic/service-metrics.js";

const log = createLogger("spike-edge");

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function getSpikeEdgeMetricService(request: Request): "Main Site" | "Edge API" | null {
  const url = new URL(request.url);
  const host = (request.headers.get("host") ?? url.host).toLowerCase();

  if (host.startsWith("api.spike.land") || host.startsWith("edge.spike.land")) {
    return "Edge API";
  }

  if (host === "internal") {
    if (url.pathname.startsWith("/api/")) {
      return "Edge API";
    }

    if (url.pathname === "/health") {
      return "Main Site";
    }
  }

  if (host.startsWith("spike.land") || host.startsWith("www.spike.land")) {
    return url.pathname.startsWith("/api/") ? "Edge API" : "Main Site";
  }

  return null;
}
// Request ID middleware (must run before everything else)
app.use("*", requestIdMiddleware);

// api.spike.land rewrite: strip subdomain prefix, prepend /api/
app.use("*", async (c, next) => {
  const host = c.req.header("host") ?? "";
  if (host.startsWith("api.spike.land") && !c.req.path.startsWith("/api/")) {
    const url = new URL(c.req.url);
    url.pathname = `/api${url.pathname}`;
    const res = await app.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
    return new Response(res.body, res);
  }
  return next();
});

// CORS middleware
app.use("*", async (c, next) => {
  const configuredOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["https://spike.land"];

  const corsMiddleware = cors({
    origin: (requestOrigin) => {
      const fallbackOrigin = configuredOrigins[0] ?? "https://spike.land";
      if (!requestOrigin) return fallbackOrigin;
      return isAllowedBrowserOrigin(requestOrigin, configuredOrigins)
        ? requestOrigin
        : fallbackOrigin;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Mcp-Session-Id",
      "Mcp-Protocol-Version",
      "Accept",
      "Cookie",
    ],
    exposeHeaders: ["Mcp-Session-Id", "Set-Cookie"],
    credentials: true,
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

// Security headers middleware
app.use("*", async (c, next) => {
  await next();

  // Clone response if headers are immutable (e.g. from Cache API)
  try {
    c.res.headers.set("X-Test-Mutable", "1");
    c.res.headers.delete("X-Test-Mutable");
  } catch {
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: new Headers(c.res.headers),
    });
  }

  applySecurityHeaders(c.res.headers);
});

// Auth middleware for proxy routes (S1: CRITICAL — protect API keys)
app.use("/proxy/*", authMiddleware);

// Credit metering for AI proxy (runs after auth, before handler)
app.use("/proxy/ai", creditMeterMiddleware);

// Auth middleware for R2 mutation routes (S2: protect object storage)
app.post("/r2/upload", authMiddleware);
app.delete("/r2/*", authMiddleware);

// Auth middleware for WhatsApp linking API (not webhook — that uses HMAC)
app.use("/whatsapp/link/*", authMiddleware);

// Auth middleware for checkout (covers /api/checkout and /api/checkout/*)
app.use("/api/checkout", authMiddleware);
app.use("/api/checkout/*", authMiddleware);

// Auth middleware for credits routes
app.use("/api/credits/*", authMiddleware);

// Auth middleware for new user/billing/keys/cockpit routes
app.use("/api/user/*", authMiddleware);
app.use("/api/billing/*", authMiddleware);
app.use("/api/keys", authMiddleware);
app.use("/api/keys/*", authMiddleware);
app.use("/api/cockpit/*", authMiddleware);

// Auth middleware for cache purge (destructive — requires auth)
app.use("/api/cache/*", authMiddleware);

// Auth middleware for analytics GET endpoints (founder-only read access)
app.get("/analytics/events", authMiddleware);
app.get("/analytics/summary", authMiddleware);
app.get("/analytics/funnel", authMiddleware);
app.get("/analytics/dashboard", authMiddleware);
app.get("/analytics/mcp/*", authMiddleware);

// Auth middleware for error log listing (BUG 3: protect stack traces)
app.get("/errors", authMiddleware);
app.get("/errors/summary", authMiddleware);

// Auth middleware for experiment evaluation (mutates state — requires auth)
app.post("/api/experiments/*/evaluate", authMiddleware);

// Auth and credit metering for AI chat endpoint
app.use("/api/chat", authMiddleware);
app.use("/api/chat/*", authMiddleware);
app.use("/api/chat", creditMeterMiddleware);

// Auth and credit metering for Spike Chat (Grok-powered)
app.use("/api/spike-chat", authMiddleware);
app.use("/api/spike-chat", creditMeterMiddleware);

// Error handling middleware
app.onError((err, c) => {
  log.error(`${c.req.method} ${c.req.path}: ${err.message}`);
  try {
    const metadata = JSON.stringify({
      method: c.req.method,
      path: c.req.path,
      requestId: (c.get("requestId") as string | undefined) ?? c.req.header("x-request-id") ?? null,
    });
    const clientId = c.req.header("cf-connecting-ip") ?? null;
    const logWork = c.env.DB.prepare(
      "INSERT INTO error_logs (service_name, error_code, message, stack_trace, metadata, client_id, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "spike-edge",
        "INTERNAL_ERROR",
        err.message,
        err.stack ?? null,
        metadata,
        clientId,
        "error",
      )
      .run()
      .catch((e) => log.error("error_logs write failed", { error: String(e) }));
    try {
      c.executionCtx.waitUntil(logWork);
    } catch {
      /* no ExecutionContext in tests */
    }
  } catch {
    /* DB unavailable — skip error logging to prevent double-error */
  }
  return c.json({ error: "Internal Server Error" }, 500);
});

// Mount routes (order matters — specific routes before SPA catch-all)
app.route("/", pricingApi);
app.route("/", health);
app.route("/", r2);
app.route("/", proxy);
app.route("/", live);
app.route("/", openAiCompatible);
app.route("/", analytics);
app.route("/", quizBadge);
app.route("/", version);
app.route("/", blog);
app.route("/", errors);
app.route("/", bugbook);
app.route("/", blogComments);
app.route("/", whatsapp);
app.route("/", stripeWebhook);
app.route("/", checkout);
app.route("/", userProfile);
app.route("/", billing);
app.route("/", apiKeys);
app.route("/", cockpit);
app.route("/", credits);
app.route("/", support);
app.route("/", experiments);
app.route("/", fixer);
app.route("/", settings);
app.route("/", chat);
app.route("/", spikeChat);
app.route("/", cachePurge);

/** Track whether MCP_SERVICE binding is functional (avoids repeated failures in local dev). */
let mcpServiceAvailable = true;
let mcpServiceDownSince = 0;
const SERVICE_RETRY_MS = 30_000;

/**
 * Fetch from MCP_SERVICE binding with fallback to production URL.
 * In local dev, the service binding may not be available if spike-land-mcp isn't running.
 * After a 503, skips the binding for 30s before retrying.
 */
async function fetchMcpWithFallback(env: Env, url: string, init?: RequestInit): Promise<Response> {
  if (!mcpServiceAvailable && Date.now() - mcpServiceDownSince > SERVICE_RETRY_MS) {
    mcpServiceAvailable = true;
  }
  if (mcpServiceAvailable) {
    try {
      const response = await env.MCP_SERVICE.fetch(new Request(url, init));
      if (response.status === 503) {
        mcpServiceAvailable = false;
        mcpServiceDownSince = Date.now();
      } else {
        return response;
      }
    } catch {
      mcpServiceAvailable = false;
      mcpServiceDownSince = Date.now();
    }
  }
  return fetch(url, init);
}

// MCP tools listing proxy (public, no auth required)
app.get("/mcp/tools", async (c) => {
  const url = "https://mcp.spike.land/tools";
  const response = await fetchMcpWithFallback(c.env, url, {
    headers: { "X-Request-Id": c.get("requestId") },
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

app.get("/api/apps", async (c) => {
  const url = "https://mcp.spike.land/apps";
  const response = await fetchMcpWithFallback(c.env, url, {
    headers: { "X-Request-Id": c.get("requestId") },
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

app.get("/api/apps/:slug", async (c) => {
  const slug = c.req.param("slug");
  const url = `https://mcp.spike.land/apps/${slug}`;
  const response = await fetchMcpWithFallback(c.env, url, {
    headers: { "X-Request-Id": c.get("requestId") },
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

// Store tools endpoint — groups MCP registry tools by category for the store UI
app.get("/api/store/tools", async (c) => {
  const requestId = c.get("requestId");
  const response = await fetchMcpWithFallback(c.env, "https://mcp.spike.land/tools", {
    headers: { "X-Request-Id": requestId },
  });
  if (!response.ok) {
    return c.json({ error: "Failed to fetch tools" }, 502);
  }
  const data = await response.json<{
    tools: Array<{
      name: string;
      description: string;
      category?: string;
      version?: string;
      stability?: string;
    }>;
  }>();
  const tools = data.tools ?? [];

  // Group by category
  const categoryMap = new Map<string, typeof tools>();
  for (const tool of tools) {
    const cat = tool.category ?? "other";
    const existing = categoryMap.get(cat) ?? [];
    existing.push(tool);
    categoryMap.set(cat, existing);
  }

  const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
    name,
    tools: items,
  }));

  // Featured: first 6 tools across all categories (stable tools first)
  const featured = [...tools]
    .sort((a, b) => {
      const aStable = a.stability === "stable" ? 0 : 1;
      const bStable = b.stability === "stable" ? 0 : 1;
      return aStable - bStable;
    })
    .slice(0, 6);

  c.header("Cache-Control", "public, max-age=1800, stale-while-revalidate=14400");
  return c.json({ categories, featured, total: tools.length });
});

// --- MCP Gateway ---

// Helper: proxy request to MCP service binding (with fallback for local dev)
async function mcpProxy(c: import("hono").Context<{ Bindings: Env; Variables: Variables }>) {
  const url = new URL(c.req.url);
  url.hostname = "mcp.spike.land";
  url.port = "";
  url.protocol = "https:";

  const newRequest = new Request(url.toString(), c.req.raw);
  const proxyHeaders = await buildMcpProxyHeaders(c.env, c.req.raw, {
    requestId: c.get("requestId"),
    fetchAuth: fetchAuthWithFallback,
  });
  proxyHeaders.set("X-Request-Id", c.get("requestId"));
  const hasBody = newRequest.method !== "GET" && newRequest.method !== "HEAD";
  const response = await fetchMcpWithFallback(c.env, newRequest.url, {
    method: newRequest.method,
    headers: Object.fromEntries(proxyHeaders.entries()),
    ...(hasBody && newRequest.body != null
      ? { body: newRequest.body, duplex: "half" as const }
      : {}),
  } as RequestInit);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

// OAuth well-known discovery (inline, not proxied)
app.get("/.well-known/oauth-authorization-server", (c) => {
  c.header("Cache-Control", "public, max-age=86400");
  return c.json({
    issuer: "https://spike.land",
    authorization_endpoint: "https://spike.land/mcp/authorize",
    token_endpoint: "https://spike.land/oauth/token",
    device_authorization_endpoint: "https://spike.land/oauth/device",
    response_types_supported: ["token"],
    grant_types_supported: ["urn:ietf:params:oauth:grant-type:device_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  });
});

app.get("/.well-known/oauth-protected-resource/mcp", (c) => {
  c.header("Cache-Control", "public, max-age=86400");
  return c.json({
    resource: "https://spike.land/mcp",
    authorization_servers: ["https://spike.land"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://spike.land/docs/mcp",
  });
});

// OAuth device flow proxy routes
app.post("/oauth/device", mcpProxy);
app.post("/oauth/token", mcpProxy);

// Device approval requires session auth + internal secret injection
app.post("/oauth/device/approve", authMiddleware, async (c) => {
  const url = new URL(c.req.url);
  url.hostname = "mcp.spike.land";
  url.port = "";
  url.protocol = "https:";

  const body = await c.req.json<{ user_code: string }>();
  const userId = c.get("userId");
  const newRequest = new Request(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": c.env.MCP_INTERNAL_SECRET,
      "X-Request-Id": c.get("requestId"),
    },
    body: JSON.stringify({ user_code: body.user_code, user_id: userId }),
  });
  const response = await c.env.MCP_SERVICE.fetch(newRequest);
  return new Response(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  });
});

// MCP Streamable HTTP proxy — POST and DELETE always; GET only for SSE (not browser nav)
app.post("/mcp", mcpProxy);
app.delete("/mcp", mcpProxy);
app.get("/mcp", async (c, next) => {
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("text/event-stream")) {
    return mcpProxy(c);
  }
  // Browser navigation (text/html) — fall through to SPA catch-all
  return next();
});

/** Track whether AUTH_MCP binding is functional (avoids repeated failures in local dev). */
let authServiceAvailable = true;
let authServiceDownSince = 0;

/**
 * Fetch from AUTH_MCP binding with fallback to production URL.
 * In local dev, the service binding may not be available if mcp-auth isn't running.
 * After a 503, skips the binding for 30s before retrying.
 */
async function fetchAuthWithFallback(env: Env, request: Request): Promise<Response> {
  if (!authServiceAvailable && Date.now() - authServiceDownSince > SERVICE_RETRY_MS) {
    authServiceAvailable = true;
  }
  if (authServiceAvailable) {
    try {
      const response = await env.AUTH_MCP.fetch(request);
      if (response.status === 503) {
        authServiceAvailable = false;
        authServiceDownSince = Date.now();
      } else {
        return response;
      }
    } catch {
      authServiceAvailable = false;
      authServiceDownSince = Date.now();
    }
  }
  return fetch(request);
}

// Better Auth proxy via service binding (sub-1ms internal call)
app.all("/api/auth/*", async (c) => {
  const url = new URL(c.req.url);
  const isGetSession = url.pathname.endsWith("/get-session");
  url.hostname = "auth-mcp.spike.land";
  url.port = "";
  url.protocol = "https:";

  const newRequest = new Request(url.toString(), c.req.raw);
  newRequest.headers.set("X-Forwarded-Host", "spike.land");
  newRequest.headers.set("X-Forwarded-Proto", "https");
  newRequest.headers.set("X-Request-Id", c.get("requestId"));

  let response: Response;
  try {
    response = await fetchAuthWithFallback(c.env, newRequest);
  } catch (error) {
    if (isGetSession) {
      return c.json(null, 200);
    }
    throw error;
  }

  if (isGetSession && !response.ok) {
    return c.json(null, 200);
  }

  // Strip CORS headers from upstream — spike-edge's own CORS middleware handles them
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Methods");
  headers.delete("Access-Control-Allow-Headers");
  headers.delete("Access-Control-Allow-Credentials");
  headers.delete("Access-Control-Expose-Headers");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

app.route("/", wellKnown);
app.route("/", sitemap);
app.route("/", githubStars);
app.route("/", docsApi);

// Catch-all for unmatched API routes — return JSON 404 instead of SPA HTML
app.all("/api/*", (c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

app.route("/", spa);

export { RateLimiter, app };
export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const metricService = shouldTrackServiceMetricRequest(request)
      ? getSpikeEdgeMetricService(request)
      : null;
    const response = await app.fetch(request, env, ctx);

    if (metricService) {
      try {
        ctx?.waitUntil(
          recordServiceRequestMetric(env.DB, metricService, Date.now() - startedAt).catch(
            (error) => {
              console.error("[service-metrics] failed to record spike-edge request", error);
            },
          ),
        );
      } catch {
        /* no ExecutionContext outside Workers runtime */
      }
    }

    return response;
  },
  scheduled: (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env));
  },
};
