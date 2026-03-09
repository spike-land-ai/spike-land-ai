/**
 * Agentic chat loop — send message, stream response, handle tool_use, repeat.
 * Separated from I/O for testability.
 */

import type { ChatClient, ContentBlock, Message, Tool } from "../../ai/client";
import type { ServerManager } from "../multiplexer/server-manager";
import { executeToolCall, mcpToolsToClaude } from "./tool-adapter";
import { log } from "../util/logger";
import type { TokenTracker, TokenUsage } from "./token-tracker";
import type { DynamicToolRegistry } from "./tool-registry";
import type { ContextManager } from "./context-manager";

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
  /** Token usage tracker. When provided, records usage from each turn. */
  usageTracker?: TokenTracker;
  /** Called after each turn with updated tracker state. */
  onUsageUpdate?: (tracker: TokenTracker) => void;
  /** Dynamic tool registry. When provided, only active tools are sent to Claude. */
  registry?: DynamicToolRegistry;
  /** Context manager for automatic summarization. */
  contextManager?: ContextManager;
  /** Execute tool calls in parallel. Default: true */
  parallelExecution?: boolean;
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
  const parallel = ctx.parallelExecution !== false;

  // Add user message to history
  ctx.messages.push({ role: "user", content: userMessage });

  for (let turn = 0; turn < maxTurns; turn++) {
    log(`Agent loop turn ${turn + 1}/${maxTurns}`);
    ctx.onTurnStart?.(turn + 1, maxTurns);

    // Context management: summarize if needed before sending
    if (ctx.contextManager && ctx.usageTracker) {
      await ctx.contextManager.maybeSummarize(ctx.messages, ctx.usageTracker);
    }

    // Build tools per-turn (dynamic registry or all tools)
    const tools: Tool[] = ctx.registry
      ? mcpToolsToClaude(ctx.registry.getActiveTools())
      : mcpToolsToClaude(ctx.manager.getAllTools());

    // Build system prompt with catalog if registry is active
    let systemOverride: string | undefined;
    if (ctx.registry) {
      const catalog = ctx.registry.buildCatalog();
      const base = ctx.client.systemPrompt ?? "";
      systemOverride = `${base}\n\n## Available Tools\n\nBelow is a catalog of all available tools. Use the spike__tool_search tool to load any tool before calling it.\n\n${catalog}`;
    }

    const stream = ctx.client.createStream(ctx.messages, tools, systemOverride);
    const response = await streamResponse(stream, ctx.onTextDelta);

    // Record token usage if tracker is present
    if (ctx.usageTracker && response.usage) {
      ctx.usageTracker.recordTurn(response.usage);
      ctx.onUsageUpdate?.(ctx.usageTracker);
    }

    // Add assistant response to history
    ctx.messages.push({ role: "assistant", content: response.content });

    // Check for tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Extract<ContentBlock, { type: "tool_use" }> => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      // Text-only response — done
      ctx.onTurnEnd?.();
      return;
    }

    // Auto-activate tools that Claude calls but aren't yet active
    if (ctx.registry) {
      for (const toolUse of toolUseBlocks) {
        if (!ctx.registry.isActive(toolUse.name) && ctx.registry.isKnown(toolUse.name)) {
          ctx.registry.activate(toolUse.name);
        }
      }
    }

    // Execute tool calls (parallel or sequential)
    let toolResults: Message["content"];
    if (parallel && toolUseBlocks.length > 1) {
      toolResults = await executeToolsParallel(toolUseBlocks, ctx);
    } else {
      toolResults = await executeToolsSequential(toolUseBlocks, ctx);
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

async function executeToolsSequential(
  toolUseBlocks: Extract<ContentBlock, { type: "tool_use" }>[],
  ctx: AgentLoopContext,
): Promise<Message["content"]> {
  const toolResults: Message["content"] = [];
  for (const toolUse of toolUseBlocks) {
    const input = toolUse.input as Record<string, unknown>;
    const serverName = resolveServerName(ctx.manager, toolUse.name);
    ctx.onToolCall?.(toolUse.name);
    ctx.onToolCallStart?.(toolUse.id, toolUse.name, serverName, input);

    const { result, isError } = await executeToolCall(ctx.manager, toolUse.name, input);

    ctx.onToolCallEnd?.(toolUse.id, result, isError);

    toolResults.push({
      type: "tool_result" as const,
      tool_use_id: toolUse.id,
      content: result,
      is_error: isError,
    });
  }
  return toolResults;
}

async function executeToolsParallel(
  toolUseBlocks: Extract<ContentBlock, { type: "tool_use" }>[],
  ctx: AgentLoopContext,
): Promise<Message["content"]> {
  const executions = toolUseBlocks.map(async (toolUse) => {
    const input = toolUse.input as Record<string, unknown>;
    const serverName = resolveServerName(ctx.manager, toolUse.name);
    ctx.onToolCall?.(toolUse.name);
    ctx.onToolCallStart?.(toolUse.id, toolUse.name, serverName, input);

    const { result, isError } = await executeToolCall(ctx.manager, toolUse.name, input);

    ctx.onToolCallEnd?.(toolUse.id, result, isError);

    return {
      type: "tool_result" as const,
      tool_use_id: toolUse.id,
      content: result,
      is_error: isError,
    };
  });

  const settled = await Promise.allSettled(executions);
  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    // On rejection, return error result
    return {
      type: "tool_result" as const,
      tool_use_id: toolUseBlocks[i]!.id,
      content: `Tool execution failed: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`,
      is_error: true,
    };
  });
}

/** Best-effort extraction of the server name from a namespaced tool. */
function resolveServerName(manager: ServerManager, toolName: string): string {
  const allTools = manager.getAllTools();
  const match = allTools.find((t) => t.namespacedName === toolName);
  return match?.serverName ?? "unknown";
}

interface StreamResult {
  content: ContentBlock[];
  usage?: TokenUsage;
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

  const finalMessage = await stream.finalMessage();

  // Extract usage from final message (Anthropic.Message has usage typed directly)
  const usage = finalMessage.usage ?? undefined;

  return usage ? { content, usage } : { content };
}
