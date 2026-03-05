import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./env";
import type { AuthVariables } from "./auth/middleware";
import { authMiddleware } from "./auth/middleware";
import { mcpRoute } from "./routes/mcp";
import { oauthRoute } from "./routes/oauth";
import { wellKnownRoute } from "./routes/well-known";
import { publicToolsRoute } from "./routes/public-tools";
import { internalByokRoute } from "./routes/internal-byok";
import { internalAnalytics } from "./routes/internal-analytics";
import { internalAuthMiddleware } from "./middleware/internal-auth";

export function createApp(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  app.use(
    "*",
    cors({
      origin: ["https://spike.land", "https://local.spike.land:5173"],
      allowHeaders: ["Authorization", "Content-Type", "X-Internal-Secret", "Mcp-Session-Id", "Mcp-Protocol-Version", "Accept"],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposeHeaders: ["Mcp-Session-Id"],
      maxAge: 86400,
    }),
  );
  app.use("*", logger());

  app.get("/health", (c) => c.json({ ok: true, service: "spike-land-mcp" }));

  // Internal routes (protected by x-internal-secret header)
  app.use("/internal/*", internalAuthMiddleware);
  app.route("/internal", internalByokRoute);
  app.route("/internal", internalAnalytics);

  // Public routes
  app.route("/.well-known", wellKnownRoute);
  app.route("/oauth", oauthRoute);
  app.route("/tools", publicToolsRoute);

  // Authenticated MCP route
  app.use("/mcp/*", authMiddleware);
  app.route("/mcp", mcpRoute);

  app.onError((err, c) => {
    console.error("[spike-land-mcp] Unhandled error:", err);
    if (c.env.SPIKE_EDGE) {
      c.executionCtx.waitUntil(
        c.env.SPIKE_EDGE.fetch("https://edge.spike.land/errors/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            errors: [
              {
                service_name: "spike-land-mcp",
                message: err.message || String(err),
                stack_trace: err.stack,
                severity: "high",
              },
            ],
          }),
        }).catch((e) => console.error("Failed to ship error to SPIKE_EDGE:", e))
      );
    }
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
