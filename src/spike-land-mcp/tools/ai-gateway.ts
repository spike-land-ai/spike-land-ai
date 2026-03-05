/**
 * AI Gateway MCP Tools (CF Workers)
 *
 * Provider-agnostic AI interface: model listing and multi-provider chat.
 * Uses direct fetch to Anthropic, OpenAI, and Gemini APIs.
 * Ported from spike.land — no SDKs, no Prisma, no model registry import.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { McpError, McpErrorCode, safeToolCall } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";
import type { Env } from "../env";

// ─── Inline Model Registry ──────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  displayName: string;
  provider: "anthropic" | "openai" | "google";
  aliases: string[];
  capabilities: string[];
  maxOutputTokens: number;
}

const MODEL_REGISTRY: ModelInfo[] = [
  {
    id: "claude-4-6-opus",
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    aliases: ["opus"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 32768,
  },
  {
    id: "claude-4-6-sonnet",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    aliases: ["sonnet"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 16384,
  },
  {
    id: "claude-4-5-haiku",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    aliases: ["haiku"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 8192,
  },
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    aliases: ["gpt4o"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 16384,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    aliases: ["gpt4o-mini", "mini"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 16384,
  },
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    aliases: ["gemini-flash", "flash"],
    capabilities: ["chat", "vision", "structured"],
    maxOutputTokens: 8192,
  },
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    aliases: ["gemini-pro"],
    capabilities: ["chat", "vision", "image-gen", "structured"],
    maxOutputTokens: 8192,
  },
];

function resolveModel(modelInput: string): ModelInfo | undefined {
  const lower = modelInput.toLowerCase();
  return MODEL_REGISTRY.find((m) => m.id === lower || m.aliases.includes(lower));
}

function resolveProvider(
  modelInput?: string,
  providerOverride?: string,
): "anthropic" | "openai" | "google" {
  if (providerOverride) {
    return providerOverride as "anthropic" | "openai" | "google";
  }
  if (modelInput) {
    const model = resolveModel(modelInput);
    if (model) return model.provider;
  }
  return "anthropic";
}

// ─── Anthropic API call ─────────────────────────────────────────────────────

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

async function callAnthropic(
  env: Env,
  message: string,
  modelId: string,
  maxTokens: number,
  systemPrompt?: string,
  temperature?: number,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new McpError("ANTHROPIC_API_KEY not configured.", McpErrorCode.AUTH_ERROR, false);
  }

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: message }],
  };
  if (systemPrompt) body.system = systemPrompt;
  if (temperature != null) body.temperature = temperature;

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
      response.status === 429 ? McpErrorCode.RATE_LIMITED : McpErrorCode.UPSTREAM_SERVICE_ERROR,
      response.status === 429,
    );
  }

  const data = (await response.json()) as AnthropicResponse;
  const textParts: string[] = [];
  for (const block of data.content) {
    if (block.type === "text" && block.text) textParts.push(block.text);
  }

  return { text: textParts.join("\n"), usage: data.usage };
}

// ─── OpenAI API call ────────────────────────────────────────────────────────

interface OpenAIChoice {
  message: { content: string | null };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

async function callOpenAI(
  env: Env,
  message: string,
  modelId: string,
  maxTokens: number,
  systemPrompt?: string,
  temperature?: number,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new McpError("OPENAI_API_KEY not configured.", McpErrorCode.AUTH_ERROR, false);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: message });

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxTokens,
    messages,
  };
  if (temperature != null) body.temperature = temperature;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new McpError(
      `OpenAI API error (${response.status}): ${errorText}`,
      response.status === 429 ? McpErrorCode.RATE_LIMITED : McpErrorCode.UPSTREAM_SERVICE_ERROR,
      response.status === 429,
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = data.choices[0]?.message.content ?? "";

  return {
    text,
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
  };
}

// ─── Gemini API call ────────────────────────────────────────────────────────

interface GeminiCandidate {
  content: { parts: Array<{ text?: string }> };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
}

async function callGemini(
  env: Env,
  message: string,
  modelId: string,
  maxTokens: number,
  systemPrompt?: string,
  temperature?: number,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new McpError("GEMINI_API_KEY not configured.", McpErrorCode.AUTH_ERROR, false);
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
    },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new McpError(
      `Gemini API error (${response.status}): ${errorText}`,
      response.status === 429 ? McpErrorCode.RATE_LIMITED : McpErrorCode.UPSTREAM_SERVICE_ERROR,
      response.status === 429,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const textParts: string[] = [];
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content.parts) {
      if (part.text) textParts.push(part.text);
    }
  }

  return {
    text: textParts.join("\n"),
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

// ─── Tool Registration ──────────────────────────────────────────────────────

export function registerAiGatewayTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env: Env,
): void {
  // Tool 1: ai_list_providers
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "ai_list_providers",
        "List configured AI providers with availability status and capabilities.",
        {},
      )
      .meta({ category: "ai-gateway", tier: "free" })
      .handler(async () => {
        return safeToolCall("ai_list_providers", async () => {
          const providers = [
            {
              name: "anthropic",
              status: env.ANTHROPIC_API_KEY ? "configured" : "not_configured",
              capabilities: ["chat", "vision"],
            },
            {
              name: "openai",
              status: env.OPENAI_API_KEY ? "configured" : "not_configured",
              capabilities: ["chat", "vision"],
            },
            {
              name: "google",
              status: env.GEMINI_API_KEY ? "configured" : "not_configured",
              capabilities: ["chat", "vision", "image-gen", "structured"],
            },
          ];

          return textResult(JSON.stringify({ providers }, null, 2));
        });
      }),
  );

  // Tool 2: ai_list_models
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "ai_list_models",
        "List available AI models, optionally filtered by provider and/or capability.",
        {
          provider: z
            .enum(["anthropic", "openai", "google", "all"])
            .optional()
            .default("all")
            .describe("Filter by provider, or 'all' for every provider."),
          capability: z
            .enum(["chat", "vision", "image-gen", "structured", "all"])
            .optional()
            .default("all")
            .describe("Filter by capability, or 'all'."),
        },
      )
      .meta({ category: "ai-gateway", tier: "free" })
      .handler(async ({ input }) => {
        const { provider = "all", capability = "all" } = input;
        return safeToolCall("ai_list_models", async () => {
          let models =
            provider === "all"
              ? [...MODEL_REGISTRY]
              : MODEL_REGISTRY.filter((m) => m.provider === provider);

          if (capability !== "all") {
            models = models.filter((m) => m.capabilities.includes(capability));
          }

          const result = models.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            provider: m.provider,
            aliases: m.aliases,
            capabilities: m.capabilities,
            maxOutputTokens: m.maxOutputTokens,
          }));

          return textResult(JSON.stringify({ models: result, count: result.length }, null, 2));
        });
      }),
  );

  // Tool 3: ai_chat
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "ai_chat",
        "Send a message to any configured AI provider (Anthropic, OpenAI, or Google) with automatic provider/model detection.",
        {
          message: z.string().min(1).describe("The message to send to the AI model."),
          provider: z
            .enum(["anthropic", "openai", "google"])
            .optional()
            .describe("Explicit provider override. Auto-detected from model if omitted."),
          model: z
            .string()
            .optional()
            .describe(
              "Model ID or alias (e.g. 'opus', 'gemini-flash', 'gpt4o'). Defaults to provider's default.",
            ),
          system_prompt: z.string().optional().describe("Optional system prompt."),
          max_tokens: z
            .number()
            .int()
            .min(1)
            .max(65536)
            .optional()
            .describe("Maximum output tokens."),
          temperature: z.number().min(0).max(2).optional().describe("Sampling temperature."),
        },
      )
      .meta({ category: "ai-gateway", tier: "workspace" })
      .examples([
        {
          name: "basic_chat",
          input: { message: "Explain quantum computing in one sentence." },
          description: "Send a basic message to the default provider"
        },
        {
          name: "specific_model",
          input: { message: "Write a python script to parse JSON", model: "opus", temperature: 0.2 },
          description: "Use a specific model with low temperature"
        }
      ])
      .handler(async ({ input }) => {
        const { message, provider, model, system_prompt, max_tokens, temperature } = input;
        return safeToolCall("ai_chat", async () => {
          const resolvedProvider = resolveProvider(model, provider);
          const resolvedModelInfo = model ? resolveModel(model) : undefined;

          let result: {
            text: string;
            usage: { input_tokens: number; output_tokens: number };
          };
          let modelId: string;

          if (resolvedProvider === "anthropic") {
            modelId = resolvedModelInfo?.id ?? "claude-4-6-sonnet";
            const maxTokens = max_tokens ?? resolvedModelInfo?.maxOutputTokens ?? 16384;
            result = await callAnthropic(
              env,
              message,
              modelId,
              maxTokens,
              system_prompt,
              temperature,
            );
          } else if (resolvedProvider === "openai") {
            modelId = resolvedModelInfo?.id ?? "gpt-4o";
            const maxTokens = max_tokens ?? resolvedModelInfo?.maxOutputTokens ?? 16384;
            result = await callOpenAI(env, message, modelId, maxTokens, system_prompt, temperature);
          } else {
            modelId = resolvedModelInfo?.id ?? "gemini-2.5-flash";
            const maxTokens = max_tokens ?? resolvedModelInfo?.maxOutputTokens ?? 8192;
            result = await callGemini(env, message, modelId, maxTokens, system_prompt, temperature);
          }

          return textResult(
            JSON.stringify(
              {
                provider: resolvedProvider,
                model: modelId,
                response: result.text,
                usage: result.usage,
              },
              null,
              2,
            ),
          );
        });
      }),
  );
}
