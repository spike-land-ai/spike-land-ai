import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "./registry";
import { registerAllTools } from "./manifest";
import type { DrizzleDB } from "../db/index";

export interface CreateMcpServerOptions {
  enabledCategories?: string[];
  kv?: KVNamespace;
}

export async function createMcpServer(
  userId: string,
  db: DrizzleDB,
  options?: CreateMcpServerOptions,
): Promise<McpServer> {
  const mcpServer = new McpServer(
    { name: "spike-land-mcp", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );

  const registry = new ToolRegistry(mcpServer, userId);
  await registerAllTools(registry, userId, db, options?.kv);

  if (options?.enabledCategories && options.enabledCategories.length > 0) {
    registry.restoreCategories(options.enabledCategories);
  }

  return mcpServer;
}
