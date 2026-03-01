import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import { RateLimiter } from "./rate-limiter.js";
import { health } from "./routes/health.js";
import { r2 } from "./routes/r2.js";
import { proxy } from "./routes/proxy.js";
import { live } from "./routes/live.js";
import { analytics } from "./routes/analytics.js";
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
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set("X-Frame-Options", "DENY");
});

// Error handling middleware
app.onError((err, c) => {
  console.error(`[spike-edge] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Mount routes (order matters — specific routes before SPA catch-all)
app.route("/", health);
app.route("/", r2);
app.route("/", proxy);
app.route("/", live);
app.route("/", analytics);
app.route("/", spa);

export { RateLimiter };
export default { fetch: app.fetch } as ExportedHandler<Env>;
