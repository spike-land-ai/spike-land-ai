import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "@/lib/logger";
import { healthRoute } from "./routes/health.js";

const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: ["https://spike.land", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
    credentials: true,
  }),
);

// Routes
app.route("/health", healthRoute);

// Start server
const port = parseInt(process.env.PORT || "3001", 10);
logger.info("Hono MCP API server starting", { port });
serve({ fetch: app.fetch, port }, (info) => {
  logger.info("Server running", { url: `http://localhost:${info.port}` });
});

export default app;
