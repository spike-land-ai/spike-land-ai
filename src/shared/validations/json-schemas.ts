import { z } from "zod";

/**
 * JSON Column Schemas for Prisma Models
 *
 * Phase 3 - Schema Improvement Plan
 *
 * These Zod schemas provide runtime validation for JSON columns in the database.
 * See docs/JSON_SCHEMAS.md for complete documentation.
 */

// =============================================================================
// E-commerce Schemas
// =============================================================================

/**
 * Shipping/billing address for MerchOrder
 * @see MerchOrder.shippingAddress, MerchOrder.billingAddress
 */
export const AddressSchema = z.object({
  name: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  phone: z.string().max(20).optional(),
});

export type Address = z.infer<typeof AddressSchema>;

/**
 * Variant attributes for MerchVariant
 * @see MerchVariant.attributes
 * Values must be strings — matches the Prisma type Record<string, string>.
 */
export const VariantAttributesSchema = z.record(z.string(), z.string());

export type VariantAttributes = z.infer<typeof VariantAttributesSchema>;

/**
 * Order event data for MerchOrderEvent
 * @see MerchOrderEvent.data
 */
export const OrderEventDataSchema = z
  .object({
    // Payment events
    paymentIntentId: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().length(3).optional(),

    // POD submission events
    providerId: z.string().optional(),
    providerOrderId: z.string().optional(),

    // Shipment events
    trackingNumber: z.string().optional(),
    carrier: z.string().optional(),

    // Cancellation/refund events
    reason: z.string().optional(),
    refundAmount: z.number().optional(),
  })
  .strip(); // Strip unknown keys — external event data may contain platform-specific fields

export type OrderEventData = z.infer<typeof OrderEventDataSchema>;

// =============================================================================
// Campaign & Marketing Schemas
// =============================================================================

/**
 * Target audience definition for CampaignBrief
 * @see CampaignBrief.targetAudience
 * @deprecated Phase 4 will extract this to CampaignTargetAudience model
 */
export const TargetAudienceSchema = z.object({
  ageRange: z
    .object({
      min: z.number().int().min(13).max(100),
      max: z.number().int().min(13).max(100),
    })
    .optional(),
  genders: z.array(z.enum(["male", "female", "other", "all"])).optional(),
  locations: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  behaviors: z.array(z.string()).optional(),
  customAudiences: z.array(z.string()).optional(),
});

export type TargetAudience = z.infer<typeof TargetAudienceSchema>;

/**
 * Campaign objective for CampaignBrief
 * @see CampaignBrief.campaignObjectives
 * @deprecated Phase 4 will extract this to CampaignObjective model
 */
export const CampaignObjectiveSchema = z.object({
  type: z.enum(["AWARENESS", "ENGAGEMENT", "CONVERSION", "RETENTION", "ADVOCACY"]),
  metric: z.string(),
  targetValue: z.number().optional(),
  deadline: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

export const CampaignObjectivesSchema = z.array(CampaignObjectiveSchema);

export type CampaignObjective = z.infer<typeof CampaignObjectiveSchema>;
export type CampaignObjectives = z.infer<typeof CampaignObjectivesSchema>;

/**
 * Brand values array
 * @see BrandProfile.values
 */
export const BrandValuesSchema = z.array(z.string().max(100)).max(20);

export type BrandValues = z.infer<typeof BrandValuesSchema>;

/**
 * Tone descriptors array
 * @see BrandProfile.toneDescriptors
 */
export const ToneDescriptorsSchema = z.array(z.string().max(100)).max(20);

export type ToneDescriptors = z.infer<typeof ToneDescriptorsSchema>;

/**
 * Color palette for brand
 * @see BrandProfile.colorPalette
 */
export const ColorPaletteSchema = z.object({
  primary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondary: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  text: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

// =============================================================================
// Analytics Schemas
// =============================================================================

/**
 * Analytics event metadata
 * @see AnalyticsEvent.metadata
 */
export const AnalyticsEventMetadataSchema = z
  .object({
    pageUrl: z.string().url().optional(),
    contentId: z.string().optional(),
    contentType: z.string().optional(),
    buttonId: z.string().optional(),
    formId: z.string().optional(),
    errorCode: z.string().optional(),
    productId: z.string().optional(),
    cartValue: z.number().optional(),
    currency: z.string().length(3).optional(),
  })
  .strip(); // Strip unknown keys — analytics metadata is extensible but unknown fields should not reach the application

export type AnalyticsEventMetadata = z.infer<typeof AnalyticsEventMetadataSchema>;

/**
 * Analytics summary metrics
 * @see AnalyticsSummary.metrics
 */
export const AnalyticsMetricsSchema = z.object({
  pageViews: z.number().int().min(0),
  uniqueVisitors: z.number().int().min(0),
  bounceRate: z.number().min(0).max(100),
  avgSessionDuration: z.number().min(0),
  topPages: z.array(
    z.object({
      path: z.string(),
      views: z.number().int().min(0),
    }),
  ),
  topReferrers: z.array(
    z.object({
      source: z.string(),
      visits: z.number().int().min(0),
    }),
  ),
  deviceBreakdown: z.object({
    mobile: z.number().int().min(0),
    tablet: z.number().int().min(0),
    desktop: z.number().int().min(0),
  }),
});

export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>;

// =============================================================================
// Audit & Logging Schemas
// =============================================================================

/**
 * Audit log metadata
 * @see AuditLog.metadata
 */
export const AuditMetadataSchema = z
  .object({
    aiReasoning: z.string().optional(),
    aiConfidence: z.number().min(0).max(1).optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    triggeredBy: z.enum(["USER", "SYSTEM", "AI", "CRON", "WEBHOOK"]).optional(),
    relatedEntities: z
      .array(
        z.object({
          type: z.string(),
          id: z.string(),
        }),
      )
      .optional(),
  })
  .strip(); // Strip unknown keys — audit metadata may originate from many sources; strip rather than propagate unvalidated fields

export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;

// =============================================================================
// AI/ML Schemas
// =============================================================================

/**
 * Image analysis result
 * @see EnhancementJob.analysisResult
 */
export const AnalysisResultSchema = z.object({
  confidence: z.number().min(0).max(1),
  suggestions: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  detectedElements: z.array(
    z.object({
      type: z.string(),
      boundingBox: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        })
        .optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Crop dimensions for image processing
 * @see EnhancementJob.cropDimensions
 */
export const CropDimensionsSchema = z.object({
  left: z.number().int().min(0),
  top: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export type CropDimensions = z.infer<typeof CropDimensionsSchema>;

/**
 * AI interaction output metadata
 * @see AiInteraction.outputMetadata
 */
export const AiOutputMetadataSchema = z.object({
  model: z.string(),
  tokenUsage: z.object({
    prompt: z.number().int().min(0),
    completion: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  latencyMs: z.number().int().min(0),
  confidenceScores: z.record(z.string(), z.number().min(0).max(1)).optional(),
  citations: z
    .array(
      z.object({
        source: z.string(),
        text: z.string(),
      }),
    )
    .optional(),
});

export type AiOutputMetadata = z.infer<typeof AiOutputMetadataSchema>;

// =============================================================================
// Social Media Schemas
// =============================================================================

/**
 * Social post metadata
 * @see SocialPost.metadata
 */
export const SocialPostMetadataSchema = z
  .object({
    mediaUrls: z.array(z.string().url()).optional(),
    linkPreviews: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string().optional(),
          description: z.string().optional(),
          image: z.string().url().optional(),
        }),
      )
      .optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    location: z
      .object({
        name: z.string(),
        coordinates: z
          .object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          })
          .optional(),
      })
      .optional(),
  })
  .strip(); // Strip unknown keys — social platform APIs may return platform-specific fields; strip rather than propagate unvalidated data

export type SocialPostMetadata = z.infer<typeof SocialPostMetadataSchema>;

/**
 * Post engagement metrics
 * @see ScheduledPostEngagement.engagement
 */
export const PostEngagementSchema = z.object({
  likes: z.number().int().min(0),
  comments: z.number().int().min(0),
  shares: z.number().int().min(0),
  saves: z.number().int().min(0).optional(),
  reach: z.number().int().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  videoViews: z.number().int().min(0).optional(),
});

export type PostEngagement = z.infer<typeof PostEngagementSchema>;

// =============================================================================
// Budget Allocator Schemas
// =============================================================================

/**
 * Guardrail evaluation result
 * @see AllocatorDecision.guardrailEvaluation
 */
export const GuardrailEvaluationSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  reason: z.string(),
  values: z.object({
    actual: z.number(),
    threshold: z.number(),
  }),
});

export const GuardrailEvaluationsSchema = z.array(GuardrailEvaluationSchema);

export type GuardrailEvaluation = z.infer<typeof GuardrailEvaluationSchema>;
export type GuardrailEvaluations = z.infer<typeof GuardrailEvaluationsSchema>;

// =============================================================================
// Configuration Schemas
// =============================================================================

/**
 * Workflow step configuration
 * @see WorkflowStep.config
 */
export const WorkflowStepConfigSchema = z
  .object({
    condition: z
      .object({
        field: z.string(),
        operator: z.enum(["eq", "ne", "gt", "lt", "contains"]),
        value: z.unknown(),
      })
      .optional(),
    action: z
      .object({
        type: z.string(),
        parameters: z.record(z.string(), z.unknown()),
      })
      .optional(),
    approval: z
      .object({
        requiredApprovers: z.array(z.string()),
        timeout: z.number().int().min(1),
      })
      .optional(),
    webhook: z
      .object({
        url: z.string().url(),
        method: z.enum(["GET", "POST", "PUT"]),
        headers: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
  })
  .strip(); // Strip unknown keys — workflow step types are extensible; strip unrecognized config keys rather than allowing arbitrary data through

export type WorkflowStepConfig = z.infer<typeof WorkflowStepConfigSchema>;

/**
 * Policy rule conditions
 * @see PolicyRule.conditions
 */
export const PolicyConditionsSchema = z.object({
  type: z.enum(["AND", "OR"]),
  rules: z.array(
    z.object({
      field: z.string(),
      operator: z.enum(["contains", "matches", "startsWith", "endsWith", "equals"]),
      value: z.union([z.string(), z.array(z.string())]),
      caseSensitive: z.boolean().optional(),
    }),
  ),
});

export type PolicyConditions = z.infer<typeof PolicyConditionsSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse a JSON column value with a schema
 * Returns undefined if parsing fails (for optional JSON columns)
 */
export function safeParseJson<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Parse a JSON column value with a schema, throwing on failure
 * Use for required JSON columns
 */
export function parseJson<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

// =============================================================================
// Dual-Read Helpers (Phase 4 - Expand-Contract Migration)
// =============================================================================

/**
 * Typed target audience from CampaignTargetAudience model
 * Matches the Prisma model structure
 */
export interface TypedTargetAudience {
  id: string;
  briefId: string;
  ageMin: number | null;
  ageMax: number | null;
  genders: string[];
  locations: string[];
  interests: string[];
  behaviors: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Typed campaign objective from CampaignObjective model
 * Matches the Prisma model structure
 */
export interface TypedCampaignObjective {
  id: string;
  briefId: string;
  type: "AWARENESS" | "ENGAGEMENT" | "CONVERSION" | "RETENTION" | "ADVOCACY";
  metric: string;
  targetValue: number | null;
  deadline: Date | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get target audience from typed model with JSON fallback
 *
 * Phase 4 dual-read pattern: Prefers typed model data, falls back to JSON
 *
 * @param typedAudience - The typed CampaignTargetAudience model (may be null)
 * @param jsonAudience - The JSON targetAudience column value
 * @returns Normalized target audience data
 *
 * @example
 * ```typescript
 * const brief = await prisma.campaignBrief.findUnique({
 *   where: { id },
 *   include: { targetAudienceTyped: true }
 * });
 * const audience = getTargetAudienceWithFallback(
 *   brief.targetAudienceTyped,
 *   brief.targetAudience
 * );
 * ```
 */
export function getTargetAudienceWithFallback(
  typedAudience: TypedTargetAudience | null | undefined,
  jsonAudience: unknown,
): TargetAudience | undefined {
  // Prefer typed model if available
  if (typedAudience) {
    return {
      ageRange:
        typedAudience.ageMin !== null && typedAudience.ageMax !== null
          ? { min: typedAudience.ageMin, max: typedAudience.ageMax }
          : undefined,
      genders: typedAudience.genders as TargetAudience["genders"],
      locations: typedAudience.locations,
      interests: typedAudience.interests,
      behaviors: typedAudience.behaviors,
    };
  }

  // Fall back to JSON column
  return safeParseJson(TargetAudienceSchema, jsonAudience);
}

/**
 * Get campaign objectives from typed models with JSON fallback
 *
 * Phase 4 dual-read pattern: Prefers typed model data, falls back to JSON
 *
 * @param typedObjectives - Array of CampaignObjective models (may be empty)
 * @param jsonObjectives - The JSON campaignObjectives column value
 * @returns Array of campaign objectives
 *
 * @example
 * ```typescript
 * const brief = await prisma.campaignBrief.findUnique({
 *   where: { id },
 *   include: { objectivesTyped: true }
 * });
 * const objectives = getCampaignObjectivesWithFallback(
 *   brief.objectivesTyped,
 *   brief.campaignObjectives
 * );
 * ```
 */
export function getCampaignObjectivesWithFallback(
  typedObjectives: TypedCampaignObjective[] | null | undefined,
  jsonObjectives: unknown,
): CampaignObjectives {
  // Prefer typed models if available
  if (typedObjectives && typedObjectives.length > 0) {
    return typedObjectives.map((obj) => ({
      type: obj.type,
      metric: obj.metric,
      targetValue: obj.targetValue ?? undefined,
      deadline: obj.deadline?.toISOString(),
      priority: obj.priority,
    }));
  }

  // Fall back to JSON column
  return safeParseJson(CampaignObjectivesSchema, jsonObjectives) ?? [];
}
