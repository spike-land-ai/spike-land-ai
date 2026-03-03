import { z } from "zod";

// ============================================
// Constants
// ============================================

export const CONTENT_TYPES = [
  "social_post",
  "blog_article",
  "email",
  "marketing_copy",
  "general",
] as const;

export const VIOLATION_TYPES = [
  "BANNED_WORD",
  "TONE_MISMATCH",
  "GUARDRAIL_VIOLATION",
  "MISSING_DISCLOSURE",
  "STYLE_DEVIATION",
] as const;

export const VIOLATION_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const OVERALL_ASSESSMENTS = [
  "EXCELLENT", // 90-100
  "GOOD", // 70-89
  "NEEDS_WORK", // 50-69
  "POOR", // 25-49
  "OFF_BRAND", // 0-24
] as const;

export const SUGGESTION_CATEGORIES = [
  "TONE",
  "VOCABULARY",
  "GUARDRAILS",
  "STYLE",
] as const;

export const SUGGESTION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

// ============================================
// Request Schemas
// ============================================

export const contentScoreRequestSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content must be less than 50,000 characters"),
  contentType: z.enum(CONTENT_TYPES).optional().default("general"),
  strictMode: z.boolean().optional().default(false),
});

// ============================================
// Response Schemas
// ============================================

export const violationLocationSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  wordIndex: z.number().int().nonnegative().optional(),
  excerpt: z.string().max(200).optional(),
});

export const contentViolationSchema = z.object({
  type: z.enum(VIOLATION_TYPES),
  severity: z.enum(VIOLATION_SEVERITIES),
  message: z.string().min(1).max(500),
  location: violationLocationSchema.optional(),
  suggestion: z.string().max(500).optional(),
});

export const suggestionSchema = z.object({
  category: z.enum(SUGGESTION_CATEGORIES),
  recommendation: z.string().min(1).max(500),
  priority: z.enum(SUGGESTION_PRIORITIES),
});

export const toneAnalysisSchema = z.object({
  formalCasual: z.number().min(0).max(100),
  technicalSimple: z.number().min(0).max(100),
  seriousPlayful: z.number().min(0).max(100),
  reservedEnthusiastic: z.number().min(0).max(100),
  alignment: z.number().min(0).max(100),
});

export const contentScoreResponseSchema = z.object({
  score: z.number().min(0).max(100),
  overallAssessment: z.enum(OVERALL_ASSESSMENTS),
  violations: z.array(contentViolationSchema),
  suggestions: z.array(suggestionSchema),
  toneAnalysis: toneAnalysisSchema,
  cached: z.boolean(),
  cachedAt: z.string().datetime().optional(),
});

// ============================================
// Gemini Response Schema (raw LLM output)
// ============================================

export const geminiScoreResponseSchema = z.object({
  score: z.number().min(0).max(100),
  violations: z.array(
    z.object({
      type: z.enum(VIOLATION_TYPES),
      severity: z.enum(VIOLATION_SEVERITIES),
      message: z.string(),
      lineNumber: z.number().optional(),
      wordIndex: z.number().optional(),
      excerpt: z.string().optional(),
      suggestion: z.string().optional(),
    }),
  ),
  suggestions: z.array(
    z.object({
      category: z.enum(SUGGESTION_CATEGORIES),
      recommendation: z.string(),
      priority: z.enum(SUGGESTION_PRIORITIES),
    }),
  ),
  toneAnalysis: z.object({
    formalCasual: z.number(),
    technicalSimple: z.number(),
    seriousPlayful: z.number(),
    reservedEnthusiastic: z.number(),
    alignment: z.number(),
  }),
});

// ============================================
// Type Exports
// ============================================

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ViolationType = (typeof VIOLATION_TYPES)[number];
export type ViolationSeverity = (typeof VIOLATION_SEVERITIES)[number];
export type OverallAssessment = (typeof OVERALL_ASSESSMENTS)[number];
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number];

export type ContentScoreRequest = z.infer<typeof contentScoreRequestSchema>;
export type ViolationLocation = z.infer<typeof violationLocationSchema>;
export type ContentViolation = z.infer<typeof contentViolationSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type ToneAnalysis = z.infer<typeof toneAnalysisSchema>;
export type ContentScoreResponse = z.infer<typeof contentScoreResponseSchema>;
export type GeminiScoreResponse = z.infer<typeof geminiScoreResponseSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Convert numeric score to overall assessment category
 */
export function getOverallAssessment(score: number): OverallAssessment {
  if (score >= 90) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "NEEDS_WORK";
  if (score >= 25) return "POOR";
  return "OFF_BRAND";
}

/**
 * Transform Gemini raw response to API response format
 */
export function transformGeminiResponse(
  geminiResponse: GeminiScoreResponse,
  cached: boolean,
  cachedAt?: Date,
): ContentScoreResponse {
  return {
    score: geminiResponse.score,
    overallAssessment: getOverallAssessment(geminiResponse.score),
    violations: geminiResponse.violations.map(v => ({
      type: v.type,
      severity: v.severity,
      message: v.message,
      location: v.lineNumber || v.wordIndex || v.excerpt
        ? {
          lineNumber: v.lineNumber,
          wordIndex: v.wordIndex,
          excerpt: v.excerpt,
        }
        : undefined,
      suggestion: v.suggestion,
    })),
    suggestions: geminiResponse.suggestions,
    toneAnalysis: {
      formalCasual: Math.round(geminiResponse.toneAnalysis.formalCasual),
      technicalSimple: Math.round(geminiResponse.toneAnalysis.technicalSimple),
      seriousPlayful: Math.round(geminiResponse.toneAnalysis.seriousPlayful),
      reservedEnthusiastic: Math.round(
        geminiResponse.toneAnalysis.reservedEnthusiastic,
      ),
      alignment: Math.round(geminiResponse.toneAnalysis.alignment),
    },
    cached,
    cachedAt: cachedAt?.toISOString(),
  };
}
