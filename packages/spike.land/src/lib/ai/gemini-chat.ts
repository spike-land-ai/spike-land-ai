import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import { getGeminiClient } from "./gemini-client";
import { getCache } from "@/lib/cache";

export class StructuredResponseParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = "StructuredResponseParseError";
  }
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface GenerateAgentResponseParams {
  messages: ChatMessage[];
  systemPrompt?: string;
}

/**
 * Generates a text response using Gemini for agent chat.
 *
 * @param params - Chat parameters including message history and optional system prompt
 * @returns The generated text response
 * @throws Error if API key is not configured or generation fails
 */
export async function generateAgentResponse(params: GenerateAgentResponseParams): Promise<string> {
  const ai = await getGeminiClient();

  const defaultSystemPrompt = `You are a helpful AI assistant running in a cloud development environment (Box).
You help users with coding, debugging, system administration, and general questions.
Be concise, helpful, and provide practical solutions.`;

  const systemPrompt = params.systemPrompt || defaultSystemPrompt;

  // Convert messages to Gemini format
  const contents = params.messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const { data: response, error } = await tryCatch(
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    }),
  );

  if (error) {
    logger.error("[GEMINI_CHAT] Error generating response:", { error });
    throw new Error(
      `Failed to generate agent response: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  const text = response?.text || "";

  if (!text) {
    throw new Error("No response text received from Gemini");
  }

  return text;
}

// Structured response types and functions

export interface GenerateStructuredResponseParams {
  /** The user prompt to send */
  prompt: string;
  /** Optional system prompt for context */
  systemPrompt?: string;
  /** Maximum output tokens (default: 4096) */
  maxTokens?: number;
  /** Temperature for generation (default: 0.3 for structured output) */
  temperature?: number;
  /** Thinking budget in tokens -- lets the model reason before generating output */
  thinkingBudget?: number;
  /** Optional JSON schema to constrain Gemini's structured output */
  responseJsonSchema?: Record<string, unknown>;
  /** Optional cache key for Redis caching */
  cacheKey?: string;
  /** Optional TTL for Redis cache in seconds (default: 3600 / 1 hour) */
  cacheTtl?: number;
}

/**
 * Generates a structured JSON response using Gemini.
 * Uses responseMimeType: "application/json" for reliable JSON output.
 *
 * @param params - Generation parameters
 * @returns Parsed JSON response of type T
 * @throws Error if API key is not configured, generation fails, or JSON parsing fails
 */
export async function generateStructuredResponse<T>(
  params: GenerateStructuredResponseParams,
): Promise<T> {
  const fetcher = async (): Promise<T> => {
    const ai = await getGeminiClient();

    const { data: response, error } = await tryCatch(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [{ text: params.prompt }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          ...(params.responseJsonSchema && {
            responseJsonSchema: params.responseJsonSchema,
          }),
          ...(params.systemPrompt !== undefined ? { systemInstruction: params.systemPrompt } : {}),
          maxOutputTokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.3,
          ...(params.thinkingBudget != null && {
            thinkingConfig: { thinkingBudget: params.thinkingBudget },
          }),
        },
      }),
    );

    if (error) {
      logger.error("[GEMINI_STRUCTURED] Error generating response:", { error });
      throw new Error(
        `Failed to generate structured response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    const text = response?.text || "";

    if (!text) {
      throw new Error("No response text received from Gemini");
    }

    // Parse JSON response (handle potential markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const { data: parsed, error: parseError } = await tryCatch(
      Promise.resolve().then(() => JSON.parse(jsonText) as T),
    );

    if (parseError) {
      logger.error("[GEMINI_STRUCTURED] Failed to parse JSON response:", {
        response: jsonText.slice(0, 500),
      });
      throw new StructuredResponseParseError(
        `Failed to parse structured response: ${
          parseError instanceof Error ? parseError.message : "Invalid JSON"
        }`,
        jsonText,
      );
    }

    return parsed;
  };

  if (params.cacheKey) {
    const ttl = params.cacheTtl ?? 3600; // Default 1 hour
    return getCache(`gemini_structured:${params.cacheKey}`, ttl, fetcher);
  }

  return fetcher();
}
