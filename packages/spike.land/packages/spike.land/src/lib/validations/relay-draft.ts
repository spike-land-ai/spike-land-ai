/**
 * Relay Draft Validation Schemas
 *
 * Zod schemas for validating AI-generated drafts and API requests.
 * Resolves #555
 */

import { z } from "zod";

// ============================================
// Tone Match Schema
// ============================================

export const toneMatchSchema = z.object({
  alignment: z.number().min(0).max(100),
  formalCasual: z.number().min(0).max(100),
  technicalSimple: z.number().min(0).max(100),
  seriousPlayful: z.number().min(0).max(100),
  reservedEnthusiastic: z.number().min(0).max(100),
});

// ============================================
// Draft Schema (from AI)
// ============================================

export const draftItemSchema = z.object({
  content: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  isPreferred: z.boolean(),
  reason: z.string(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  toneMatch: toneMatchSchema,
});

// ============================================
// Message Analysis Schema
// ============================================

export const messageIntentSchema = z.enum([
  "question",
  "feedback",
  "complaint",
  "praise",
  "request",
  "general",
  "support",
  "sales",
]);

export const messageAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  intent: messageIntentSchema,
  topics: z.array(z.string()),
  urgency: z.enum(["low", "medium", "high"]),
  hasQuestion: z.boolean(),
  hasComplaint: z.boolean(),
  needsEscalation: z.boolean(),
});

// ============================================
// Gemini Response Schema
// ============================================

export const geminiDraftResponseSchema = z.object({
  drafts: z.array(draftItemSchema).min(1).max(5),
  messageAnalysis: messageAnalysisSchema,
});

export type GeminiDraftResponseValidated = z.infer<
  typeof geminiDraftResponseSchema
>;

// ============================================
// API Request Schemas
// ============================================

export const generateDraftsRequestSchema = z.object({
  inboxItemId: z.string().min(1),
  numDrafts: z.number().int().min(1).max(5).optional().default(3),
  customInstructions: z.string().max(500).optional(),
});

export type GenerateDraftsRequestInput = z.input<
  typeof generateDraftsRequestSchema
>;

export const saveDraftRequestSchema = z.object({
  inboxItemId: z.string().min(1),
  content: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  isPreferred: z.boolean(),
  reason: z.string(),
  metadata: z
    .object({
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      toneMatch: toneMatchSchema,
      withinCharacterLimit: z.boolean(),
      characterCount: z.number().int().min(0),
      platformLimit: z.number().int().min(0),
    })
    .optional(),
});

export type SaveDraftRequestInput = z.input<typeof saveDraftRequestSchema>;

export const approveDraftRequestSchema = z.object({
  draftId: z.string().min(1),
});

export const sendDraftRequestSchema = z.object({
  draftId: z.string().min(1),
});

export const regenerateDraftsRequestSchema = z.object({
  inboxItemId: z.string().min(1),
  feedback: z.string().max(500).optional(),
  numDrafts: z.number().int().min(1).max(5).optional().default(3),
});

export type RegenerateDraftsRequestInput = z.input<
  typeof regenerateDraftsRequestSchema
>;
