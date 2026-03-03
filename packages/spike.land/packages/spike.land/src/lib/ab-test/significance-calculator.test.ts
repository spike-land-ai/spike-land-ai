import { describe, expect, it } from "vitest";
import { calculateSignificance } from "./significance-calculator";

describe("calculateSignificance", () => {
  it("should return not significant for fewer than 2 variants", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 1000, clicks: 100 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.confidenceLevel).toBe(0);
    expect(result.winnerVariantId).toBeNull();
    expect(result.metrics).toEqual([]);
  });

  it("should return not significant for empty variants", () => {
    const result = calculateSignificance([]);
    expect(result.isSignificant).toBe(false);
    expect(result.metrics).toEqual([]);
  });

  it("should return not significant when insufficient data (<100 impressions)", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 50, clicks: 10 },
      { id: "b", impressions: 50, clicks: 5 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.winnerVariantId).toBeNull();
    expect(result.metrics).toHaveLength(2);
    // Metrics should still be calculated even when not enough data
    expect(result.metrics[0]!.zScore).toBe(0);
    expect(result.metrics[0]!.pValue).toBe(1);
  });

  it("should detect significant difference with large sample", () => {
    // Variant A: 10% conversion, Variant B: 5% conversion
    const result = calculateSignificance([
      { id: "a", impressions: 10000, clicks: 1000 },
      { id: "b", impressions: 10000, clicks: 500 },
    ]);
    expect(result.isSignificant).toBe(true);
    expect(result.winnerVariantId).toBe("a");
    expect(result.confidenceLevel).toBeGreaterThan(0.95);
  });

  it("should return not significant for similar conversion rates", () => {
    // Both ~10% conversion rate
    const result = calculateSignificance([
      { id: "a", impressions: 100, clicks: 10 },
      { id: "b", impressions: 100, clicks: 9 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.winnerVariantId).toBeNull();
  });

  it("should handle zero clicks (0% conversion)", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 1000, clicks: 100 },
      { id: "b", impressions: 1000, clicks: 0 },
    ]);
    expect(result.isSignificant).toBe(true);
    expect(result.winnerVariantId).toBe("a");
  });

  it("should handle zero impressions gracefully", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 0, clicks: 0 },
      { id: "b", impressions: 0, clicks: 0 },
    ]);
    // Not enough data (< 100 impressions)
    expect(result.isSignificant).toBe(false);
  });

  it("should identify correct winner by conversion rate", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 5000, clicks: 250 }, // 5%
      { id: "b", impressions: 5000, clicks: 500 }, // 10%
    ]);
    // b has higher conversion rate
    if (result.isSignificant) {
      expect(result.winnerVariantId).toBe("b");
    }
    // Check metrics are sorted by conversion rate descending
    expect(result.metrics[0]!.conversionRate).toBeGreaterThanOrEqual(
      result.metrics[1]!.conversionRate,
    );
  });

  it("should include metrics for each variant", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 1000, clicks: 100 },
      { id: "b", impressions: 1000, clicks: 50 },
    ]);
    expect(result.metrics).toHaveLength(2);
    for (const metric of result.metrics) {
      expect(metric).toHaveProperty("variantId");
      expect(metric).toHaveProperty("conversionRate");
      expect(metric).toHaveProperty("sampleSize");
      expect(metric).toHaveProperty("zScore");
      expect(metric).toHaveProperty("pValue");
    }
  });

  it("should respect custom significance level", () => {
    // Use very high significance level (99.9%) to make it harder to pass
    const result = calculateSignificance(
      [
        { id: "a", impressions: 200, clicks: 22 },
        { id: "b", impressions: 200, clicks: 18 },
      ],
      0.999,
    );
    // With close rates and 99.9% threshold, should not be significant
    expect(result.isSignificant).toBe(false);
  });

  it("should handle 3+ variants", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 5000, clicks: 500 }, // 10%
      { id: "b", impressions: 5000, clicks: 250 }, // 5%
      { id: "c", impressions: 5000, clicks: 100 }, // 2%
    ]);
    expect(result.metrics).toHaveLength(3);
    // Winner comparison is between top 2
    if (result.isSignificant) {
      expect(result.winnerVariantId).toBe("a");
    }
  });

  it("should have z-score only for winner in metrics", () => {
    const result = calculateSignificance([
      { id: "a", impressions: 5000, clicks: 500 },
      { id: "b", impressions: 5000, clicks: 100 },
    ]);

    const winnerMetric = result.metrics.find(m => m.variantId === "a");
    const loserMetric = result.metrics.find(m => m.variantId === "b");
    expect(winnerMetric!.zScore).not.toBe(0);
    expect(loserMetric!.zScore).toBe(0);
  });
});
