import { describe, expect, it } from "vitest";
import { testSignificance } from "./significance";

describe("testSignificance", () => {
  it("should return not significant with insufficient data", () => {
    const result = testSignificance([
      { variantId: "a", conversions: 1, sampleSize: 10 },
      { variantId: "b", conversions: 1, sampleSize: 10 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.winnerVariantId).toBeNull();
  });

  it("should detect significant difference with large samples", () => {
    const result = testSignificance([
      { variantId: "a", conversions: 100, sampleSize: 1000 },
      { variantId: "b", conversions: 150, sampleSize: 1000 },
    ]);
    expect(result.isSignificant).toBe(true);
    expect(result.winnerVariantId).toBe("b");
    expect(result.metrics).toHaveLength(2);
  });

  it("should handle single variant gracefully", () => {
    const result = testSignificance([
      { variantId: "a", conversions: 50, sampleSize: 100 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.metrics).toHaveLength(1);
  });

  it("should handle zero sample sizes", () => {
    const result = testSignificance([
      { variantId: "a", conversions: 0, sampleSize: 0 },
      { variantId: "b", conversions: 0, sampleSize: 0 },
    ]);
    expect(result.isSignificant).toBe(false);
    expect(result.metrics[0]!.conversionRate).toBe(0);
  });

  it("should respect custom confidence level", () => {
    const result = testSignificance(
      [
        { variantId: "a", conversions: 45, sampleSize: 100 },
        { variantId: "b", conversions: 55, sampleSize: 100 },
      ],
      0.99,
    );
    // With 0.99 confidence, small differences may not be significant
    expect(result.confidenceLevel).toBe(0.99);
  });
});
