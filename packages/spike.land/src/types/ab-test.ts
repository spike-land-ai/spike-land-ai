/**
 * TypeScript types for A/B testing feature
 *
 * Defines interfaces for A/B tests, variants, and statistical analysis.
 * Resolves #840
 */

import type { AbTestStatus } from "@prisma/client";

export interface AbTestVariant {
  id: string;
  testId: string;
  content: string;
  variationType: VariationType;
  impressions: number;
  engagements: number;
  clicks: number;
  conversionRate?: number; // calculated client-side, not stored in DB
  createdAt: Date;
  updatedAt: Date;
}

export interface AbTest {
  id: string;
  workspaceId: string;
  name: string;
  status: AbTestStatus;
  originalPostId: string;
  significanceLevel: number;
  winnerVariantId: string | null;
  variants: AbTestVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export type VariationType = "headline" | "cta" | "emoji" | "hashtags" | "tone";

export interface SignificanceResult {
  isSignificant: boolean;
  confidenceLevel: number;
  winnerVariantId: string | null;
  metrics: {
    variantId: string;
    conversionRate: number;
    sampleSize: number;
    zScore: number;
    pValue: number;
  }[];
}

export interface GenerateVariationsRequest {
  originalContent: string;
  variationTypes: VariationType[];
  count?: number; // how many variations per type
}

export interface GenerateVariationsResponse {
  variations: {
    type: VariationType;
    content: string;
    reasoning?: string;
  }[];
}
