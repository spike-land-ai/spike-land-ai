import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";
import { authMiddleware } from "./middleware";
import { mcpRoute } from "./mcp";
import { oauthRoute } from "./oauth";
import { wellKnownRoute } from "./well-known";
import { publicToolsRoute } from "./public-tools";
import { publicAppsRoute } from "./public-apps";
import { internalByokRoute } from "./internal-byok";
import { internalAnalytics } from "./internal-analytics";
import { internalAuthMiddleware } from "./internal-auth";

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

  app.get("/health", (c) => c.json({ status: "ok", service: "spike-land-mcp", timestamp: new Date().toISOString() }));

  // Internal routes (protected by x-internal-secret header)
  app.use("/internal/*", internalAuthMiddleware);
  app.route("/internal", internalByokRoute);
  app.route("/internal", internalAnalytics);

  // Public routes
  app.route("/.well-known", wellKnownRoute);
  app.route("/oauth", oauthRoute);
  app.route("/tools", publicToolsRoute);
  app.route("/apps", publicAppsRoute);

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
