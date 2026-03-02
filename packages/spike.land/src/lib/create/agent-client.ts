import type { APIError } from "@anthropic-ai/sdk";
import type { ContentBlockParam, TextBlock } from "@anthropic-ai/sdk/resources/messages.js";
import { getClaudeClient, resetClaudeClient } from "@/lib/ai/claude-client";
import { generateAgentResponse } from "@/lib/ai/gemini-client";

export interface ClaudeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Whether the response was truncated due to hitting max_tokens. */
  truncated: boolean;
}

export type ClaudeModel = "opus" | "sonnet" | "haiku";

const MODEL_MAP: Record<ClaudeModel, string> = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

import logger from "@/lib/logger";

const CLAUDE_MAX_RETRIES = 3;
const CLAUDE_RETRY_DELAYS = [1000, 2000, 4000];
/** HTTP status codes that are worth retrying (transient). */
const RETRYABLE_STATUS_CODES = new Set([429, 529]);

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as APIError).status;
    return typeof status === "number" && RETRYABLE_STATUS_CODES.has(status);
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as APIError).status === 401;
  }
  return false;
}

function getRetryAfterMs(error: unknown): number | null {
  if (error && typeof error === "object" && "headers" in error) {
    const headers = (error as APIError).headers;
    const retryAfter = headers?.get?.("retry-after");
    if (retryAfter) {
      const seconds = parseFloat(retryAfter);
      if (!isNaN(seconds) && seconds > 0 && seconds <= 30) {
        return seconds * 1000;
      }
    }
  }
  return null;
}

/**
 * Call Claude with KV cache optimization on system prompt.
 *
 * Supports split cache blocks: `stablePrefix` gets cache_control for high hit rate,
 * while `dynamicSuffix` (notes) does NOT get cached so changes don't invalidate the prefix.
 *
 * Retries on 429 (rate limit) and 529 (overloaded) with exponential backoff.
 */
export async function callClaude(params: {
  systemPrompt: string;
  stablePrefix?: string;
  dynamicSuffix?: string;
  userPrompt: string | ContentBlockParam[];
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeResponse> {
  const {
    systemPrompt,
    stablePrefix,
    dynamicSuffix,
    userPrompt,
    model = "sonnet",
    maxTokens = 32768,
    temperature = 0.5,
  } = params;

  // Build system content blocks with split caching
  const systemBlocks = buildSystemBlocks(systemPrompt, stablePrefix, dynamicSuffix);

  let lastError: unknown;
  let authRetried = false;

  // Outer loop: allows one auth-retry (reset client + fresh token) on 401
  for (let authAttempt = 0; authAttempt < 2; authAttempt++) {
    const anthropic = await getClaudeClient();

    for (let attempt = 0; attempt <= CLAUDE_MAX_RETRIES; attempt++) {
      try {
        const stream = anthropic.messages.stream({
          model: MODEL_MAP[model],
          max_tokens: maxTokens,
          temperature,
          system: systemBlocks,
          messages: [{ role: "user", content: userPrompt }],
        });
        const response = await stream.finalMessage();

        const text = response.content
          .filter((block): block is TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");

        const { usage } = response;
        const usageRecord = usage as unknown as Record<string, number | undefined>;

        return {
          text,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usageRecord.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usageRecord.cache_creation_input_tokens ?? 0,
          truncated: response.stop_reason === "max_tokens",
        };
      } catch (error) {
        lastError = error;

        // On 401, reset the client (forces fresh token resolution) and retry once
        if (isAuthError(error) && !authRetried) {
          authRetried = true;
          resetClaudeClient();
          logger.warn("Claude 401 — resetting client and retrying with fresh token");
          break; // break inner loop, outer loop will re-acquire client
        }

        if (!isRetryableError(error) || attempt >= CLAUDE_MAX_RETRIES) {
          // If we've exhausted retries (or error is not retryable) and the model is not haiku, fall back to Gemini Flash
          if (model !== "haiku") {
            logger.warn(`Claude ${model} failed, falling back to Gemini Flash`, {
              error: error instanceof Error ? error.message : String(error),
              attempt: attempt + 1,
              isRetryable: isRetryableError(error),
            });

            try {
              // Construct the prompt for Gemini
              const userText = Array.isArray(userPrompt)
                ? userPrompt
                    .filter(
                      (block): block is { type: "text"; text: string } =>
                        "type" in block && block.type === "text",
                    )
                    .map((b) => b.text)
                    .join("\n")
                : (userPrompt as string);

              // Construct system prompt from parts
              const systemText = [stablePrefix, systemPrompt, dynamicSuffix]
                .filter(Boolean)
                .join("\n\n");

              const geminiText = await generateAgentResponse({
                messages: [{ role: "user", content: userText }],
                systemPrompt: systemText,
              });

              return {
                text: geminiText,
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
                truncated: false,
              };
            } catch (geminiError) {
              logger.error("Gemini fallback also failed", {
                error: geminiError instanceof Error ? geminiError.message : String(geminiError),
                originalError: error,
              });
              throw error;
            }
          }

          throw error;
        }

        const retryAfter = getRetryAfterMs(error);
        const delay = retryAfter ?? CLAUDE_RETRY_DELAYS[attempt] ?? 4000;

        logger.warn(
          `Claude API call failed with retryable error (attempt ${
            attempt + 1
          }), retrying in ${delay}ms`,
          {
            status: (error as APIError).status,
            model,
          },
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If we broke out of inner loop for auth retry, continue outer loop
    if (authRetried && authAttempt === 0) continue;
    break;
  }

  throw lastError;
}

function buildSystemBlocks(
  systemPrompt: string,
  stablePrefix?: string,
  dynamicSuffix?: string,
): Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> {
  // If split blocks are provided, use them for better cache hit rates
  if (stablePrefix) {
    const blocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
      {
        type: "text",
        text: stablePrefix,
        cache_control: { type: "ephemeral" },
      },
    ];
    if (dynamicSuffix) {
      blocks.push({ type: "text", text: dynamicSuffix });
    }
    return blocks;
  }

  // Fallback: single block with cache
  return [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Extract raw code from a Claude response that may contain markdown fences,
 * JSON wrapping, or raw code.
 */
export function extractCodeFromResponse(text: string): string | null {
  // Try to extract from ```tsx or ```jsx fences
  const fenceMatch = text.match(/```(?:tsx|jsx|typescript|javascript)?\n([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  // Try to parse as JSON and extract code field
  try {
    const json = JSON.parse(text);
    if (typeof json.code === "string") return json.code;
  } catch {
    // Not valid JSON
  }

  // Try to find code field in partial/malformed JSON
  const codeMatch = text.match(/"code"\s*:\s*"([\s\S]+)/);
  if (codeMatch?.[1]) {
    let code = codeMatch[1];
    code = code.replace(/"\s*,?\s*"(relatedApps|title|description)"\s*:[\s\S]*$/, "");
    code = code.replace(/"\s*,?\s*}\s*$/, "");
    code = code.replace(/"\s*$/, "");
    try {
      code = JSON.parse(`"${code}"`);
    } catch {
      code = code
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    return code.trim() || null;
  }

  // If response looks like raw code (has import statements + default export)
  if (text.includes("import ") && text.includes("export default")) {
    return text.trim();
  }

  return null;
}

export interface ParsedGeneration {
  title: string;
  description: string;
  code: string;
  relatedApps: string[];
}

/**
 * Parse a markdown-formatted generation response.
 *
 * Expected format:
 *   TITLE: App Name
 *   DESCRIPTION: One sentence
 *   RELATED: path/one, path/two, path/three
 *
 *   ```tsx
 *   // code here
 *   ```
 *
 * Returns null if the response doesn't contain a tsx/jsx fence with `export default`.
 */
export function parseMarkdownResponse(text: string, slug: string): ParsedGeneration | null {
  // Extract code from tsx/jsx fence
  const fenceMatch = text.match(/```(?:tsx|jsx)\n([\s\S]*?)```/);
  if (!fenceMatch?.[1]) return null;

  const code = fenceMatch[1].trim();
  if (!code.includes("export default")) return null;

  // Extract metadata from lines before the fence
  const beforeFence = text.slice(0, fenceMatch.index ?? 0);

  const titleMatch = beforeFence.match(/^TITLE:\s*(.+)$/m);
  const descMatch = beforeFence.match(/^DESCRIPTION:\s*(.+)$/m);
  const relatedMatch = beforeFence.match(/^RELATED:\s*(.+)$/m);

  const title =
    titleMatch?.[1]?.trim() || slug.split("/").pop()?.replace(/-/g, " ") || "Generated App";
  const description = descMatch?.[1]?.trim() || "Generated application";
  const relatedApps = relatedMatch
    ? relatedMatch[1]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return { title, description, code, relatedApps };
}

/**
 * Parse a structured generation response from Claude.
 *
 * Tries formats in order:
 * 1. Markdown sections (TITLE/DESCRIPTION/RELATED + tsx fence) — preferred
 * 2. Clean JSON with { title, description, code, relatedApps }
 * 3. Embedded JSON block within surrounding text
 * 4. extractCodeFromResponse fallback (fences, partial JSON, raw code)
 */
export function parseGenerationResponse(text: string, slug: string): ParsedGeneration | null {
  // 1. Try markdown format first (new preferred format)
  const markdown = parseMarkdownResponse(text, slug);
  if (markdown) return markdown;

  // 2. Try to parse as clean JSON
  try {
    const json = JSON.parse(text);
    if (json.code && json.title) {
      return {
        title: json.title,
        description: json.description || "Generated application",
        code: json.code,
        relatedApps: Array.isArray(json.relatedApps) ? json.relatedApps : [],
      };
    }
  } catch {
    // Not clean JSON
  }

  // 3. Try to find a JSON block within the response
  const jsonMatch = text.match(/\{[\s\S]*"code"\s*:\s*"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      if (json.code) {
        return {
          title: json.title || slug.split("/").pop()?.replace(/-/g, " ") || "Generated App",
          description: json.description || "Generated application",
          code: json.code,
          relatedApps: Array.isArray(json.relatedApps) ? json.relatedApps : [],
        };
      }
    } catch {
      // Fall through
    }
  }

  // 4. Extract just code and synthesize metadata
  const code = extractCodeFromResponse(text);
  if (code) {
    return {
      title: slug.split("/").pop()?.replace(/-/g, " ") || "Generated App",
      description: "Generated application",
      code,
      relatedApps: [],
    };
  }

  return null;
}
