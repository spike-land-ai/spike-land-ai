import { z } from "zod";
import { toneAnalysisSchema } from "./brand-score";

// ============================================
// Constants
// ============================================

export const CONTENT_PLATFORMS = [
  "TWITTER",
  "LINKEDIN",
  "INSTAGRAM",
  "FACEBOOK",
  "GENERAL",
] as const;

/**
 * Character limits for each social media platform
 */
export const PLATFORM_LIMITS: Record<ContentPlatform, number> = {
  TWITTER: 280,
  LINKEDIN: 3000,
  INSTAGRAM: 2200,
  FACEBOOK: 63206,
  GENERAL: 50000,
} as const;

export const REWRITE_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export const DIFF_HUNK_TYPES = ["added", "removed", "unchanged"] as const;

// ============================================
// Request Schemas
// ============================================

export const contentRewriteRequestSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content must be less than 50,000 characters"),
  platform: z.enum(CONTENT_PLATFORMS).optional().default("GENERAL"),
});

// ============================================
// Diff Hunk Schema
// ============================================

export const diffHunkSchema = z.object({
  id: z.string(),
  type: z.enum(DIFF_HUNK_TYPES),
  value: z.string(),
  lineNumber: z.number().int().nonnegative().optional(),
  selected: z.boolean().default(true),
});

// ============================================
// Response Schemas
// ============================================

export const characterCountSchema = z.object({
  original: z.number().int().nonnegative(),
  rewritten: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const contentRewriteResponseSchema = z.object({
  id: z.string(),
  original: z.string(),
  rewritten: z.string(),
  platform: z.enum(CONTENT_PLATFORMS),
  changes: z.array(diffHunkSchema),
  characterCount: characterCountSchema,
  toneAnalysis: toneAnalysisSchema,
  cached: z.boolean(),
  cachedAt: z.string().datetime().optional(),
});

// ============================================
// Gemini Response Schema (raw LLM output)
// ============================================

export const geminiRewriteResponseSchema = z.object({
  rewrittenContent: z.string(),
  changesSummary: z.array(z.string()).optional(),
  toneAnalysis: z.object({
    formalCasual: z.number(),
    technicalSimple: z.number(),
    seriousPlayful: z.number(),
    reservedEnthusiastic: z.number(),
    alignment: z.number(),
  }),
});

// ============================================
// History Response Schema
// ============================================

export const rewriteHistoryItemSchema = z.object({
  id: z.string(),
  originalContent: z.string(),
  rewrittenContent: z.string().nullable(),
  platform: z.enum(CONTENT_PLATFORMS),
  status: z.enum(REWRITE_STATUSES),
  characterLimit: z.number().nullable(),
  createdAt: z.string().datetime(),
});

export const rewriteHistoryResponseSchema = z.object({
  items: z.array(rewriteHistoryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

// ============================================
// Apply Selected Changes Schema
// ============================================

export const applySelectedChangesRequestSchema = z.object({
  original: z.string(),
  hunks: z.array(diffHunkSchema),
});

// ============================================
// Type Exports
// ============================================

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
export type RewriteStatus = (typeof REWRITE_STATUSES)[number];
export type DiffHunkType = (typeof DIFF_HUNK_TYPES)[number];

export type ContentRewriteRequest = z.infer<typeof contentRewriteRequestSchema>;
export type DiffHunk = z.infer<typeof diffHunkSchema>;
export type CharacterCount = z.infer<typeof characterCountSchema>;
export type ContentRewriteResponse = z.infer<
  typeof contentRewriteResponseSchema
>;
export type GeminiRewriteResponse = z.infer<typeof geminiRewriteResponseSchema>;
export type RewriteHistoryItem = z.infer<typeof rewriteHistoryItemSchema>;
export type RewriteHistoryResponse = z.infer<
  typeof rewriteHistoryResponseSchema
>;
export type ApplySelectedChangesRequest = z.infer<
  typeof applySelectedChangesRequestSchema
>;

// ============================================
// Helper Functions
// ============================================

/**
 * Get the character limit for a platform
 */
export function getPlatformLimit(platform: ContentPlatform): number {
  return PLATFORM_LIMITS[platform];
}

/**
 * Check if content exceeds platform limit
 */
export function exceedsPlatformLimit(
  content: string,
  platform: ContentPlatform,
): boolean {
  return content.length > PLATFORM_LIMITS[platform];
}

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: ContentPlatform): string {
  const names: Record<ContentPlatform, string> = {
    TWITTER: "Twitter / X",
    LINKEDIN: "LinkedIn",
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    GENERAL: "General",
  };
  return names[platform];
}
