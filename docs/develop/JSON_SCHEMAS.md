# JSON Column Schemas

> **Phase 3 - Schema Improvement Plan**
>
> This document provides TypeScript interfaces and Zod schemas for all JSON
> columns in the Prisma schema. The schema has 83 JSON columns across various
> models.

---

## Table of Contents

- [E-commerce Models](#e-commerce-models)
- [Campaign & Marketing Models](#campaign--marketing-models)
- [Analytics Models](#analytics-models)
- [Audit & Logging Models](#audit--logging-models)
- [AI/ML Models](#aiml-models)
- [Social Media Models](#social-media-models)
- [Budget Allocator Models](#budget-allocator-models)
- [Configuration Models](#configuration-models)

---

## E-commerce Models

### MerchOrder.shippingAddress / billingAddress

```typescript
interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 (e.g., "GB", "US")
  phone?: string;
}
```

### MerchVariant.attributes

```typescript
interface VariantAttributes {
  size?: string; // e.g., "30x40", "S", "M", "L"
  color?: string; // e.g., "black", "white", "navy"
  material?: string;
  [key: string]: string | undefined;
}
```

### MerchOrderEvent.data

```typescript
interface OrderEventData {
  // For PAYMENT_* events
  paymentIntentId?: string;
  amount?: number;
  currency?: string;

  // For SUBMITTED_TO_POD events
  providerId?: string;
  providerOrderId?: string;

  // For SHIPMENT_* events
  trackingNumber?: string;
  carrier?: string;

  // For CANCELLED/REFUNDED events
  reason?: string;
  refundAmount?: number;
}
```

---

## Campaign & Marketing Models

### CampaignBrief.targetAudience

> **Note**: Phase 4 will extract this to a dedicated `CampaignTargetAudience`
> model.

```typescript
interface TargetAudience {
  ageRange?: {
    min: number;
    max: number;
  };
  genders?: ("male" | "female" | "other" | "all")[];
  locations?: string[]; // ISO country codes or city names
  interests?: string[];
  behaviors?: string[];
  customAudiences?: string[];
}
```

### CampaignBrief.campaignObjectives

> **Note**: Phase 4 will extract this to a dedicated `CampaignObjective` model.

```typescript
interface CampaignObjective {
  type: "AWARENESS" | "ENGAGEMENT" | "CONVERSION" | "RETENTION" | "ADVOCACY";
  metric: string; // e.g., "impressions", "clicks", "conversions"
  targetValue?: number;
  deadline?: string; // ISO date
  priority?: number;
}

// The column stores an array
type CampaignObjectives = CampaignObjective[];
```

### BrandProfile Values

#### BrandProfile.values

```typescript
type BrandValues = string[]; // e.g., ["innovation", "sustainability", "quality"]
```

#### BrandProfile.toneDescriptors

```typescript
type ToneDescriptors = string[]; // e.g., ["professional", "friendly", "authoritative"]
```

#### BrandProfile.colorPalette

```typescript
interface ColorPalette {
  primary?: string; // Hex color, e.g., "#FF5733"
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}
```

### SocialPost.metadata

```typescript
interface SocialPostMetadata {
  mediaUrls?: string[];
  linkPreviews?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
  }[];
  hashtags?: string[];
  mentions?: string[];
  location?: {
    name: string;
    coordinates?: { lat: number; lng: number };
  };
}
```

---

## Analytics Models

### AnalyticsEvent.metadata

```typescript
interface AnalyticsEventMetadata {
  // Page/content context
  pageUrl?: string;
  contentId?: string;
  contentType?: string;

  // User action context
  buttonId?: string;
  formId?: string;
  errorCode?: string;

  // E-commerce context
  productId?: string;
  cartValue?: number;
  currency?: string;

  // Custom properties
  [key: string]: unknown;
}
```

### AnalyticsSummary.metrics

```typescript
interface AnalyticsMetrics {
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number; // 0-100
  avgSessionDuration: number; // seconds
  topPages: { path: string; views: number }[];
  topReferrers: { source: string; visits: number }[];
  deviceBreakdown: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}
```

---

## Audit & Logging Models

### AuditLog.oldValue / newValue

```typescript
// These store the previous and new state of the audited entity
// Structure depends on the entity being audited (User, Album, Enhancement, etc.)
type AuditValue = Record<string, unknown>;
```

### AuditLog.metadata

```typescript
interface AuditMetadata {
  // For AI-driven changes
  aiReasoning?: string;
  aiConfidence?: number;

  // For user-driven changes
  userAgent?: string;
  ipAddress?: string; // Anonymized

  // Context
  triggeredBy?: "USER" | "SYSTEM" | "AI" | "CRON" | "WEBHOOK";
  relatedEntities?: { type: string; id: string }[];
}
```

---

## AI/ML Models

### EnhancementJob Fields

#### EnhancementJob.analysisResult

```typescript
interface AnalysisResult {
  confidence: number; // 0-1
  suggestions: {
    type: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
  detectedElements: {
    type: string;
    boundingBox?: { x: number; y: number; width: number; height: number };
    confidence: number;
  }[];
}
```

#### EnhancementJob.cropDimensions

```typescript
interface CropDimensions {
  left: number; // pixels
  top: number;
  width: number;
  height: number;
}
```

### AiInteraction Fields

#### AiInteraction.inputContext

```typescript
interface AiInputContext {
  conversationHistory?: { role: string; content: string }[];
  systemPrompt?: string;
  userPreferences?: Record<string, unknown>;
  contextDocuments?: { id: string; content: string }[];
}
```

#### AiInteraction.outputMetadata

```typescript
interface AiOutputMetadata {
  model: string; // e.g., "gpt-4", "claude-3"
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
  confidenceScores?: Record<string, number>;
  citations?: { source: string; text: string }[];
}
```

---

## Social Media Models

### SocialAccount.ownMetrics

```typescript
interface OwnMetrics {
  followers: number;
  following: number;
  totalPosts: number;
  averageLikes: number;
  averageComments: number;
  averageShares: number;
  engagementRate: number; // 0-100
  topPerformingContent: {
    id: string;
    engagement: number;
    type: string;
  }[];
}
```

### SocialAccount.competitorMetrics

```typescript
interface CompetitorMetrics {
  averageFollowers: number;
  averageEngagementRate: number;
  topCompetitors: {
    handle: string;
    followers: number;
    engagementRate: number;
  }[];
  industryBenchmarks: {
    metric: string;
    value: number;
    percentile: number;
  }[];
}
```

### ScheduledPostEngagement.engagement

```typescript
interface PostEngagement {
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  clicks?: number;
  videoViews?: number;
}
```

---

## Budget Allocator Models

### AllocatorDecision Snapshots

#### recommendationSnapshot

```typescript
interface BudgetRecommendation {
  campaignId: string;
  currentBudget: number;
  recommendedBudget: number;
  changePercent: number;
  reasoning: string;
  confidence: number;
  projectedMetrics: {
    metric: string;
    current: number;
    projected: number;
  }[];
}
```

#### performanceSnapshot

```typescript
interface CampaignPerformanceAnalysis {
  campaignId: string;
  period: { start: string; end: string };
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpa: number;
    roas: number;
  };
  trends: {
    metric: string;
    direction: "up" | "down" | "stable";
    changePercent: number;
  }[];
}
```

#### guardrailEvaluation

```typescript
interface GuardrailEvaluation {
  check: string;
  passed: boolean;
  reason: string;
  values: {
    actual: number;
    threshold: number;
  };
}

type GuardrailEvaluations = GuardrailEvaluation[];
```

---

## Configuration Models

### PipelineConfig Fields

```typescript
interface AnalysisConfig {
  enabled: boolean;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

interface AutoCropConfig {
  enabled: boolean;
  aspectRatios: string[];
  padding: number;
}

interface PromptConfig {
  template: string;
  variables: Record<string, string>;
}

interface GenerationConfig {
  model: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
}
```

### WorkflowStep.config

```typescript
interface WorkflowStepConfig {
  // For CONDITION steps
  condition?: {
    field: string;
    operator: "eq" | "ne" | "gt" | "lt" | "contains";
    value: unknown;
  };

  // For ACTION steps
  action?: {
    type: string;
    parameters: Record<string, unknown>;
  };

  // For APPROVAL steps
  approval?: {
    requiredApprovers: string[];
    timeout: number; // hours
  };

  // For WEBHOOK steps
  webhook?: {
    url: string;
    method: "GET" | "POST" | "PUT";
    headers?: Record<string, string>;
  };
}
```

### WorkflowStep.dependencies

```typescript
type WorkflowDependencies = string[]; // Array of step IDs that must complete first
```

---

## Policy & Compliance Models

### PolicyRule.conditions

```typescript
interface PolicyConditions {
  type: "AND" | "OR";
  rules: {
    field: string;
    operator: "contains" | "matches" | "startsWith" | "endsWith" | "equals";
    value: string | string[];
    caseSensitive?: boolean;
  }[];
}
```

### PolicyViolation.matchLocation

```typescript
interface MatchLocation {
  startIndex: number;
  endIndex: number;
  matchedText: string;
  context: string; // Surrounding text for review
}
```

---

## Webhook & Event Models

### MerchWebhookEvent.payload

```typescript
// Structure depends on provider (Stripe, Prodigi, Printful)
// Store raw webhook payload for debugging and replay
type WebhookPayload = Record<string, unknown>;
```

### AppMessage.metadata

```typescript
interface AppMessageMetadata {
  // For tool calls
  toolCalls?: {
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }[];

  // For errors
  errorCode?: string;
  errorStack?: string;

  // For AI responses
  tokenUsage?: {
    prompt: number;
    completion: number;
  };
}
```

---

## Runtime Validation

For runtime validation, use the Zod schemas in `@spike-land-ai/shared`:

```
@spike-land-ai/shared (external repo, src/validations/json-schemas.ts)
```

Example usage:

```typescript
import { ShippingAddressSchema } from "@spike-land/shared/validations/json-schemas";

// Validate incoming data
const result = ShippingAddressSchema.safeParse(orderData.shippingAddress);
if (!result.success) {
  console.error("Invalid shipping address:", result.error.issues);
}
```

---

## Migration Notes

When migrating JSON columns to typed models:

1. **Expand**: Add new typed model alongside JSON column
2. **Dual-write**: Write to both during transition
3. **Backfill**: Migrate existing JSON data to new model
4. **Switch reads**: Read from new model, validate against JSON
5. **Contract**: Remove JSON column after verification

See Phase 4 of the Schema Improvement Plan for CampaignBrief extraction example.
