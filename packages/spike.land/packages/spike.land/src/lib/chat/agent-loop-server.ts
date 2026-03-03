/**
 * Server-side wrapper around spike-cli's runAgentLoop that emits SSE events.
 *
 * Creates a ReadableStream of AgentSSEEvent-encoded SSE data.
 */

import {
  type AgentLoopContext,
  ChatClient,
  runAgentLoop,
} from "@spike-land-ai/spike-cli";
import type { ServerManager } from "@spike-land-ai/spike-cli";
import { type AgentSSEEvent, encodeSSE } from "./agent-sse-protocol";
import {
  type AgentPromptContext,
  buildAgentSystemPrompt,
} from "./agent-system-prompt";
import { getPreferredToken } from "@/lib/ai/token-pool";
import { createFallbackBotStream } from "./fallback-bot";
import logger from "@/lib/logger";

import type Anthropic from "@anthropic-ai/sdk";

/** Per-session conversation state. */
const sessionMessages = new Map<string, Anthropic.MessageParam[]>();

/** Get or create message history for a session. */
function getMessages(sessionId: string): Anthropic.MessageParam[] {
  let msgs = sessionMessages.get(sessionId);
  if (!msgs) {
    msgs = [];
    sessionMessages.set(sessionId, msgs);
  }
  return msgs;
}

export interface AgentLoopStreamOptions {
  sessionId: string;
  question: string;
  attachments?: { type: string; data: string; }[];
  manager: ServerManager;
  promptContext: AgentPromptContext;
  maxTurns?: number;
}

/**
 * Run the agentic loop and return a ReadableStream of SSE-encoded events.
 */
export function createAgentLoopStream(
  options: AgentLoopStreamOptions,
): ReadableStream<Uint8Array> {
  const { sessionId, question, manager, promptContext, maxTurns = 10 } = options;
  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentSSEEvent) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          cancelled = true;
        }
      };

      try {
        let authToken: string | undefined;
        let apiKey: string | undefined;

        try {
          authToken = getPreferredToken();
        } catch {
          apiKey = process.env.CLAUDE_API_KEY
            || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            // No AI available — use fallback bot
            logger.info("No AI tokens available, using fallback bot");
            const fallbackStream = createFallbackBotStream(options);
            const reader = fallbackStream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (cancelled) break;
                try {
                  controller.enqueue(value);
                } catch {
                  cancelled = true;
                }
              }
            } finally {
              reader.releaseLock();
            }
            return;
          }
        }

        const systemPrompt = buildAgentSystemPrompt(promptContext);
        const chatClient = new ChatClient({
          authToken,
          apiKey,
          model: "claude-sonnet-4-6",
          systemPrompt,
        });

        const messages = getMessages(sessionId);

        const ctx: AgentLoopContext = {
          client: chatClient,
          manager,
          messages,
          maxTurns,
          onTextDelta: (text: string) => emit({ type: "text_delta", text }),
          onToolCallStart: (
            id: string,
            name: string,
            serverName: string,
            input: unknown,
          ) =>
            emit({
              type: "tool_call_start",
              id,
              name,
              serverName,
              input: input as Record<string, unknown>,
            }),
          onToolCallEnd: (id: string, result: unknown, isError: boolean) =>
            emit({
              type: "tool_call_end",
              id,
              result: String(result),
              isError,
            }),
          onTurnStart: (turn: number, max: number) =>
            emit({ type: "turn_start", turn, maxTurns: max }),
          onTurnEnd: () => emit({ type: "turn_end" }),
        };

        const userMessageContent: Anthropic.MessageParam["content"] = [
          { type: "text", text: question.trim() },
        ];

        if (options.attachments?.length) {
          for (const att of options.attachments) {
            // data might be a full base64 data URL e.g. "data:image/png;base64,iVBORw0KGgo..."
            const base64Data = att.data.includes(",")
              ? (att.data.split(",")[1] ?? "")
              : att.data;
            userMessageContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: att.type as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: base64Data,
              },
            });
          }
        }

        await runAgentLoop(userMessageContent, ctx);

        emit({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isAuthFailure = message.includes("auth")
          || message.includes("401") || message.includes("token");

        if (isAuthFailure) {
          // Auth failure after token rotation — fall back to bot
          logger.warn("Agent loop auth failure, falling back to bot", {
            error: message,
          });
          const fallbackStream = createFallbackBotStream(options);
          const reader = fallbackStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (cancelled) break;
              try {
                controller.enqueue(value);
              } catch {
                cancelled = true;
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          logger.error("Agent loop error", { error: message });
          emit({
            type: "error",
            message: "An error occurred. Please try again.",
          });
        }
      } finally {
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}

/** Clear conversation history for a session. */
export function clearSession(sessionId: string): void {
  sessionMessages.delete(sessionId);
}
