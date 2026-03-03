import { z } from "zod";

export const SKILL_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_NAME_LENGTH: 100,
  MAX_DISPLAY_NAME_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_LONG_DESCRIPTION_LENGTH: 10000,
} as const;

const SkillCategoryEnum = z.enum([
  "QUALITY",
  "TESTING",
  "WORKFLOW",
  "SECURITY",
  "PERFORMANCE",
  "OTHER",
]);

const SkillStatusEnum = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

function sanitizeText(text: string): string {
  let prev;
  do {
    prev = text;
    text = text.replace(/<[^>]*>/g, "");
  } while (text !== prev);
  return text.trim();
}

const idSchema = z.string().min(1).max(50);

export const createSkillSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(SKILL_CONSTANTS.MAX_NAME_LENGTH)
    .regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with hyphens")
    .transform(sanitizeText),
  slug: z.string()
    .min(1, "Slug is required")
    .max(SKILL_CONSTANTS.MAX_NAME_LENGTH)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .transform(sanitizeText),
  displayName: z.string()
    .min(1, "Display name is required")
    .max(SKILL_CONSTANTS.MAX_DISPLAY_NAME_LENGTH)
    .transform(sanitizeText),
  description: z.string()
    .min(1, "Description is required")
    .max(SKILL_CONSTANTS.MAX_DESCRIPTION_LENGTH)
    .transform(sanitizeText),
  longDescription: z.string()
    .max(SKILL_CONSTANTS.MAX_LONG_DESCRIPTION_LENGTH)
    .optional()
    .nullable(),
  category: SkillCategoryEnum.default("OTHER"),
  status: SkillStatusEnum.default("DRAFT"),
  version: z.string().max(20).default("1.0.0"),
  author: z.string().min(1).max(200).transform(sanitizeText),
  authorUrl: z.string().url().optional().nullable(),
  repoUrl: z.string().url().optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateSkillSchema = z.object({
  id: idSchema,
  name: z.string()
    .min(1)
    .max(SKILL_CONSTANTS.MAX_NAME_LENGTH)
    .regex(/^[a-z0-9-]+$/)
    .transform(sanitizeText)
    .optional(),
  slug: z.string()
    .min(1)
    .max(SKILL_CONSTANTS.MAX_NAME_LENGTH)
    .regex(/^[a-z0-9-]+$/)
    .transform(sanitizeText)
    .optional(),
  displayName: z.string()
    .min(1)
    .max(SKILL_CONSTANTS.MAX_DISPLAY_NAME_LENGTH)
    .transform(sanitizeText)
    .optional(),
  description: z.string()
    .min(1)
    .max(SKILL_CONSTANTS.MAX_DESCRIPTION_LENGTH)
    .transform(sanitizeText)
    .optional(),
  longDescription: z.string()
    .max(SKILL_CONSTANTS.MAX_LONG_DESCRIPTION_LENGTH)
    .optional()
    .nullable(),
  category: SkillCategoryEnum.optional(),
  status: SkillStatusEnum.optional(),
  version: z.string().max(20).optional(),
  author: z.string().min(1).max(200).transform(sanitizeText).optional(),
  authorUrl: z.string().url().optional().nullable(),
  repoUrl: z.string().url().optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const skillQuerySchema = z.object({
  category: SkillCategoryEnum.optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(SKILL_CONSTANTS.MAX_PAGE_SIZE)
    .default(SKILL_CONSTANTS.DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export const installSkillSchema = z.object({
  skillId: idSchema,
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type SkillQueryInput = z.infer<typeof skillQuerySchema>;
