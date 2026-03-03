import { describe, expect, it } from "vitest";
import { assignVariant } from "./variant-assignment";

describe("assignVariant", () => {
  const variants = [
    { id: "v1", name: "control", splitPercentage: 50 },
    { id: "v2", name: "treatment", splitPercentage: 50 },
  ];

  it("should assign a variant deterministically", () => {
    const result1 = assignVariant("visitor-1", "test-1", variants);
    const result2 = assignVariant("visitor-1", "test-1", variants);
    expect(result1).toEqual(result2);
  });

  it("should return null for empty variants", () => {
    const result = assignVariant("visitor-1", "test-1", []);
    expect(result).toBeNull();
  });

  it("should return the only variant when single", () => {
    const result = assignVariant("visitor-1", "test-1", [
      { id: "v1", name: "only", splitPercentage: 100 },
    ]);
    expect(result!.id).toBe("v1");
  });

  it("should distribute across variants", () => {
    const counts: Record<string, number> = { v1: 0, v2: 0 };
    for (let i = 0; i < 1000; i++) {
      const result = assignVariant(`visitor-${i}`, "test-1", variants);
      if (result) counts[result.id]!++;
    }
    // Should roughly be 50/50 (allow +-15% tolerance)
    expect(counts.v1!).toBeGreaterThan(350);
    expect(counts.v1!).toBeLessThan(650);
    expect(counts.v2!).toBeGreaterThan(350);
    expect(counts.v2!).toBeLessThan(650);
  });
});
