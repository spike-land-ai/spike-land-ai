/**
 * Programmatic API for spike MCP CLI.
 */

export { discoverConfig, type DiscoveryOptions } from "../node-sys/discovery";
export { validateConfig } from "./config/schema";
export type {
  HttpServerConfig,
  McpConfigFile,
  ResolvedConfig,
  ServerConfig,
  StdioServerConfig,
} from "./config/types";
export { setVerbose } from "./util/logger";
export { ChatClient, type ChatClientOptions } from "../ai/client";
export { runAgentLoop, type AgentLoopContext } from "./chat/loop";
export { AssertionRuntime, type AssertionRuntimeSnapshot } from "./chat/assertion-runtime";
export { ServerManager, type ServerManagerOptions } from "./multiplexer/server-manager";
