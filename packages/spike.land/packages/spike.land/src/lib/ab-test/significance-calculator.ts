/**
 * Statistical Significance Calculator for A/B Tests
 *
 * Uses two-proportion z-test to determine if differences are statistically significant.
 * Resolves #840
 */

import type { SignificanceResult } from "@/types/ab-test";

interface VariantData {
  id: string;
  impressions: number;
  clicks: number;
}

/**
 * Calculate statistical significance between A/B test variants.
 * Uses two-proportion z-test with pooled standard error.
 *
 * @param variants - Array of variant data with impressions and clicks
 * @param significanceLevel - Desired confidence level (default 0.95 = 95%)
 * @returns Significance result with winner, confidence level, and detailed metrics
 */
export function calculateSignificance(
  variants: VariantData[],
  significanceLevel = 0.95,
): SignificanceResult {
  if (variants.length < 2) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      winnerVariantId: null,
      metrics: [],
    };
  }

  // Calculate conversion rates
  const variantsWithRates = variants.map(v => ({
    ...v,
    conversionRate: v.impressions > 0 ? v.clicks / v.impressions : 0,
  }));

  // Sort by conversion rate descending
  variantsWithRates.sort((a, b) => b.conversionRate - a.conversionRate);

  const winner = variantsWithRates[0];
  const runner = variantsWithRates[1];

  // Ensure we have both winner and runner
  if (!winner || !runner) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      winnerVariantId: null,
      metrics: variantsWithRates.map(v => ({
        variantId: v.id,
        conversionRate: v.conversionRate,
        sampleSize: v.impressions,
        zScore: 0,
        pValue: 1,
      })),
    };
  }

  // Check minimum sample size (at least 100 impressions per variant)
  const hasEnoughData = variants.every(v => v.impressions >= 100);

  if (!hasEnoughData) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      winnerVariantId: null,
      metrics: variantsWithRates.map(v => ({
        variantId: v.id,
        conversionRate: v.conversionRate,
        sampleSize: v.impressions,
        zScore: 0,
        pValue: 1,
      })),
    };
  }

  // Two-proportion z-test
  const p1 = winner.conversionRate;
  const p2 = runner.conversionRate;
  const n1 = winner.impressions;
  const n2 = runner.impressions;

  // Pooled proportion
  const pPool = (winner.clicks + runner.clicks) / (n1 + n2);

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  // Z-score
  const zScore = se > 0 ? (p1 - p2) / se : 0;

  // P-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  // Determine significance (p-value < (1 - significanceLevel))
  const alpha = 1 - significanceLevel;
  const isSignificant = pValue < alpha;

  return {
    isSignificant,
    confidenceLevel: 1 - pValue,
    winnerVariantId: isSignificant ? winner.id : null,
    metrics: variantsWithRates.map(v => ({
      variantId: v.id,
      conversionRate: v.conversionRate,
      sampleSize: v.impressions,
      zScore: v.id === winner.id ? zScore : 0,
      pValue: v.id === winner.id ? pValue : 1,
    })),
  };
}

/**
 * Cumulative Distribution Function for standard normal distribution.
 * Approximation using error function.
 *
 * @param x - The z-score
 * @returns Cumulative probability
 */
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

/**
 * Error function approximation (Abramowitz and Stegun).
 *
 * @param x - Input value
 * @returns Error function result
 */
function erf(x: number): number {
  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save sign of x
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  // Abramowitz and Stegun formula
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0
    - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}
