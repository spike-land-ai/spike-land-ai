import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { SpacetimeMcpClient } from "./client.js";

export class SpacetimeServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private client: SpacetimeMcpClient;
  private supportedTools: Map<string, any> = new Map();
  private pendingTasks: Map<string | number, bigint> = new Map();
  private category: string;

  constructor(client: SpacetimeMcpClient, category = "default") {
    this.client = client;
    this.category = category;
  }

  async start(): Promise<void> {
    // Wait a brief tick to allow McpServer to set onmessage
    setTimeout(() => {
      if (this.onmessage) {
        // Request the list of tools from the local MCP server
        this.onmessage({
          jsonrpc: "2.0",
          id: "stdb-init-list",
          method: "tools/list",
        });
      }
    }, 10);

    // Subscribe to DB changes to poll tasks
    this.client.onEvent(() => {
      this.pollTasks();
    });
  }

  async close(): Promise<void> {
    this.client.disconnect();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if ("id" in message && message.id === "stdb-init-list") {
      // Intercept the tools/list response
      if ("result" in message && message.result && typeof message.result === "object" && "tools" in message.result) {
        const tools = (message.result as any).tools as Array<any>;
        for (const t of tools) {
          this.supportedTools.set(t.name, t);
          await this.client.registerTool(
            t.name,
            t.description || "",
            JSON.stringify(t.inputSchema || {}),
            this.category
          );
        }
      }
      return;
    }

    if ("id" in message && message.id) {
      const taskId = this.pendingTasks.get(message.id);
      if (taskId !== undefined) {
        if ("result" in message) {
          await this.client.completeMcpTask(taskId, JSON.stringify(message.result), undefined);
        } else if ("error" in message) {
          await this.client.completeMcpTask(taskId, undefined, JSON.stringify(message.error));
        }
        this.pendingTasks.delete(message.id);
        return;
      }
    }
  }

  private async pollTasks() {
    if (this.supportedTools.size === 0) return;

    const tasks = this.client.listMcpTasks("pending");
    for (const task of tasks) {
      if (this.supportedTools.has(task.toolName)) {
        try {
          await this.client.claimMcpTask(task.id);
        } catch (e) {
          // Task might have been claimed by another node, or already completed
          continue;
        }

        // Successfully claimed, route to local server
        const messageId = Number(task.id);
        this.pendingTasks.set(messageId, task.id);

        let args = {};
        try {
          args = JSON.parse(task.argumentsJson);
        } catch (e) {
          // ignore
        }

        this.onmessage?.({
          jsonrpc: "2.0",
          id: messageId,
          method: "tools/call",
          params: {
            name: task.toolName,
            arguments: args,
          },
        });
      }
    }
  }
}
