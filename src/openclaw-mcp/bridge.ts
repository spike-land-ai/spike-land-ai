import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  McpBridge,
  McpBridgeOptions,
  McpCallResult,
  McpContentItem,
  McpToolDef,
} from "./types.js";

type ToolEntry = McpToolDef & { sessionKey: string };

type GatewayToolListResult = {
  tools: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  sessionKey?: string;
};

type ChatResult = {
  message?: { content?: Array<{ type: string; text?: string }> };
};

type ToolCallResult = {
  content?: Array<{ type: string; text?: string; mimeType?: string; url?: string; data?: string }>;
};

export function createMcpBridge(opts: McpBridgeOptions): McpBridge {
  const { transport, serverInfo, verbose } = opts;
  const defaultSessionKey = opts.defaultSessionKey ?? "agent:main:main";
  const log = verbose ? (msg: string) => process.stderr.write(`[mcp] ${msg}\n`) : () => {};

  const toolRegistry = new Map<string, ToolEntry>();
  let toolsLoaded = false;

  // Register the built-in chat tool
  toolRegistry.set("chat", {
    name: "chat",
    description: "Send a message to the OpenClaw assistant and get a response",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to send" },
        session: {
          type: "string",
          description: `Session key (default: ${defaultSessionKey})`,
        },
      },
      required: ["message"],
    },
    sessionKey: defaultSessionKey,
  });

  function listTools(): McpToolDef[] {
    return [...toolRegistry.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async function loadGatewayTools(): Promise<void> {
    if (toolsLoaded) {
      return;
    }
    toolsLoaded = true;

    let toolList: GatewayToolListResult;
    try {
      toolList = await transport.request<GatewayToolListResult>("tools.list", {});
    } catch (err) {
      log(`tools.list not available (${String(err)}), using chat-only mode`);
      return;
    }

    const sessionKey = toolList.sessionKey ?? defaultSessionKey;
    for (const tool of toolList.tools) {
      toolRegistry.set(tool.name, {
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.parameters ?? { type: "object", properties: {} },
        sessionKey,
      });
    }
    log(`loaded ${toolList.tools.length} tools from gateway (session: ${sessionKey})`);
  }

  async function executeChatTool(args: Record<string, unknown>): Promise<McpCallResult> {
    const message = args.message as string | undefined;
    if (!message) {
      return {
        content: [{ type: "text", text: "Error: message is required" }],
        isError: true,
      };
    }
    const sessionKey = (args.session as string | undefined) ?? defaultSessionKey;
    log(`chat: ${sessionKey}: ${message.slice(0, 80)}`);

    try {
      const result = await transport.request<ChatResult>(
        "chat.send",
        { sessionKey, message },
        { expectFinal: true },
      );
      const text = result.message?.content?.find((c) => c.type === "text")?.text ?? "(no response)";
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  }

  async function executeGatewayTool(
    entry: ToolEntry,
    args: Record<string, unknown>,
  ): Promise<McpCallResult> {
    log(`tool: ${entry.name}`);
    try {
      const result = await transport.request<ToolCallResult>("tools.call", {
        sessionKey: entry.sessionKey,
        name: entry.name,
        args,
      });
      const content = result.content ?? [];
      return {
        content: content.map((c): McpContentItem => {
          if (c.type === "text") {
            return { type: "text", text: c.text ?? "" };
          }
          if (c.type === "image") {
            if (c.data) {
              return {
                type: "image",
                source: {
                  type: "base64",
                  data: c.data,
                  mediaType: c.mimeType ?? "application/octet-stream",
                },
              };
            }
            if (c.url) {
              return {
                type: "image",
                source: { type: "url", url: c.url },
              };
            }
            return { type: "text", text: `[image: ${c.mimeType ?? "unknown"}]` };
          }
          return { type: "text", text: JSON.stringify(c) };
        }),
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  }

  async function callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    if (name === "chat") {
      return executeChatTool(args);
    }
    const entry = toolRegistry.get(name);
    if (!entry) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    return executeGatewayTool(entry, args);
  }

  async function serve(): Promise<void> {
    const server = new Server(
      { name: serverInfo.name, version: serverInfo.version },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listTools(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: callArgs = {} } = request.params;
      return callTool(name, callArgs);
    });

    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    log("server started");

    await new Promise<void>((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });

    await server.close();
    log("server stopped");
  }

  return { listTools, loadGatewayTools, callTool, serve };
}
