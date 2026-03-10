/**
 * Public Tools Listing Endpoint
 *
 * GET /tools — Returns tool metadata (name, description, category, inputSchema)
 * without requiring authentication. Read-only endpoint for the tools explorer UI.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";
import { ToolRegistry } from "../lazy-imports/registry";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../core-logic/mcp/manifest";
import { createDb } from "../db/db/db-index.ts";

import { zodToJsonSchema } from "zod-to-json-schema";

export const publicToolsRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicToolsRoute.get("/", async (c) => {
  const stabilityFilter = c.req.query("stability");
  const categoryFilter = c.req.query("category");

  let registry: ToolRegistry;
  try {
    const db = createDb(c.env.DB);
    const mcpServer = new McpServer(
      { name: "spike-land-mcp", version: "1.0.0" },
      { capabilities: { tools: { listChanged: true } } },
    );

    registry = new ToolRegistry(mcpServer, "anonymous");
    await registerAllTools(registry, "anonymous", db, {
      kv: c.env.KV,
      vaultSecret: c.env.VAULT_SECRET,
      geminiApiKey: c.env.GEMINI_API_KEY,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown";
    console.error("[public-tools] Tool registration failed:", detail);
    return c.json({ error: "Failed to load tools", detail }, 500);
  }

  let definitions = registry.getToolDefinitions();

  if (stabilityFilter) {
    definitions = definitions.filter((t) => t.stability === stabilityFilter);
  }
  if (categoryFilter) {
    definitions = definitions.filter((t) => t.category === categoryFilter);
  }

  const tools = definitions.map((t) => {
    let inputSchema: Record<string, unknown> = { type: "object" };
    if (t.inputSchema) {
      // Zod v4 object is not assignable to zodToJsonSchema's v3 param — bridge via unknown
      const converted = zodToJsonSchema(
        z.object(t.inputSchema) as unknown as Parameters<typeof zodToJsonSchema>[0],
      ) as Record<string, unknown>;
      // Remove top-level $schema for cleaner output
      delete converted.$schema;
      inputSchema = converted;
    }

    return {
      name: t.name,
      description: t.description,
      category: t.category,
      inputSchema,
      version: t.version,
      stability: t.stability,
      examples: t.examples,
    };
  });

  const response = c.json({ tools });
  c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
  return response;
});
