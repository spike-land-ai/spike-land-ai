import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import { RateLimiter } from "./rate-limiter.js";
import { authMiddleware } from "./middleware/auth.js";
import { health } from "./routes/health.js";
import { r2 } from "./routes/r2.js";
import { proxy } from "./routes/proxy.js";
import { live } from "./routes/live.js";
import { analytics } from "./routes/analytics.js";
import { quizBadge } from "./routes/quiz-badge.js";
import { version } from "./routes/version.js";
import { blog } from "./routes/blog.js";
import { errors } from "./routes/errors.js";
import { bugbook } from "./routes/bugbook.js";
import { blogComments } from "./routes/blog-comments.js";
import { whatsapp } from "./routes/whatsapp.js";
import { stripeWebhook } from "./routes/stripe-webhook.js";
import { spa } from "./routes/spa.js";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["https://spike.land"];

  const corsMiddleware = cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
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

  const isLive = c.req.path.startsWith("/live/");

  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  if (!isLive) {
    c.res.headers.set("X-Frame-Options", "DENY");
  }
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com https://avatars.githubusercontent.com https://*.googleusercontent.com data: blob:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://edge.spike.land https://auth-mcp.spike.land https://mcp.spike.land wss://spike.land blob: data:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://edge.spike.land",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      isLive ? "frame-ancestors https://spike.land" : "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  );
});

// Auth middleware for proxy routes (S1: CRITICAL — protect API keys)
app.use("/proxy/*", authMiddleware);

// Auth middleware for R2 mutation routes (S2: protect object storage)
app.post("/r2/upload", authMiddleware);
app.delete("/r2/*", authMiddleware);

// Auth middleware for WhatsApp linking API (not webhook — that uses HMAC)
app.use("/whatsapp/link/*", authMiddleware);

// Error handling middleware
app.onError((err, c) => {
  console.error(`[spike-edge] ${c.req.method} ${c.req.path}:`, err.message);
  try {
    const logWork = c.env.DB.prepare(
      "INSERT INTO error_logs (service_name, error_code, message, stack_trace, severity) VALUES (?, ?, ?, ?, ?)",
    ).bind("spike-edge", "INTERNAL_ERROR", err.message, err.stack ?? null, "error").run().catch(() => {});
    try { c.executionCtx.waitUntil(logWork); } catch { /* no ExecutionContext in tests */ }
  } catch { /* DB unavailable — skip error logging to prevent double-error */ }
  return c.json({ error: "Internal Server Error" }, 500);
});

// Mount routes (order matters — specific routes before SPA catch-all)
app.route("/", health);
app.route("/", r2);
app.route("/", proxy);
app.route("/", live);
app.route("/", analytics);
app.route("/", quizBadge);
app.route("/", version);
app.route("/", blog);
app.route("/", errors);
app.route("/", bugbook);
app.route("/", blogComments);
app.route("/", whatsapp);
app.route("/", stripeWebhook);

// MCP tools listing proxy (public, no auth required)
app.get("/mcp/tools", async (c) => {
  const url = new URL("https://mcp.spike.land/tools");
  const response = await c.env.MCP_SERVICE.fetch(new Request(url.toString()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

// MCP JSON-RPC proxy via service binding (requires auth)
app.post("/mcp", async (c) => {
  const url = new URL(c.req.url);
  url.hostname = "mcp.spike.land";
  url.port = "";
  url.protocol = "https:";

  const newRequest = new Request(url.toString(), c.req.raw);
  const response = await c.env.MCP_SERVICE.fetch(newRequest);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

// Better Auth proxy via service binding (sub-1ms internal call)
app.all("/api/auth/*", async (c) => {
  const url = new URL(c.req.url);
  url.hostname = "auth-mcp.spike.land";
  url.port = "";
  url.protocol = "https:";

  const newRequest = new Request(url.toString(), c.req.raw);
  newRequest.headers.set("X-Forwarded-Host", "spike.land");
  newRequest.headers.set("X-Forwarded-Proto", "https");

  const response = await c.env.AUTH_MCP.fetch(newRequest);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
});

app.route("/", spa);

export { RateLimiter };
export default app;
