/**
 * Configuration types for MCP server definitions.
 * Matches Claude Code's .mcp.json format.
 */

import type { ToolFilterConfig } from "../util/glob";

export type { ToolFilterConfig };

export interface StdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: ToolFilterConfig;
}

export interface HttpServerConfig {
  type: "sse" | "url";
  url: string;
  env?: Record<string, string>;
  tools?: ToolFilterConfig;
}

export type ServerConfig = StdioServerConfig | HttpServerConfig;

export interface ToolsetConfig {
  servers: string[];
  description?: string;
}

export interface McpConfigFile {
  mcpServers: Record<string, ServerConfig>;
  toolsets?: Record<string, ToolsetConfig>;
  lazyLoading?: boolean;
}

export interface ResolvedConfig {
  servers: Record<string, ServerConfig>;
  toolsets?: Record<string, ToolsetConfig>;
  lazyLoading?: boolean;
  /** Config file paths that were successfully loaded (for diagnostics). */
  configSources?: string[];
}

export function isStdioConfig(config: ServerConfig): config is StdioServerConfig {
  return config.type === "stdio" || config.type === undefined;
}

export function isHttpConfig(config: ServerConfig): config is HttpServerConfig {
  return config.type === "sse" || config.type === "url";
}

export interface OnboardingConfig {
  personaId: number;
  personaSlug: string;
  answers: boolean[];
  completedAt: string;
}

export interface DefaultServerConfig {
  name: string;
  url: string;
  type: "url" | "sse";
}

export interface SpikeConfig {
  version: number;
  defaultServer?: DefaultServerConfig;
  onboarding?: OnboardingConfig;
}

export const SPIKE_CONFIG_VERSION = 1;
