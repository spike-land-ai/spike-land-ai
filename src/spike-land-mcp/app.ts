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

export function createApp(): Hono<{ Bindings: Env; Variables: AuthVariables }> {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  app.use(
    "*",
    cors({
      origin: ["https://spike.land"],
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    }),
  );
  app.use("*", logger());

  app.get("/health", (c) => c.json({ ok: true, service: "spike-land-mcp" }));

  // Internal routes (service-binding only, no auth)
  app.route("/internal", internalByokRoute);

  // Public routes
  app.route("/.well-known", wellKnownRoute);
  app.route("/oauth", oauthRoute);
  app.route("/tools", publicToolsRoute);

  // Authenticated MCP route
  app.use("/mcp/*", authMiddleware);
  app.route("/mcp", mcpRoute);

  return app;
}
