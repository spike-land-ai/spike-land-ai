/**
 * Gemini client initialization and barrel re-exports.
 *
 * All consumers should continue importing from this file.
 * Internal implementation is split across focused modules:
 * - gemini-models.ts    — Model config, tier mapping, timeouts
 * - gemini-analysis.ts  — Vision analysis (defects, cropping, V2)
 * - gemini-prompts.ts   — Enhancement & blend prompt builders
 * - gemini-stream.ts    — Unified stream processor with timeout
 * - gemini-generation.ts — Image enhance/generate/modify
 * - gemini-asset-library.ts — Asset library analysis
 * - gemini-chat.ts      — Chat & structured JSON responses
 */

import { GoogleGenAI } from "@google/genai";
import { resolveAIProviderConfig } from "./ai-config-resolver";

// ── Client singleton ─────────────────────────────────────────────────

let genAI: GoogleGenAI | null = null;

export async function getGeminiClient(): Promise<GoogleGenAI> {
  if (!genAI) {
    const config = await resolveAIProviderConfig("google");
    const apiKey = config?.token ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set and no google provider configured in DB",
      );
    }
    genAI = new GoogleGenAI({
      apiKey,
    });
  }
  return genAI;
}

/**
 * Resets the Gemini client instance. Used for testing purposes.
 * @internal
 */
export function resetGeminiClient(): void {
  genAI = null;
}

export async function isGeminiConfigured(): Promise<boolean> {
  const config = await resolveAIProviderConfig("google");
  return !!(config?.token || process.env.GEMINI_API_KEY);
}

// ── Re-exports ───────────────────────────────────────────────────────

export {
  ANALYSIS_TIMEOUT_MS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  GEMINI_TIMEOUT_MS,
  getModelForTier,
  supportsImageSize,
  VALID_GEMINI_MODELS,
} from "./gemini-models";

export type {
  AnalysisDetailedResult,
  CropDimensions,
  CropRegionPixels,
  ImageAnalysisResultV2,
} from "./gemini-analysis";
export {
  analyzeImage,
  analyzeImageV2,
  analyzeImageWithGemini,
  getDefaultAnalysis,
} from "./gemini-analysis";

export {
  buildBlendEnhancementPrompt,
  buildDynamicEnhancementPrompt,
} from "./gemini-prompts";

export { processGeminiStream } from "./gemini-stream";

export type {
  EnhanceImageParams,
  GenerateImageParams,
  ModifyImageParams,
  ReferenceImageData,
} from "./gemini-generation";
export {
  enhanceImageWithGemini,
  generateImageWithGemini,
  modifyImageWithGemini,
} from "./gemini-generation";

export type { AssetAnalysisResult } from "./gemini-asset-library";
export { analyzeAssetForLibrary } from "./gemini-asset-library";

export {
  generateAgentResponse,
  generateStructuredResponse,
  StructuredResponseParseError,
} from "./gemini-chat";
export type {
  ChatMessage,
  GenerateAgentResponseParams,
  GenerateStructuredResponseParams,
} from "./gemini-chat";

export { cosineSimilarity, embedText } from "./gemini-embeddings";
