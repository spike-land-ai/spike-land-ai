/**
 * `spike status` command — health check for all configured MCP servers.
 * Reports connection status, tool count, and environment variable status.
 */

import type { Command } from "commander";
import { discoverConfig } from "../config/discovery";
import { UpstreamClient } from "../multiplexer/upstream-client";
import { log } from "../util/logger";

const ENV_KEYS = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  "MCP_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

const DEFAULT_TIMEOUT_MS = 10_000;

export interface StatusResult {
  servers: Array<{
    name: string;
    connected: boolean;
    toolCount: number;
    error?: string;
    latencyMs: number;
  }>;
  env: Record<string, boolean>;
  configSources?: string[];
  configPath?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function collectStatus(
  configPath?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<StatusResult> {
  const config = await discoverConfig({ configPath });
  const serverEntries = Object.entries(config.servers);

  const servers: StatusResult["servers"] = [];

  for (const [name, serverConfig] of serverEntries) {
    const client = new UpstreamClient(name, serverConfig);
    const start = Date.now();

    try {
      await withTimeout(client.connect(), timeoutMs);
      const toolCount = client.getTools().length;
      const connected = client.connected && toolCount > 0;
      servers.push({
        name,
        connected,
        toolCount,
        error: connected ? undefined : "connected but 0 tools (check auth/config)",
        latencyMs: Date.now() - start,
      });
      await client.close();
    } catch (err) {
      servers.push({
        name,
        connected: false,
        toolCount: 0,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      });
      // Best-effort close
      try {
        await client.close();
      } catch { /* ignore */ }
    }
  }

  const env: Record<string, boolean> = {};
  for (const key of ENV_KEYS) {
    env[key] = !!process.env[key];
  }

  const resolvedConfigPath = config.configSources && config.configSources.length > 0
    ? config.configSources[config.configSources.length - 1]
    : undefined;

  return { servers, env, configSources: config.configSources, configPath: resolvedConfigPath };
}

export function formatStatus(result: StatusResult): string {
  const lines: string[] = [];

  lines.push("╭─── Spike CLI Health Check ───╮");
  lines.push("");

  // Config path
  lines.push(`  Config: ${result.configPath ?? "none (no .mcp.json found)"}`);

  // Additional config sources
  if (result.configSources && result.configSources.length > 1) {
    lines.push("  Config sources:");
    for (const src of result.configSources) {
      lines.push(`    ${src}`);
    }
  }
  lines.push("");

  // Servers
  lines.push("  Servers:");
  if (result.servers.length === 0) {
    lines.push("    (none configured)");
  }
  for (const s of result.servers) {
    const icon = s.connected ? "✅" : "❌";
    const tools = s.connected ? `${s.toolCount} tools` : s.error ?? "failed";
    const latency = `${s.latencyMs}ms`;
    lines.push(
      `    ${icon} ${s.name.padEnd(20)} ${tools.padEnd(24)} ${latency}`,
    );
  }
  lines.push("");

  // Environment
  lines.push("  Environment:");
  for (const [key, set] of Object.entries(result.env)) {
    const icon = set ? "✅" : "⬜";
    lines.push(`    ${icon} ${key}`);
  }
  lines.push("");

  const connectedCount = result.servers.filter(s => s.connected).length;
  const totalCount = result.servers.length;
  const totalTools = result.servers.reduce((sum, s) => sum + s.toolCount, 0);
  lines.push(
    `  Summary: ${connectedCount}/${totalCount} servers, ${totalTools} tools`,
  );
  lines.push("");
  lines.push("╰──────────────────────────────╯");

  return lines.join("\n");
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Health check for all configured MCP servers")
    .option("--config <path>", "Path to .mcp.json config file")
    .option("--json", "Output as JSON")
    .option("--timeout <ms>", "Connection timeout per server in ms", String(DEFAULT_TIMEOUT_MS))
    .action(async options => {
      log("Running health check...");

      const timeoutMs = parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS;
      const result = await collectStatus(options.config, timeoutMs);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatStatus(result));
      }

      // Exit 1 if no servers configured or any server failed
      const hasServers = result.servers.length > 0;
      const allConnected = result.servers.every(s => s.connected);
      process.exit(hasServers && allConnected ? 0 : 1);
    });
}
