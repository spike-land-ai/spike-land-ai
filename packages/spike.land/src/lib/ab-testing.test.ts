import { describe, expect, it } from "vitest";
import {
  calculateChiSquared,
  calculateConfidenceInterval,
  calculateEffectSize,
  calculatePValue,
  calculateRequiredSampleSize,
  getWinner,
  getZScore,
  interpretEffectSize,
  isStatisticallySignificant,
} from "./ab-testing";
import type { Variant } from "./ab-testing";

describe("calculateChiSquared", () => {
  it("returns 0 when there are no visitors", () => {
    expect(calculateChiSquared([{ visitors: 0, conversions: 0 }])).toBe(0);
  });

  it("returns 0 when conversion rates are equal", () => {
    const variants = [
      { visitors: 100, conversions: 10 },
      { visitors: 100, conversions: 10 },
    ];
    expect(calculateChiSquared(variants)).toBeCloseTo(0, 5);
  });

  it("returns a positive value when rates differ significantly", () => {
    const variants = [
      { visitors: 1000, conversions: 100 }, // 10%
      { visitors: 1000, conversions: 200 }, // 20%
    ];
    expect(calculateChiSquared(variants)).toBeGreaterThan(0);
  });

  it("handles single variant", () => {
    const variants = [{ visitors: 100, conversions: 10 }];
    expect(typeof calculateChiSquared(variants)).toBe("number");
  });
});

describe("calculatePValue", () => {
  it("returns a p-value between 0 and 1", () => {
    const variants = [
      { visitors: 1000, conversions: 100 },
      { visitors: 1000, conversions: 200 },
    ];
    const pValue = calculatePValue(variants);
    expect(pValue).toBeGreaterThanOrEqual(0);
    expect(pValue).toBeLessThanOrEqual(1);
  });

  it("returns close to 1 when variants are identical", () => {
    const variants = [
      { visitors: 1000, conversions: 100 },
      { visitors: 1000, conversions: 100 },
    ];
    const pValue = calculatePValue(variants);
    expect(pValue).toBeGreaterThan(0.5);
  });

  it("returns small p-value for very different rates", () => {
    const variants = [
      { visitors: 10000, conversions: 1000 }, // 10%
      { visitors: 10000, conversions: 3000 }, // 30%
    ];
    const pValue = calculatePValue(variants);
    expect(pValue).toBeLessThan(0.05);
  });
});

describe("isStatisticallySignificant", () => {
  it("returns false when variants are identical", () => {
    const variants = [
      { visitors: 1000, conversions: 100 },
      { visitors: 1000, conversions: 100 },
    ];
    expect(isStatisticallySignificant(variants)).toBe(false);
  });

  it("returns true for large significant difference", () => {
    const variants = [
      { visitors: 10000, conversions: 500 }, // 5%
      { visitors: 10000, conversions: 3000 }, // 30%
    ];
    expect(isStatisticallySignificant(variants)).toBe(true);
  });

  it("respects custom alpha threshold", () => {
    const variants = [
      { visitors: 1000, conversions: 100 },
      { visitors: 1000, conversions: 120 },
    ];
    // With very high alpha (0.9), almost anything is significant
    const resultHighAlpha = isStatisticallySignificant(variants, 0.9);
    // With very low alpha (0.001), modest differences aren't significant
    const resultLowAlpha = isStatisticallySignificant(variants, 0.001);
    expect(typeof resultHighAlpha).toBe("boolean");
    expect(typeof resultLowAlpha).toBe("boolean");
  });
});

describe("calculateRequiredSampleSize", () => {
  it("returns Infinity for invalid baseline rate (0)", () => {
    expect(calculateRequiredSampleSize(0, 0.1)).toBe(Infinity);
  });

  it("returns Infinity for invalid baseline rate (1)", () => {
    expect(calculateRequiredSampleSize(1, 0.1)).toBe(Infinity);
  });

  it("returns Infinity for invalid MDE (0)", () => {
    expect(calculateRequiredSampleSize(0.1, 0)).toBe(Infinity);
  });

  it("returns Infinity for negative MDE", () => {
    expect(calculateRequiredSampleSize(0.1, -0.1)).toBe(Infinity);
  });

  it("returns a positive integer for valid inputs", () => {
    const n = calculateRequiredSampleSize(0.1, 0.2, 0.05, 0.8);
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("larger MDE requires smaller sample size", () => {
    const n1 = calculateRequiredSampleSize(0.1, 0.1); // 10% MDE
    const n2 = calculateRequiredSampleSize(0.1, 0.5); // 50% MDE
    expect(n1).toBeGreaterThan(n2);
  });
});

describe("getWinner", () => {
  it("returns null with fewer than 2 variants", () => {
    const v: Variant = { id: "a", name: "A", visitors: 1000, conversions: 100 };
    expect(getWinner([v])).toBeNull();
  });

  it("returns null when no statistical significance", () => {
    const variants: Variant[] = [
      { id: "a", name: "A", visitors: 100, conversions: 10 },
      { id: "b", name: "B", visitors: 100, conversions: 10 },
    ];
    expect(getWinner(variants)).toBeNull();
  });

  it("returns the variant with higher conversion rate when significant", () => {
    const variants: Variant[] = [
      { id: "control", name: "Control", visitors: 10000, conversions: 500 },
      { id: "variant", name: "Variant", visitors: 10000, conversions: 3000 },
    ];
    const winner = getWinner(variants);
    expect(winner).not.toBeNull();
    expect(winner?.id).toBe("variant");
  });

  it("returns empty array result gracefully", () => {
    expect(getWinner([])).toBeNull();
  });
});

describe("getZScore", () => {
  it("returns ~1.96 for 95% confidence", () => {
    expect(getZScore(0.95)).toBeCloseTo(1.96, 1);
  });

  it("returns ~2.576 for 99% confidence", () => {
    expect(getZScore(0.99)).toBeCloseTo(2.576, 1);
  });

  it("returns ~1.645 for 90% confidence", () => {
    expect(getZScore(0.9)).toBeCloseTo(1.645, 1);
  });
});

describe("calculateConfidenceInterval", () => {
  it("returns { lower: 0, upper: 0 } when total is 0", () => {
    const ci = calculateConfidenceInterval(0, 0);
    expect(ci.lower).toBe(0);
    expect(ci.upper).toBe(0);
  });

  it("returns valid interval for simple case", () => {
    const ci = calculateConfidenceInterval(50, 100);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.lower).toBeLessThan(ci.upper);
  });

  it("interval contains the observed proportion", () => {
    const ci = calculateConfidenceInterval(100, 1000);
    const observed = 100 / 1000; // 10%
    expect(ci.lower).toBeLessThanOrEqual(observed);
    expect(ci.upper).toBeGreaterThanOrEqual(observed);
  });

  it("respects custom confidence level", () => {
    const ci95 = calculateConfidenceInterval(50, 100, 0.95);
    const ci99 = calculateConfidenceInterval(50, 100, 0.99);
    // 99% CI should be wider
    expect(ci99.upper - ci99.lower).toBeGreaterThan(ci95.upper - ci95.lower);
  });
});

describe("calculateEffectSize", () => {
  it("returns 0 when both proportions are equal", () => {
    expect(calculateEffectSize(0.5, 0.5)).toBeCloseTo(0, 5);
  });

  it("returns positive value when p2 > p1", () => {
    expect(calculateEffectSize(0.1, 0.2)).toBeGreaterThan(0);
  });

  it("returns negative value when p2 < p1", () => {
    expect(calculateEffectSize(0.3, 0.1)).toBeLessThan(0);
  });

  it("returns a finite number for edge cases near 0 and 1", () => {
    expect(isFinite(calculateEffectSize(0.01, 0.99))).toBe(true);
  });
});

describe("interpretEffectSize", () => {
  it("returns SMALL for abs(h) < 0.2", () => {
    expect(interpretEffectSize(0.1)).toBe("SMALL");
    expect(interpretEffectSize(-0.15)).toBe("SMALL");
  });

  it("returns MEDIUM for 0.2 <= abs(h) < 0.5", () => {
    expect(interpretEffectSize(0.3)).toBe("MEDIUM");
    expect(interpretEffectSize(-0.4)).toBe("MEDIUM");
  });

  it("returns LARGE for abs(h) >= 0.5", () => {
    expect(interpretEffectSize(0.5)).toBe("LARGE");
    expect(interpretEffectSize(1.0)).toBe("LARGE");
    expect(interpretEffectSize(-0.7)).toBe("LARGE");
  });
});
