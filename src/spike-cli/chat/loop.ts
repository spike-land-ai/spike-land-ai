/**
 * Agentic chat loop — send message, stream response, handle tool_use, repeat.
 * Separated from I/O for testability.
 */

import type { ChatClient, ContentBlock, Message, Tool } from "./client";
import type { ServerManager } from "../multiplexer/server-manager";
import { executeToolCall, mcpToolsToClaude } from "./tool-adapter";
import { log } from "../util/logger";

export interface AgentLoopContext {
  client: ChatClient;
  manager: ServerManager;
  messages: Message[];
  maxTurns?: number;
  onTextDelta?: (text: string) => void;
  onToolCall?: (name: string) => void;
  /** Called when a tool call begins execution. */
  onToolCallStart?: (
    id: string,
    name: string,
    serverName: string,
    input: Record<string, unknown>,
  ) => void;
  /** Called when a tool call completes. */
  onToolCallEnd?: (id: string, result: string, isError: boolean) => void;
  /** Called at the start of each agentic turn. */
  onTurnStart?: (turn: number, maxTurns: number) => void;
  /** Called at the end of each agentic turn. */
  onTurnEnd?: () => void;
}

/**
 * Run the agentic loop: send → stream → tool_use → tool_result → repeat.
 * Returns when Claude produces a text-only response or maxTurns is reached.
 */
export async function runAgentLoop(
  userMessage: string | Message["content"],
  ctx: AgentLoopContext,
): Promise<void> {
  const maxTurns = ctx.maxTurns ?? 20;
  const tools: Tool[] = mcpToolsToClaude(ctx.manager.getAllTools());

  // Add user message to history
  ctx.messages.push({ role: "user", content: userMessage });

  for (let turn = 0; turn < maxTurns; turn++) {
    log(`Agent loop turn ${turn + 1}/${maxTurns}`);
    ctx.onTurnStart?.(turn + 1, maxTurns);

    const stream = ctx.client.createStream(ctx.messages, tools);
    const response = await streamResponse(stream, ctx.onTextDelta);

    // Add assistant response to history
    ctx.messages.push({ role: "assistant", content: response.content });

    // Check for tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Extract<ContentBlock, { type: "tool_use"; }> => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      // Text-only response — done
      ctx.onTurnEnd?.();
      return;
    }

    // Execute all tool calls and build tool_result messages
    const toolResults: Message["content"] = [];
    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>;
      const serverName = resolveServerName(ctx.manager, toolUse.name);
      ctx.onToolCall?.(toolUse.name);
      ctx.onToolCallStart?.(toolUse.id, toolUse.name, serverName, input);

      const { result, isError } = await executeToolCall(
        ctx.manager,
        toolUse.name,
        input,
      );

      ctx.onToolCallEnd?.(toolUse.id, result, isError);

      toolResults.push({
        type: "tool_result" as const,
        tool_use_id: toolUse.id,
        content: result,
        is_error: isError,
      });
    }

    ctx.onTurnEnd?.();

    // Add tool results as user message and continue loop
    ctx.messages.push({
      role: "user",
      content: toolResults as Message["content"],
    });
  }

  // Reached maxTurns
  ctx.onTextDelta?.("\n[Reached maximum turns]\n");
}

/** Best-effort extraction of the server name from a namespaced tool. */
function resolveServerName(manager: ServerManager, toolName: string): string {
  const allTools = manager.getAllTools();
  const match = allTools.find(t => t.namespacedName === toolName);
  return match?.serverName ?? "unknown";
}

interface StreamResult {
  content: ContentBlock[];
}

async function streamResponse(
  stream: ReturnType<ChatClient["createStream"]>,
  onTextDelta?: (text: string) => void,
): Promise<StreamResult> {
  const content: ContentBlock[] = [];

  stream.on("contentBlock", (block: ContentBlock) => {
    content.push(block);
  });

  stream.on("text", (text: string) => {
    onTextDelta?.(text);
  });

  await stream.finalMessage();

  return { content };
}
