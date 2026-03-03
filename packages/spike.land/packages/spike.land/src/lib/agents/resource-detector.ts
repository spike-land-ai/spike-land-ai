/**
 * Resource Detector
 *
 * Utility for detecting running development resources.
 */

import { tryCatch } from "@/lib/try-catch";
import fs from "fs/promises";
import path from "path";

interface ResourceStatus {
  devServer: {
    running: boolean;
    port: number | null;
    url: string | null;
  };
  mcpServers: Array<{
    name: string;
    type: string;
    configured: boolean;
  }>;
  database: {
    connected: boolean;
    provider: string;
  };
  environment: {
    nodeEnv: string;
    julesConfigured: boolean;
    githubConfigured: boolean;
  };
}

/**
 * Check if dev server is running
 */
async function checkDevServer(): Promise<ResourceStatus["devServer"]> {
  const port = parseInt(process.env.PORT || "3000");
  const url = `http://localhost:${port}`;

  // In development, assume we're running if this code executes
  const isRunning = process.env.NODE_ENV === "development";

  return {
    running: isRunning,
    port: isRunning ? port : null,
    url: isRunning ? url : null,
  };
}

/**
 * Read MCP server configuration from .mcp.json
 */
async function getMcpServers(): Promise<ResourceStatus["mcpServers"]> {
  const mcpConfigPath = path.join(process.cwd(), ".mcp.json");

  const { data: content, error } = await tryCatch(
    fs.readFile(mcpConfigPath, "utf-8"),
  );

  if (error || !content) {
    return [];
  }

  try {
    const config = JSON.parse(content);
    const servers = config.mcpServers || {};

    return Object.entries(servers).map(([name, serverConfig]) => {
      const cfg = serverConfig as Record<string, unknown>;
      return {
        name,
        type: (cfg.type as string) || "stdio",
        configured: true,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Check database connection
 */
async function checkDatabase(): Promise<ResourceStatus["database"]> {
  // Check if DATABASE_URL is configured
  const hasDbUrl = !!process.env.DATABASE_URL;

  return {
    connected: hasDbUrl,
    provider: "postgresql",
  };
}

/**
 * Check environment configuration
 */
function checkEnvironment(): ResourceStatus["environment"] {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    julesConfigured: !!process.env.JULES_API_KEY,
    githubConfigured: !!process.env.GH_PAT_TOKEN,
  };
}

/**
 * Get all resource statuses
 */
export async function detectResources(): Promise<ResourceStatus> {
  const [devServer, mcpServers, database] = await Promise.all([
    checkDevServer(),
    getMcpServers(),
    checkDatabase(),
  ]);

  return {
    devServer,
    mcpServers,
    database,
    environment: checkEnvironment(),
  };
}
