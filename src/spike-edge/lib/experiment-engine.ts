import { fnv1a, sampleBeta } from "@spike-land-ai/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VariantWeight {
  id: string;
  weight: number;
}

export interface VariantMetrics {
  impressions: number;
  donations: number;
  revenue: number;
  fistbumps: number;
}

export interface VariantConversionRates {
  variantId: string;
  impressions: number;
  donations: number;
  revenue: number;
  fistbumps: number;
  donateRate: number;
  revenuePerImpression: number;
  conversionRate: number;
}

export interface EvaluationResult {
  probabilities: Record<string, number>;
  bestVariant: string;
  bestProb: number;
  controlRate: number;
  winnerRate: number;
  improvement: number;
  shouldGraduate: boolean;
}

// ─── Variant Assignment ─────────────────────────────────────────────────────

export function assignVariant(
  clientId: string,
  experimentId: string,
  variants: VariantWeight[],
): string {
  const bucket = fnv1a(clientId + experimentId) % 10000;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight * 100; // weight 25 → 2500 out of 10000
    if (bucket < cumulative) return v.id;
  }
  return variants[variants.length - 1]?.id ?? "control";
}

// ─── Conversion Rate Computation ────────────────────────────────────────────

export function computeConversionRates(
  variantId: string,
  metrics: Partial<Record<string, { value: number; sampleSize: number }>>,
): VariantConversionRates {
  const impressions = metrics.impressions?.value ?? 0;
  const donations = metrics.donations?.value ?? 0;
  const revenue = metrics.revenue_cents?.value ?? 0;
  const fistbumps = metrics.fistbumps?.value ?? 0;

  return {
    variantId,
    impressions,
    donations,
    revenue,
    fistbumps,
    donateRate: impressions > 0 ? donations / impressions : 0,
    revenuePerImpression: impressions > 0 ? revenue / impressions : 0,
    conversionRate: impressions > 0 ? (donations + fistbumps) / impressions : 0,
  };
}

// ─── Bayesian Evaluation (Beta-Binomial Monte Carlo) ────────────────────────

const NUM_DRAWS = 10000;

export function evaluateExperiment(
  variantMetrics: Array<{
    id: string;
    impressions: number;
    donations: number;
  }>,
): EvaluationResult {
  // Prepare posterior parameters: Beta(1 + successes, 1 + failures)
  const posteriors = variantMetrics.map((v) => ({
    id: v.id,
    alpha: 1 + v.donations,
    beta: 1 + (v.impressions - v.donations),
    donateRate: v.impressions > 0 ? v.donations / v.impressions : 0,
  }));

  // Monte Carlo simulation
  const wins = new Map<string, number>();
  for (let draw = 0; draw < NUM_DRAWS; draw++) {
    let bestId = "";
    let bestVal = -1;

    for (const p of posteriors) {
      const sample = sampleBeta(p.alpha, p.beta);
      if (sample > bestVal) {
        bestVal = sample;
        bestId = p.id;
      }
    }

    wins.set(bestId, (wins.get(bestId) ?? 0) + 1);
  }

  const probabilities: Record<string, number> = {};
  for (const v of variantMetrics) {
    probabilities[v.id] = (wins.get(v.id) ?? 0) / NUM_DRAWS;
  }

  // Find best variant
  let bestVariant = "";
  let bestProb = 0;
  for (const [vid, prob] of Object.entries(probabilities)) {
    if (prob > bestProb) {
      bestProb = prob;
      bestVariant = vid;
    }
  }

  // Check if winner is ≥10% better than control
  const controlRate = posteriors.find((p) => p.id === "control")?.donateRate ?? 0;
  const winnerRate = posteriors.find((p) => p.id === bestVariant)?.donateRate ?? 0;
  const improvement = controlRate > 0 ? (winnerRate - controlRate) / controlRate : 0;

  const shouldGraduate =
    bestProb > 0.95 && (bestVariant === "control" || improvement >= 0.1);

  return {
    probabilities,
    bestVariant,
    bestProb,
    controlRate,
    winnerRate,
    improvement,
    shouldGraduate,
  };
}
