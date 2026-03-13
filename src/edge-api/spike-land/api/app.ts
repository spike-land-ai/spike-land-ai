import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { captureWorkerException } from "../../common/core-logic/sentry";
import {
  buildStandardHealthResponse,
  getHealthHttpStatus,
  timedCheck,
} from "../../common/core-logic/health-contract";
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
import { landingRoute } from "./landing";
import { learnitRoute } from "./learnit";

export function createApp(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "X-Internal-Secret",
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "Accept",
      ],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposeHeaders: ["Mcp-Session-Id"],
      maxAge: 86400,
    }),
  );
  app.use("*", logger());

  app.get("/health", async (c) => {
    const d1Check = await timedCheck(async () => {
      await c.env.DB.prepare("SELECT 1").first();
    });
    const payload = buildStandardHealthResponse({
      service: "spike-land-mcp",
      checks: { d1: d1Check },
    });
    return c.json(payload, getHealthHttpStatus(payload));
  });

  // Internal routes (protected by x-internal-secret header)
  app.use("/internal/*", internalAuthMiddleware);
  app.route("/internal", internalByokRoute);
  app.route("/internal", internalAnalytics);

  // LearnIt public HTTP routes
  app.route("/", learnitRoute);

  // Public routes
  app.route("/.well-known", wellKnownRoute);
  app.route("/oauth", oauthRoute);
  app.route("/tools", publicToolsRoute);
  app.route("/apps", publicAppsRoute);

  // Landing page route (serves HTML for browser GET /)
  app.route("/", landingRoute);

  // Browser visits to /mcp without auth → redirect to landing page
  app.get("/mcp", (c, next) => {
    const accept = c.req.header("Accept") ?? "";
    const sessionId = c.req.header("Mcp-Session-Id");
    if (accept.includes("text/html") && !sessionId && !c.req.header("Authorization")) {
      return c.redirect("/");
    }
    return next();
  });

  // Authenticated MCP route
  app.use("/mcp/*", authMiddleware);
  app.route("/mcp", mcpRoute);

  app.onError((err, c) => {
    captureWorkerException("spike-land-mcp", err, { request: c.req.raw });
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
        }).catch((e) => console.error("Failed to ship error to SPIKE_EDGE:", e)),
      );
    }
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
