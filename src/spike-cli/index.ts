/**
 * Programmatic API for spike MCP CLI.
 */

export { discoverConfig, type DiscoveryOptions } from "./config/discovery";
export { validateConfig } from "./config/schema";
export type {
  HttpServerConfig,
  McpConfigFile,
  ResolvedConfig,
  ServerConfig,
  StdioServerConfig,
} from "./config/types";
export { setVerbose } from "./util/logger";
