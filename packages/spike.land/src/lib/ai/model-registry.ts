/**
 * AI Model Registry
 *
 * Static registry of all supported AI models with capabilities,
 * aliases, and provider mapping. Used by the ai-gateway MCP tools
 * for provider-agnostic routing.
 */

export interface AIModelInfo {
  id: string;
  displayName: string;
  provider: "anthropic" | "google";
  aliases: string[];
  capabilities: ("chat" | "vision" | "image-gen" | "structured")[];
  maxOutputTokens: number;
}

export const MODEL_REGISTRY: AIModelInfo[] = [
  // Anthropic
  {
    id: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    aliases: ["opus"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 32768,
  },
  {
    id: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    aliases: ["sonnet"],
    capabilities: ["chat", "vision"],
    maxOutputTokens: 16384,
  },
  {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    aliases: ["haiku"],
    capabilities: ["chat"],
    maxOutputTokens: 8192,
  },
  // Google
  {
    id: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash",
    provider: "google",
    aliases: ["flash", "gemini-flash"],
    capabilities: ["chat", "vision", "image-gen", "structured"],
    maxOutputTokens: 8192,
  },
  {
    id: "gemini-3-pro-image-preview",
    displayName: "Gemini 3 Pro Image",
    provider: "google",
    aliases: ["gemini-pro"],
    capabilities: ["chat", "vision", "image-gen", "structured"],
    maxOutputTokens: 8192,
  },
  {
    id: "gemini-2.5-flash-image",
    displayName: "Gemini 2.5 Flash Image",
    provider: "google",
    aliases: ["gemini-nano"],
    capabilities: ["vision", "image-gen", "structured"],
    maxOutputTokens: 2048,
  },
];

/**
 * Resolve a model by ID or alias.
 */
export function resolveModel(input: string): AIModelInfo | undefined {
  const lower = input.toLowerCase();
  return MODEL_REGISTRY.find(
    (m) => m.id.toLowerCase() === lower || m.aliases.some((a) => a.toLowerCase() === lower),
  );
}

/**
 * Determine the provider from a model name or explicit provider string.
 * Falls back to "anthropic" as the default provider.
 */
export function resolveProvider(model?: string, provider?: string): "anthropic" | "google" {
  if (provider === "anthropic" || provider === "google") return provider;
  if (model) {
    const resolved = resolveModel(model);
    if (resolved) return resolved.provider;
    // Heuristic: model names starting with "gemini" are Google
    if (model.toLowerCase().startsWith("gemini")) return "google";
    if (model.toLowerCase().startsWith("claude")) return "anthropic";
  }
  return "anthropic";
}

/**
 * Get all models for a given provider.
 */
export function getModelsForProvider(provider: string): AIModelInfo[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

/**
 * Get all models that have a given capability.
 */
export function getModelsByCapability(cap: string): AIModelInfo[] {
  return MODEL_REGISTRY.filter((m) =>
    m.capabilities.includes(cap as AIModelInfo["capabilities"][number]),
  );
}
