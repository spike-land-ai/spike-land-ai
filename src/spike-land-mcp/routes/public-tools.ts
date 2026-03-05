/**
 * Public Tools Listing Endpoint
 *
 * GET /tools — Returns tool metadata (name, description, category, inputSchema)
 * without requiring authentication. Read-only endpoint for the tools explorer UI.
 */
import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVariables } from "../auth/middleware";
import { ToolRegistry } from "../mcp/registry";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../mcp/manifest";
import { createDb } from "../db/index";

export const publicToolsRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicToolsRoute.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const mcpServer = new McpServer(
    { name: "spike-land-mcp", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );

  const registry = new ToolRegistry(mcpServer, "anonymous");
  await registerAllTools(registry, "anonymous", db, {
    kv: c.env.KV,
    vaultSecret: c.env.VAULT_SECRET,
  });

  const tools = registry.getToolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    inputSchema: t.inputSchema
      ? { type: "object" as const, properties: Object.keys(t.inputSchema).reduce((acc, key) => {
          const field = t.inputSchema![key] as { description?: string; _def?: { typeName?: string } };
          acc[key] = { description: field.description ?? key };
          return acc;
        }, {} as Record<string, { description: string }>) }
      : { type: "object" as const },
    version: t.version,
    stability: t.stability,
    examples: t.examples,
  }));

  const response = c.json({ tools });
  // Tool definitions rarely change — cache aggressively
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return response;
});
