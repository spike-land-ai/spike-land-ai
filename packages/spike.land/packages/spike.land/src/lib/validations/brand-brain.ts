import { z } from "zod";

// ============================================
// Constants
// ============================================

export const VOICE_DIMENSIONS = [
  "formalCasual",
  "technicalSimple",
  "seriousPlayful",
  "reservedEnthusiastic",
] as const;

export const VOICE_DIMENSION_LABELS: Record<
  (typeof VOICE_DIMENSIONS)[number],
  { left: string; right: string; }
> = {
  formalCasual: { left: "Formal", right: "Casual" },
  technicalSimple: { left: "Technical", right: "Simple" },
  seriousPlayful: { left: "Serious", right: "Playful" },
  reservedEnthusiastic: { left: "Reserved", right: "Enthusiastic" },
};

export const GUARDRAIL_TYPES = [
  "PROHIBITED_TOPIC",
  "REQUIRED_DISCLOSURE",
  "CONTENT_WARNING",
] as const;

export const GUARDRAIL_TYPE_LABELS: Record<
  (typeof GUARDRAIL_TYPES)[number],
  string
> = {
  PROHIBITED_TOPIC: "Prohibited Topic",
  REQUIRED_DISCLOSURE: "Required Disclosure",
  CONTENT_WARNING: "Content Warning",
};

export const GUARDRAIL_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const VOCABULARY_TYPES = ["PREFERRED", "BANNED", "REPLACEMENT"] as const;

export const VOCABULARY_TYPE_LABELS: Record<
  (typeof VOCABULARY_TYPES)[number],
  string
> = {
  PREFERRED: "Preferred Term",
  BANNED: "Banned Term",
  REPLACEMENT: "Replacement",
};

export const COLOR_USAGES = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
] as const;

// ============================================
// Base Schemas
// ============================================

export const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Must be a valid hex color (e.g., #FF5733)",
  });

export const colorPaletteItemSchema = z.object({
  name: z.string().min(1, "Color name is required").max(
    30,
    "Color name too long",
  ),
  hex: hexColorSchema,
  usage: z.enum(COLOR_USAGES).optional(),
});

export const guardrailSchema = z.object({
  id: z.string().optional(),
  type: z.enum(GUARDRAIL_TYPES),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  severity: z.enum(GUARDRAIL_SEVERITIES).optional(),
  ruleConfig: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const vocabularyItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(VOCABULARY_TYPES),
  term: z.string().min(1, "Term is required").max(100),
  replacement: z.string().max(100).optional(),
  context: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const toneDescriptorsSchema = z.object({
  formalCasual: z.number().min(0).max(100),
  technicalSimple: z.number().min(0).max(100),
  seriousPlayful: z.number().min(0).max(100),
  reservedEnthusiastic: z.number().min(0).max(100),
});

// ============================================
// Step Schemas (for progressive validation)
// ============================================

export const brandBasicsSchema = z.object({
  name: z
    .string()
    .min(2, "Brand name must be at least 2 characters")
    .max(100, "Brand name must be less than 100 characters"),
  mission: z.string().max(1000, "Mission must be less than 1000 characters")
    .optional(),
  values: z
    .array(
      z.string().min(1).max(50, "Each value must be less than 50 characters"),
    )
    .max(10, "Maximum 10 values allowed")
    .optional(),
});

export const voiceToneSchema = z.object({
  toneDescriptors: toneDescriptorsSchema,
});

export const visualIdentitySchema = z.object({
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoR2Key: z.string().optional(),
  colorPalette: z
    .array(colorPaletteItemSchema)
    .max(10, "Maximum 10 colors allowed")
    .optional(),
});

export const guardrailsStepSchema = z.object({
  guardrails: z.array(guardrailSchema).optional(),
  vocabulary: z.array(vocabularyItemSchema).optional(),
});

// ============================================
// Complete Brand Profile Schema
// ============================================

export const brandProfileSchema = brandBasicsSchema
  .merge(voiceToneSchema)
  .merge(visualIdentitySchema)
  .merge(guardrailsStepSchema);

// ============================================
// API Request Schemas
// ============================================

export const createBrandProfileSchema = brandProfileSchema;
export const updateBrandProfileSchema = brandProfileSchema.partial();

// ============================================
// Type Exports
// ============================================

export type HexColor = z.infer<typeof hexColorSchema>;
export type ColorPaletteItem = z.infer<typeof colorPaletteItemSchema>;
export type ToneDescriptors = z.infer<typeof toneDescriptorsSchema>;
export type Guardrail = z.infer<typeof guardrailSchema>;
export type VocabularyItem = z.infer<typeof vocabularyItemSchema>;

export type BrandBasicsFormData = z.infer<typeof brandBasicsSchema>;
export type VoiceToneFormData = z.infer<typeof voiceToneSchema>;
export type VisualIdentityFormData = z.infer<typeof visualIdentitySchema>;
export type GuardrailsStepFormData = z.infer<typeof guardrailsStepSchema>;
export type BrandProfileFormData = z.infer<typeof brandProfileSchema>;

export type GuardrailType = (typeof GUARDRAIL_TYPES)[number];
export type GuardrailSeverity = (typeof GUARDRAIL_SEVERITIES)[number];
export type VocabularyType = (typeof VOCABULARY_TYPES)[number];
export type VoiceDimension = (typeof VOICE_DIMENSIONS)[number];
export type ColorUsage = (typeof COLOR_USAGES)[number];

// ============================================
// Default Values
// ============================================

export const DEFAULT_TONE_DESCRIPTORS: ToneDescriptors = {
  formalCasual: 50,
  technicalSimple: 50,
  seriousPlayful: 50,
  reservedEnthusiastic: 50,
};

export const DEFAULT_BRAND_PROFILE_FORM: BrandProfileFormData = {
  name: "",
  mission: "",
  values: [],
  toneDescriptors: DEFAULT_TONE_DESCRIPTORS,
  logoUrl: "",
  logoR2Key: "",
  colorPalette: [],
  guardrails: [],
  vocabulary: [],
};
