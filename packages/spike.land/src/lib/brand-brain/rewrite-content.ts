import { generateStructuredResponse } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import {
  type ContentPlatform,
  type ContentRewriteResponse,
  type DiffHunk,
  type GeminiRewriteResponse,
  geminiRewriteResponseSchema,
  getPlatformLimit,
} from "@/lib/validations/brand-rewrite";
import type { ToneAnalysis } from "@/lib/validations/brand-score";
import type { BrandGuardrail, BrandProfile, BrandVocabulary } from "@/types/brand-brain";
import { diffWords } from "diff";
import { formatGuardrails, formatVocabulary } from "./prompt-formatters";

// ============================================
// Types
// ============================================

export interface RewriteContentParams {
  content: string;
  platform: ContentPlatform;
  brandProfile: BrandProfile;
  guardrails: BrandGuardrail[];
  vocabulary: BrandVocabulary[];
}

export interface RewriteResult {
  rewrittenContent: string;
  changes: DiffHunk[];
  toneAnalysis: ToneAnalysis;
  characterCount: {
    original: number;
    rewritten: number;
    limit: number;
  };
}

// ============================================
// Prompt Building Functions
// ============================================

/**
 * Build the system prompt for brand content rewriting.
 */
function buildBrandRewritingSystemPrompt(params: RewriteContentParams): string {
  const { brandProfile, guardrails, vocabulary, platform } = params;
  const characterLimit = getPlatformLimit(platform);

  // Get tone descriptors with defaults
  const tone = brandProfile.toneDescriptors ?? {
    formalCasual: 50,
    technicalSimple: 50,
    seriousPlayful: 50,
    reservedEnthusiastic: 50,
  };

  return `You are a brand content AI assistant. Your task is to rewrite content to align with brand guidelines while preserving the original meaning.

## Brand Profile: ${brandProfile.name}

### Mission
${brandProfile.mission || "Not specified"}

### Core Values
${brandProfile.values?.join(", ") || "Not specified"}

### Tone Guidelines
The brand voice should fall within these ranges (0-100 scale):
- Formal <-> Casual: Target ${tone.formalCasual ?? 50}
- Technical <-> Simple: Target ${tone.technicalSimple ?? 50}
- Serious <-> Playful: Target ${tone.seriousPlayful ?? 50}
- Reserved <-> Enthusiastic: Target ${tone.reservedEnthusiastic ?? 50}

### Guardrails
${formatGuardrails(guardrails, "rewrite")}

### Vocabulary Rules
${formatVocabulary(vocabulary, "rewrite")}

## Platform Constraint: ${platform}
Maximum character limit: ${characterLimit} characters
The rewritten content MUST NOT exceed this limit.

## Rewriting Guidelines

1. **Preserve Meaning**: Keep the core message and intent intact.
2. **Apply Brand Voice**: Adjust tone to match brand guidelines.
3. **Replace Vocabulary**: Use preferred terms, replace banned words.
4. **Respect Guardrails**: Ensure content follows all guardrails.
5. **Stay Within Limit**: The rewritten content must be <= ${characterLimit} characters.

## Response Format

You MUST respond with a valid JSON object containing:
{
  "rewrittenContent": "<the brand-aligned rewritten content>",
  "changesSummary": ["<brief description of change 1>", "<brief description of change 2>", ...],
  "toneAnalysis": {
    "formalCasual": <detected value 0-100>,
    "technicalSimple": <detected value 0-100>,
    "seriousPlayful": <detected value 0-100>,
    "reservedEnthusiastic": <detected value 0-100>,
    "alignment": <overall alignment with target tone 0-100>
  }
}`;
}

/**
 * Build the user prompt for rewriting.
 */
function buildUserPrompt(content: string, platform: ContentPlatform): string {
  const limit = getPlatformLimit(platform);
  return `Rewrite the following content for ${platform} (max ${limit} chars) to align with brand guidelines:

---
${content}
---

Return the rewritten content as JSON. Ensure the rewritten content is <= ${limit} characters.`;
}

// ============================================
// Diff Computation
// ============================================

/**
 * Compute diff hunks between original and rewritten content.
 */
export function computeDiffHunks(original: string, rewritten: string): DiffHunk[] {
  const diff = diffWords(original, rewritten);

  return diff.map((part, index) => ({
    id: `hunk-${index}`,
    type: part.added ? "added" : part.removed ? "removed" : "unchanged",
    value: part.value,
    selected: true, // All selected by default
  }));
}

// ============================================
// Main Rewriting Function
// ============================================

/**
 * Rewrite content to align with brand guidelines using Gemini AI.
 *
 * @param params - Rewriting parameters including content and brand profile
 * @returns Rewrite result with rewritten content and diff
 * @throws Error if rewriting fails
 */
export async function rewriteContent(params: RewriteContentParams): Promise<RewriteResult> {
  const systemPrompt = buildBrandRewritingSystemPrompt(params);
  const userPrompt = buildUserPrompt(params.content, params.platform);
  const characterLimit = getPlatformLimit(params.platform);

  const { data: rawResponse, error } = await tryCatch(
    generateStructuredResponse<GeminiRewriteResponse>({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 4096,
      temperature: 0.5, // Slightly higher than scoring for creative rewriting
    }),
  );

  if (error) {
    logger.error("[BRAND_REWRITE] Failed to generate rewrite:", { error });
    throw new Error(
      `Failed to rewrite content: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Validate the response structure
  const parseResult = geminiRewriteResponseSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error("[BRAND_REWRITE] Invalid response structure:", {
      issues: parseResult.error.issues,
    });
    throw new Error("Invalid rewrite response structure from AI");
  }

  const validatedResponse = parseResult.data;

  // Ensure content doesn't exceed limit (truncate if needed)
  let rewrittenContent = validatedResponse.rewrittenContent;
  if (rewrittenContent.length > characterLimit) {
    logger.warn(`[BRAND_REWRITE] Content exceeds limit, truncating`, {
      length: rewrittenContent.length,
      limit: characterLimit,
    });
    // Try to truncate at a sentence or word boundary
    rewrittenContent = rewrittenContent.slice(0, characterLimit - 3).trimEnd();
    if (
      !rewrittenContent.endsWith(".") &&
      !rewrittenContent.endsWith("!") &&
      !rewrittenContent.endsWith("?")
    ) {
      rewrittenContent += "...";
    }
  }

  // Compute diff between original and rewritten
  const changes = computeDiffHunks(params.content, rewrittenContent);

  // Transform tone analysis
  const toneAnalysis: ToneAnalysis = {
    formalCasual: Math.round(validatedResponse.toneAnalysis.formalCasual),
    technicalSimple: Math.round(validatedResponse.toneAnalysis.technicalSimple),
    seriousPlayful: Math.round(validatedResponse.toneAnalysis.seriousPlayful),
    reservedEnthusiastic: Math.round(validatedResponse.toneAnalysis.reservedEnthusiastic),
    alignment: Math.round(validatedResponse.toneAnalysis.alignment),
  };

  return {
    rewrittenContent,
    changes,
    toneAnalysis,
    characterCount: {
      original: params.content.length,
      rewritten: rewrittenContent.length,
      limit: characterLimit,
    },
  };
}

/**
 * Transform rewrite result to API response format.
 */
export function transformRewriteResult(
  id: string,
  original: string,
  result: RewriteResult,
  platform: ContentPlatform,
  cached: boolean,
  cachedAt?: Date,
): ContentRewriteResponse {
  return {
    id,
    original,
    rewritten: result.rewrittenContent,
    platform,
    changes: result.changes,
    characterCount: result.characterCount,
    toneAnalysis: result.toneAnalysis,
    cached,
    cachedAt: cachedAt?.toISOString(),
  };
}

// ============================================
// Exports for testing
// ============================================

export { buildBrandRewritingSystemPrompt as _buildBrandRewritingSystemPrompt };
export { formatGuardrails as _formatGuardrails } from "./prompt-formatters";
export { formatVocabulary as _formatVocabulary } from "./prompt-formatters";
