/**
 * ServerManager: manages a pool of upstream MCP clients, exposes namespaced tools,
 * and routes tool calls to the correct upstream.
 */

import type { ResolvedConfig, ServerConfig } from "../config/types.js";
import { UpstreamClient, type ToolCallResult } from "./upstream-client.js";
import type { ToolsetManager } from "./toolset-manager.js";

const DEFAULT_SEPARATOR = "__";

export interface NamespacedTool {
  namespacedName: string;
  originalName: string;
  serverName: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ServerManagerOptions {
  /** If true, do not prefix tool names with the server name. */
  noPrefix?: boolean;
  /** Separator between server name and tool name. Default: "__" */
  separator?: string;
}

export interface ConfigDiffResult {
  added: string[];
  removed: string[];
  changed: string[];
}

export class ServerManager {
  private clients: Map<string, UpstreamClient> = new Map();
  private options: ServerManagerOptions;
  toolsetManager?: ToolsetManager;

  constructor(options: ServerManagerOptions = {}) {
    this.options = options;
  }

  private get separator(): string {
    return this.options.separator ?? DEFAULT_SEPARATOR;
  }

  setToolsetManager(tsm: ToolsetManager): void {
    this.toolsetManager = tsm;
  }

  async connectAll(config: ResolvedConfig): Promise<void> {
    const entries = Object.entries(config.servers);
    await Promise.allSettled(
      entries.map(async ([name, serverConfig]) => {
        try {
          const client = new UpstreamClient(name, serverConfig);
          await client.connect();
          this.clients.set(name, client);
        } catch (err) {
          console.error(`Failed to connect to server "${name}":`, err);
        }
      }),
    );
  }

  getServerNames(): string[] {
    return [...this.clients.keys()];
  }

  isConnected(serverName: string): boolean {
    const client = this.clients.get(serverName);
    return client?.connected ?? false;
  }

  getServerTools(serverName: string): Array<{ name: string; description?: string }> {
    const client = this.clients.get(serverName);
    if (!client) return [];
    return client.getTools().map((t) => ({ name: t.name, description: t.description }));
  }

  getAllTools(): NamespacedTool[] {
    const result: NamespacedTool[] = [];

    for (const [serverName, client] of this.clients) {
      if (this.toolsetManager && !this.toolsetManager.isServerVisible(serverName)) {
        continue;
      }
      for (const tool of client.getTools()) {
        const namespacedName = this.options.noPrefix
          ? tool.name
          : `${serverName}${this.separator}${tool.name}`;
        result.push({
          namespacedName,
          originalName: tool.name,
          serverName,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }

    if (this.toolsetManager) {
      for (const metaTool of this.toolsetManager.getMetaTools()) {
        result.push({
          namespacedName: metaTool.name,
          originalName: metaTool.name,
          serverName: "spike",
          description: metaTool.description,
          inputSchema: metaTool.inputSchema,
        });
      }
    }

    return result;
  }

  async callTool(
    namespacedName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    // Check meta-tools first
    if (this.toolsetManager?.isMetaTool(namespacedName)) {
      return this.toolsetManager.handleMetaTool(namespacedName, args);
    }

    // Find the upstream by resolving the namespace prefix
    for (const [serverName, client] of this.clients) {
      if (this.options.noPrefix) {
        // In no-prefix mode, check toolset visibility
        if (this.toolsetManager && !this.toolsetManager.isServerVisible(serverName)) {
          continue;
        }
        const tools = client.getTools();
        if (tools.some((t) => t.name === namespacedName)) {
          return client.callTool(namespacedName, args);
        }
      } else {
        const prefix = `${serverName}${this.separator}`;
        if (namespacedName.startsWith(prefix)) {
          // Check toolset visibility
          if (this.toolsetManager && !this.toolsetManager.isServerVisible(serverName)) {
            throw new Error(`Server "${serverName}" is in a toolset not loaded yet`);
          }
          const originalName = namespacedName.slice(prefix.length);
          // Verify the tool actually exists on this server
          const tools = client.getTools();
          if (!tools.some((t) => t.name === originalName)) {
            throw new Error(`Tool not found: ${originalName} on server ${serverName}`);
          }
          return client.callTool(originalName, args);
        }
      }
    }

    if (this.options.noPrefix) {
      throw new Error(`Tool not found: ${namespacedName}`);
    }

    throw new Error(`Cannot resolve tool: ${namespacedName}`);
  }

  async reconnect(serverName: string, config?: ServerConfig): Promise<void> {
    const existing = this.clients.get(serverName);
    if (existing) {
      await existing.close();
    }
    const serverConfig = config ?? (existing as unknown as { config: ServerConfig })?.config;
    if (!serverConfig) {
      throw new Error(`Unknown server: ${serverName}`);
    }
    const client = new UpstreamClient(serverName, serverConfig);
    await client.connect();
    this.clients.set(serverName, client);
  }

  async disconnectServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) return;
    await client.close();
    this.clients.delete(serverName);
  }

  async applyConfigDiff(
    oldConfig: ResolvedConfig,
    newConfig: ResolvedConfig,
  ): Promise<ConfigDiffResult> {
    const oldNames = new Set(Object.keys(oldConfig.servers));
    const newNames = new Set(Object.keys(newConfig.servers));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    // Find removed servers
    for (const name of oldNames) {
      if (!newNames.has(name)) {
        await this.disconnectServer(name);
        removed.push(name);
      }
    }

    // Find added and changed servers
    for (const name of newNames) {
      if (!oldNames.has(name)) {
        // New server
        try {
          const client = new UpstreamClient(name, newConfig.servers[name]);
          await client.connect();
          this.clients.set(name, client);
          added.push(name);
        } catch {
          // Gracefully handle connect failure
        }
      } else if (
        JSON.stringify(oldConfig.servers[name]) !== JSON.stringify(newConfig.servers[name])
      ) {
        // Changed server — reconnect
        try {
          await this.reconnect(name, newConfig.servers[name]);
          changed.push(name);
        } catch {
          // Gracefully handle reconnect failure
        }
      }
    }

    return { added, removed, changed };
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.close()));
    this.clients.clear();
  }

  /** Expose config for status command (via the upstream client). */
  getServerConfig(_serverName: string): ServerConfig | undefined {
    return undefined;
  }
}
