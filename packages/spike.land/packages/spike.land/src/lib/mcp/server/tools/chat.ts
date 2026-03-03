/**
 * AI Chat MCP Tools
 *
 * Send messages and get AI responses via the Claude API.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
const MODEL_MAP: Record<string, string> = {
  opus: "claude-4-6-opus",
  sonnet: "claude-4-6-sonnet",
  haiku: "claude-4-5-haiku",
};

const ChatSendMessageSchema = z.object({
  message: z.string().min(1).describe("The message to send to the AI."),
  model: z.enum(["opus", "sonnet", "haiku"]).optional().default("sonnet")
    .describe("Claude model to use."),
  system_prompt: z.string().optional().describe(
    "Optional system prompt for the conversation.",
  ),
});

export function registerChatTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "chat_send_message",
    description: "Send a message to Claude and get a non-streaming AI response.",
    category: "chat",
    tier: "free",
    inputSchema: ChatSendMessageSchema.shape,
    handler: async (
      { message, model = "sonnet", system_prompt }: z.infer<
        typeof ChatSendMessageSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("chat_send_message", async () => {
        const { getClaudeClient } = await import("@/lib/ai/claude-client");
        const anthropic = await getClaudeClient();

        const resolvedModel = MODEL_MAP[model] ?? MODEL_MAP.sonnet!;

        const response = await anthropic.messages.create({
          model: resolvedModel,
          max_tokens: 16384,
          ...(system_prompt ? { system: system_prompt } : {}),
          messages: [{ role: "user", content: message }],
        });

        // Extract text from the response content blocks
        const textParts: string[] = [];
        for (const block of response.content) {
          if (block.type === "text") {
            textParts.push(block.text);
          }
        }
        const textBlocks = textParts;

        const responseText = textBlocks.join("\n");

        return textResult(
          `**AI Response** (${model}, ${response.usage.input_tokens} in / ${response.usage.output_tokens} out)\n\n${responseText}`,
        );
      }, { userId }),
  });
}
