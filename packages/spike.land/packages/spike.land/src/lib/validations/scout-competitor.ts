/**
 * Scout Competitor Validation Schemas
 *
 * Zod schemas for validating competitor tracking API requests.
 * Resolves #871
 */

import { z } from "zod";

// ============================================
// Social Handle Validation
// ============================================

/**
 * Validates a social media handle/username.
 * Handles can be alphanumeric with underscores and periods.
 * Twitter: @username (1-15 chars, alphanumeric + underscore)
 * LinkedIn: /in/username or company URL
 * Instagram: username (1-30 chars)
 * Facebook: username or page ID
 */
export const socialHandleSchema = z
  .string()
  .max(100, "Handle is too long")
  .transform(val => val.trim().replace(/^@/, "")) // Remove leading @ if present
  .refine(val => val.length > 0, { message: "Handle must not be empty" });

/**
 * Social handles object for a competitor.
 * At least one handle must be provided.
 */
export const socialHandlesSchema = z
  .object({
    twitter: socialHandleSchema.optional(),
    linkedin: socialHandleSchema.optional(),
    instagram: socialHandleSchema.optional(),
    facebook: socialHandleSchema.optional(),
  })
  .refine(
    handles =>
      handles.twitter
      || handles.linkedin
      || handles.instagram
      || handles.facebook,
    {
      message: "At least one social handle must be provided",
    },
  );

export type SocialHandles = z.infer<typeof socialHandlesSchema>;

// ============================================
// Website URL Validation
// ============================================

export const websiteUrlSchema = z
  .string()
  .url("Invalid website URL")
  .max(2000, "URL is too long")
  .optional()
  .transform(val => val?.trim());

// ============================================
// Competitor Name Validation
// ============================================

export const competitorNameSchema = z
  .string()
  .max(200, "Name is too long")
  .transform(val => val.trim())
  .refine(val => val.length > 0, { message: "Name must not be empty" });

// ============================================
// Create Competitor Request Schema
// ============================================

export const createCompetitorRequestSchema = z.object({
  name: competitorNameSchema,
  website: websiteUrlSchema,
  socialHandles: socialHandlesSchema,
});

export type CreateCompetitorRequest = z.infer<
  typeof createCompetitorRequestSchema
>;

// ============================================
// Update Competitor Request Schema
// ============================================

// Schema for updating individual competitor fields (name, isActive only)
// Does not support updating platform/handle as those are identity fields
export const updateCompetitorRequestSchema = z.object({
  name: z
    .string()
    .max(200, "Name is too long")
    .transform(val => val.trim())
    .refine(val => val.length > 0, { message: "Name must not be empty" })
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCompetitorRequest = z.infer<
  typeof updateCompetitorRequestSchema
>;

// ============================================
// Legacy Single-Handle Request Schema
// (For backwards compatibility with existing API)
// ============================================

export const legacyAddCompetitorRequestSchema = z.object({
  platform: z.enum([
    "TWITTER",
    "LINKEDIN",
    "FACEBOOK",
    "INSTAGRAM",
    "TIKTOK",
    "YOUTUBE",
    "DISCORD",
  ]),
  handle: socialHandleSchema,
});

export type LegacyAddCompetitorRequest = z.infer<
  typeof legacyAddCompetitorRequestSchema
>;
