/**
 * A/B Test Statistical Significance
 *
 * Two-proportion z-test for determining if variant performance
 * differences are statistically significant.
 */

import type { SignificanceResult } from "@/types/ab-test";

interface VariantData {
  variantId: string;
  conversions: number;
  sampleSize: number;
}

/**
 * Calculate z-score for two-proportion z-test
 */
function calculateZScore(p1: number, p2: number, n1: number, n2: number): number {
  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

/**
 * Approximate p-value from z-score using the normal CDF.
 * Two-tailed test.
 */
function zScoreToPValue(z: number): number {
  const absZ = Math.abs(z);
  // Approximation of the normal CDF using Abramowitz and Stegun formula 7.1.26
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*PI)
  const p =
    d *
    Math.exp(-0.5 * absZ * absZ) *
    (t *
      (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return 2 * p; // two-tailed
}

/**
 * Test statistical significance between variants.
 * Compares each variant pair and determines if there's a winner.
 */
export function testSignificance(
  variants: VariantData[],
  confidenceLevel = 0.95,
): SignificanceResult {
  if (variants.length < 2) {
    return {
      isSignificant: false,
      confidenceLevel,
      winnerVariantId: null,
      metrics: variants.map((v) => ({
        variantId: v.variantId,
        conversionRate: v.sampleSize > 0 ? v.conversions / v.sampleSize : 0,
        sampleSize: v.sampleSize,
        zScore: 0,
        pValue: 1,
      })),
    };
  }

  const alpha = 1 - confidenceLevel;

  // Compare first two variants (control vs treatment)
  const control = variants[0]!;
  const treatment = variants[1]!;

  const p1 = control.sampleSize > 0 ? control.conversions / control.sampleSize : 0;
  const p2 = treatment.sampleSize > 0 ? treatment.conversions / treatment.sampleSize : 0;

  const zScore = calculateZScore(p1, p2, control.sampleSize, treatment.sampleSize);
  const pValue = zScoreToPValue(zScore);

  const isSignificant = pValue < alpha;

  let winnerVariantId: string | null = null;
  if (isSignificant) {
    winnerVariantId = p1 > p2 ? control.variantId : treatment.variantId;
  }

  return {
    isSignificant,
    confidenceLevel,
    winnerVariantId,
    metrics: variants.map((v) => {
      const rate = v.sampleSize > 0 ? v.conversions / v.sampleSize : 0;
      const z = v.variantId === control.variantId ? zScore : -zScore;
      return {
        variantId: v.variantId,
        conversionRate: rate,
        sampleSize: v.sampleSize,
        zScore: z,
        pValue,
      };
    }),
  };
}
