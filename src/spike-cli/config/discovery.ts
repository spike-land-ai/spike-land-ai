/**
 * Discover and merge .mcp.json config files.
 *
 * Precedence (later wins on conflict):
 * 1. $HOME/.mcp.json (global)
 * 2. .mcp.json in CWD (project-level)
 * 3. --config <path> (explicit, replaces CWD)
 * 4. --server / --server-url flags (additive)
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { validateConfig } from "./schema";
import type { ResolvedConfig, ServerConfig } from "./types";
import { expandEnvRecord } from "../util/env";
import { hasValidToken, loadTokens } from "../auth/token-store";
import { log } from "../util/logger";

interface LoadedConfig {
  servers: Record<string, ServerConfig>;
  toolsets?: Record<string, { servers: string[]; description?: string }>;
  lazyLoading?: boolean;
}

async function loadConfigFile(path: string): Promise<LoadedConfig> {
  try {
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content);
    const validated = validateConfig(parsed);
    log(`Loaded config from ${path} (${Object.keys(validated.mcpServers).length} servers)`);
    return {
      servers: validated.mcpServers,
      toolsets: validated.toolsets,
      lazyLoading: validated.lazyLoading,
    };
  } catch (err) {
    log(`Skipping config ${path}: ${err instanceof Error ? err.message : String(err)}`);
    return { servers: {} };
  }
}

export interface DiscoveryOptions {
  configPath?: string;
  inlineServers?: Array<{ name: string; command: string }>;
  inlineUrls?: Array<{ name: string; url: string }>;
}

export async function discoverConfig(options: DiscoveryOptions = {}): Promise<ResolvedConfig> {
  const servers: Record<string, ServerConfig> = {};
  const configSources: string[] = [];
  let toolsets: Record<string, { servers: string[]; description?: string }> | undefined;
  let lazyLoading: boolean | undefined;

  // 1. Global config
  const globalPath = join(homedir(), ".mcp.json");
  if (existsSync(globalPath)) {
    const loaded = await loadConfigFile(globalPath);
    if (Object.keys(loaded.servers).length > 0) configSources.push(globalPath);
    Object.assign(servers, loaded.servers);
    if (loaded.toolsets) toolsets = { ...toolsets, ...loaded.toolsets };
    if (loaded.lazyLoading !== undefined) lazyLoading = loaded.lazyLoading;
  }

  // 2. Project-level or explicit config (resolve relative paths from CWD)
  const projectPath = options.configPath
    ? resolve(process.cwd(), options.configPath)
    : join(process.cwd(), ".mcp.json");
  if (existsSync(projectPath)) {
    const loaded = await loadConfigFile(projectPath);
    if (Object.keys(loaded.servers).length > 0) configSources.push(projectPath);
    Object.assign(servers, loaded.servers);
    if (loaded.toolsets) toolsets = { ...toolsets, ...loaded.toolsets };
    if (loaded.lazyLoading !== undefined) lazyLoading = loaded.lazyLoading;
  }

  // 3. Inline --server flags
  if (options.inlineServers) {
    for (const { name, command } of options.inlineServers) {
      const parts = command.split(/\s+/);
      servers[name] = {
        type: "stdio",
        command: parts[0] ?? "",
        args: parts.slice(1),
      };
    }
  }

  // 4. Inline --server-url flags
  if (options.inlineUrls) {
    for (const { name, url } of options.inlineUrls) {
      servers[name] = { type: "url", url };
    }
  }

  // Expand env vars in all server configs
  for (const config of Object.values(servers)) {
    if (config.env) {
      config.env = expandEnvRecord(config.env);
    }
  }

  // Auto-inject spike.land if authenticated and not already configured
  if (!servers["spike-land"] && (await hasValidToken())) {
    const tokens = await loadTokens();
    if (tokens) {
      servers["spike-land"] = {
        type: "url",
        url: `${tokens.baseUrl}/api/mcp`,
        env: { SPIKE_AUTH_TOKEN: tokens.accessToken },
      };
      log("Auto-injected spike-land server from auth tokens");
    }
  }

  log(`Resolved ${Object.keys(servers).length} total servers`);
  return { servers, toolsets, lazyLoading, configSources };
}
