import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolRegistry } from "../../lazy-imports/registry";
import { registerAllTools } from "./manifest";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export interface CreateMcpServerOptions {
  enabledCategories?: string[];
  kv?: KVNamespace;
  vaultSecret?: string;
  mcpInternalSecret?: string;
  spikeEdge?: Fetcher;
  spaAssets?: R2Bucket;
  geminiApiKey?: string;
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
  await registerAllTools(registry, userId, db, {
    ...(options?.kv !== undefined ? { kv: options.kv } : {}),
    ...(options?.vaultSecret !== undefined ? { vaultSecret: options.vaultSecret } : {}),
    ...(options?.mcpInternalSecret !== undefined
      ? { mcpInternalSecret: options.mcpInternalSecret }
      : {}),
    ...(options?.spikeEdge !== undefined ? { spikeEdge: options.spikeEdge } : {}),
    ...(options?.spaAssets !== undefined ? { spaAssets: options.spaAssets } : {}),
    ...(options?.geminiApiKey !== undefined ? { geminiApiKey: options.geminiApiKey } : {}),
  });

  if (options?.enabledCategories && options.enabledCategories.length > 0) {
    registry.restoreCategories(options.enabledCategories);
  }

  (mcpServer as unknown as Record<string, unknown>).registry = registry;
  return mcpServer;
}
