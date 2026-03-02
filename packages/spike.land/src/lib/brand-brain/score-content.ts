import { generateStructuredResponse } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import {
  type ContentScoreResponse,
  type ContentType,
  type GeminiScoreResponse,
  geminiScoreResponseSchema,
  transformGeminiResponse,
} from "@/lib/validations/brand-score";
import type { BrandGuardrail, BrandProfile, BrandVocabulary } from "@/types/brand-brain";
import { formatGuardrails, formatVocabulary } from "./prompt-formatters";

// ============================================
// Types
// ============================================

export interface ScoreContentParams {
  content: string;
  contentType: ContentType;
  strictMode: boolean;
  brandProfile: BrandProfile;
  guardrails: BrandGuardrail[];
  vocabulary: BrandVocabulary[];
}

// ============================================
// Prompt Building Functions
// ============================================

/**
 * Build the system prompt for brand scoring.
 */
function buildBrandScoringSystemPrompt(params: ScoreContentParams): string {
  const { brandProfile, guardrails, vocabulary } = params;

  // Get tone descriptors with defaults
  const tone = brandProfile.toneDescriptors ?? {
    formalCasual: 50,
    technicalSimple: 50,
    seriousPlayful: 50,
    reservedEnthusiastic: 50,
  };

  return `You are a brand compliance AI assistant. Your task is to analyze content and score it against the brand guidelines.

## Brand Profile: ${brandProfile.name}

### Mission
${brandProfile.mission || "Not specified"}

### Core Values
${brandProfile.values?.join(", ") || "Not specified"}

### Tone Guidelines
The brand voice should fall within these ranges (0-100 scale):
- Formal ←→ Casual: Target ${tone.formalCasual ?? 50}
- Technical ←→ Simple: Target ${tone.technicalSimple ?? 50}
- Serious ←→ Playful: Target ${tone.seriousPlayful ?? 50}
- Reserved ←→ Enthusiastic: Target ${tone.reservedEnthusiastic ?? 50}

### Guardrails
${formatGuardrails(guardrails, "score")}

### Vocabulary Rules
${formatVocabulary(vocabulary, "score")}

## Scoring Guidelines

Score content 0-100 based on:
1. **Tone Alignment (40%)**: How well does the content match the target tone?
2. **Vocabulary Compliance (30%)**: Does it use preferred terms and avoid banned words?
3. **Guardrail Adherence (20%)**: Does it respect prohibited topics and include required disclosures?
4. **Style Consistency (10%)**: Does it match the overall brand style?

For violations, provide:
- Specific location (line number or word index when possible)
- An excerpt of the problematic text (max 100 chars)
- A concrete suggestion for improvement

Be thorough but fair. Minor style variations should result in small deductions, while guardrail violations should result in significant score reductions based on severity.

## Response Format

You MUST respond with a valid JSON object containing:
{
  "score": <number 0-100>,
  "violations": [
    {
      "type": "BANNED_WORD" | "TONE_MISMATCH" | "GUARDRAIL_VIOLATION" | "MISSING_DISCLOSURE" | "STYLE_DEVIATION",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "message": "<description of the issue>",
      "lineNumber": <optional line number>,
      "wordIndex": <optional word index>,
      "excerpt": "<optional excerpt of problematic text>",
      "suggestion": "<optional suggestion for fix>"
    }
  ],
  "suggestions": [
    {
      "category": "TONE" | "VOCABULARY" | "GUARDRAILS" | "STYLE",
      "recommendation": "<actionable recommendation>",
      "priority": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "toneAnalysis": {
    "formalCasual": <detected value 0-100>,
    "technicalSimple": <detected value 0-100>,
    "seriousPlayful": <detected value 0-100>,
    "reservedEnthusiastic": <detected value 0-100>,
    "alignment": <overall tone alignment 0-100>
  }
}`;
}

/**
 * Build the user prompt for scoring.
 */
function buildUserPrompt(content: string, contentType: ContentType): string {
  return `Analyze the following ${contentType.replace("_", " ")} for brand compliance:

---
${content}
---

Score this content against the brand guidelines and return your analysis as JSON.`;
}

// ============================================
// Main Scoring Function
// ============================================

/**
 * Score content against brand guidelines using Gemini AI.
 *
 * @param params - Scoring parameters including content and brand profile
 * @returns Content score response
 * @throws Error if scoring fails
 */
export async function scoreContent(params: ScoreContentParams): Promise<ContentScoreResponse> {
  const systemPrompt = buildBrandScoringSystemPrompt(params);
  const userPrompt = buildUserPrompt(params.content, params.contentType);

  const { data: rawResponse, error } = await tryCatch(
    generateStructuredResponse<GeminiScoreResponse>({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 4096,
      temperature: 0.3, // Low temperature for consistent scoring
    }),
  );

  if (error) {
    logger.error("[BRAND_SCORE] Failed to generate score:", { error });
    throw new Error(
      `Failed to score content: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Validate the response structure
  const parseResult = geminiScoreResponseSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error("[BRAND_SCORE] Invalid response structure:", {
      issues: parseResult.error.issues,
    });
    throw new Error("Invalid score response structure from AI");
  }

  const validatedResponse = parseResult.data;

  // Apply strict mode: any violation = 0 score
  if (params.strictMode && validatedResponse.violations.length > 0) {
    validatedResponse.score = 0;
  }

  // Transform to API response format
  return transformGeminiResponse(validatedResponse, false);
}

// ============================================
// Exports for testing
// ============================================

export { buildBrandScoringSystemPrompt as _buildBrandScoringSystemPrompt };
export { formatGuardrails as _formatGuardrails } from "./prompt-formatters";
export { formatVocabulary as _formatVocabulary } from "./prompt-formatters";
