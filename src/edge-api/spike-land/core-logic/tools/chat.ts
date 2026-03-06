/**
 * AI Chat MCP Tools (CF Workers)
 *
 * Send messages and get AI responses via direct fetch to the Anthropic API.
 * Ported from spike.land — no Anthropic SDK, uses native fetch.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, textResult } from "../../lazy-imports/procedures-index.ts";
import { McpError, McpErrorCode, safeToolCall } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";
import type { Env } from "../env";

const MODEL_MAP: Record<string, string> = {
  opus: "claude-4-6-opus",
  sonnet: "claude-4-6-sonnet",
  haiku: "claude-4-5-haiku",
};

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export function registerChatTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env: Env,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("chat_send_message", "Send a message to Claude and get a non-streaming AI response.", {
        message: z.string().min(1).describe("The message to send to the AI."),
        model: z
          .enum(["opus", "sonnet", "haiku"])
          .optional()
          .default("sonnet")
          .describe("Claude model to use."),
        system_prompt: z
          .string()
          .optional()
          .describe("Optional system prompt for the conversation."),
      })
      .meta({ category: "chat", tier: "free" })
      .handler(async ({ input }) => {
        const { message, model = "sonnet", system_prompt } = input;
        return safeToolCall("chat_send_message", async () => {
          const apiKey = env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            throw new McpError("ANTHROPIC_API_KEY not configured.", McpErrorCode.AUTH_ERROR, false);
          }

          const resolvedModel = MODEL_MAP[model] ?? MODEL_MAP.sonnet!;

          const body: Record<string, unknown> = {
            model: resolvedModel,
            max_tokens: 16384,
            messages: [{ role: "user", content: message }],
          };
          if (system_prompt) {
            body.system = system_prompt;
          }

          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new McpError(
              `Anthropic API error (${response.status}): ${errorText}`,
              response.status === 429
                ? McpErrorCode.RATE_LIMITED
                : McpErrorCode.UPSTREAM_SERVICE_ERROR,
              response.status === 429,
            );
          }

          const data = (await response.json()) as AnthropicResponse;

          const textParts: string[] = [];
          for (const block of data.content) {
            if (block.type === "text" && block.text) {
              textParts.push(block.text);
            }
          }

          const responseText = textParts.join("\n");

          return textResult(
            `**AI Response** (${model}, ${data.usage.input_tokens} in / ${data.usage.output_tokens} out)\n\n${responseText}`,
          );
        });
      }),
  );
}
