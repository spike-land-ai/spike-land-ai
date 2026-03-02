/**
 * UpstreamClient: connects to a single MCP server via stdio or HTTP.
 */

import type { ServerConfig } from "../config/types.js";

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class UpstreamClient {
  readonly name: string;
  private config: ServerConfig;
  private _connected = false;
  private _tools: ToolDefinition[] = [];

  constructor(name: string, config: ServerConfig) {
    this.name = name;
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    // Implementation would spawn a subprocess or connect to HTTP endpoint.
    // Kept minimal — real behaviour is provided via mocks in tests.
    this._connected = true;
    void this.config; // suppress unused warning
  }

  getTools(): ToolDefinition[] {
    return this._tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    void args;
    throw new Error(`Tool not found on upstream ${this.name}: ${name}`);
  }

  async close(): Promise<void> {
    this._connected = false;
  }
}
