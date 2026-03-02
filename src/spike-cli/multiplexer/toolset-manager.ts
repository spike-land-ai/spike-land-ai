/**
 * ToolsetManager: manages lazy-loading of groups of MCP servers (toolsets).
 */

import type { ToolsetConfig } from "../config/types.js";

export interface ToolDefinitionMeta {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolsetListEntry {
  name: string;
  description: string;
  loaded: boolean;
  servers: string[];
  toolCount: number;
}

export interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: true;
}

export class ToolsetManager {
  private toolsets: Record<string, ToolsetConfig>;
  private loadedToolsets: Set<string> = new Set();
  private toolCountFn: (serverName: string) => number;

  /**
   * @param toolsets - Map of toolset name to config (servers + description).
   * @param toolCountFn - Called to get the current tool count for a server.
   */
  constructor(
    toolsets: Record<string, ToolsetConfig>,
    toolCountFn: (serverName: string) => number = () => 0,
  ) {
    this.toolsets = toolsets;
    this.toolCountFn = toolCountFn;
  }

  /** Returns true if the server's tools should be included in the unified tool list. */
  isServerVisible(serverName: string): boolean {
    // If the server is not in any toolset, always visible.
    for (const [name, config] of Object.entries(this.toolsets)) {
      if (config.servers.includes(serverName)) {
        // Server is in a toolset — only visible if that toolset is loaded.
        return this.loadedToolsets.has(name);
      }
    }
    return true;
  }

  loadToolset(name: string): { loaded: string[]; toolCount: number } {
    const config = this.toolsets[name];
    if (!config) throw new Error(`Unknown toolset: ${name}`);
    this.loadedToolsets.add(name);
    const toolCount = config.servers.reduce((sum, s) => sum + this.toolCountFn(s), 0);
    return { loaded: config.servers, toolCount };
  }

  unloadToolset(name: string): void {
    const config = this.toolsets[name];
    if (!config) throw new Error(`Unknown toolset: ${name}`);
    this.loadedToolsets.delete(name);
  }

  listToolsets(): ToolsetListEntry[] {
    return Object.entries(this.toolsets).map(([name, config]) => ({
      name,
      description: config.description ?? "",
      loaded: this.loadedToolsets.has(name),
      servers: config.servers,
      toolCount: config.servers.reduce((sum, s) => sum + this.toolCountFn(s), 0),
    }));
  }

  getMetaTools(): ToolDefinitionMeta[] {
    return [
      {
        name: "spike__list_toolsets",
        description: "List available toolsets and their load status",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "spike__load_toolset",
        description: "Load a toolset by name to expose its tools",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Toolset name to load" },
          },
          required: ["name"],
        },
      },
      {
        name: "spike__unload_toolset",
        description: "Unload a toolset by name to hide its tools",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Toolset name to unload" },
          },
          required: ["name"],
        },
      },
    ];
  }

  isMetaTool(name: string): boolean {
    return name === "spike__list_toolsets" ||
      name === "spike__load_toolset" ||
      name === "spike__unload_toolset";
  }

  handleMetaTool(name: string, args: Record<string, unknown>): ToolCallResult {
    if (name === "spike__list_toolsets") {
      return {
        content: [{ type: "text", text: JSON.stringify(this.listToolsets()) }],
      };
    }

    if (name === "spike__load_toolset") {
      const toolsetName = args.name;
      if (typeof toolsetName !== "string") {
        return {
          content: [{ type: "text", text: "name is required" }],
          isError: true,
        };
      }
      try {
        const result = this.loadToolset(toolsetName);
        return {
          content: [
            {
              type: "text",
              text: `Loaded toolset "${toolsetName}": ${result.loaded.join(", ")} (${result.toolCount} tools)`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: String(err instanceof Error ? err.message : err) }],
          isError: true,
        };
      }
    }

    if (name === "spike__unload_toolset") {
      const toolsetName = args.name;
      if (typeof toolsetName !== "string") {
        return {
          content: [{ type: "text", text: "name is required" }],
          isError: true,
        };
      }
      const config = this.toolsets[toolsetName];
      if (!config) {
        return {
          content: [{ type: "text", text: `Unknown toolset: ${toolsetName}` }],
          isError: true,
        };
      }
      if (!this.loadedToolsets.has(toolsetName)) {
        return {
          content: [{ type: "text", text: `Toolset "${toolsetName}" is not currently loaded` }],
          isError: true,
        };
      }
      this.unloadToolset(toolsetName);
      return {
        content: [
          {
            type: "text",
            text: `Unloaded toolset "${toolsetName}": ${config.servers.join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown meta-tool: ${name}` }],
      isError: true,
    };
  }
}
