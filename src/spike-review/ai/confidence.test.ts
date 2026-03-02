import { describe, expect, it } from "vitest";
import {
  confidenceToLevel,
  DEFAULT_CONFIDENCE_THRESHOLD,
  filterByConfidence,
  sortByConfidence,
} from "./confidence.js";
import type { ReviewFinding } from "../types.js";
import { DiffSide } from "../types.js";

const makeFinding = (confidence: number): ReviewFinding => ({
  path: "test.ts",
  line: 1,
  side: DiffSide.RIGHT,
  body: "test issue",
  confidence,
  level: confidenceToLevel(confidence),
  category: "test",
});

describe("DEFAULT_CONFIDENCE_THRESHOLD", () => {
  it("is 80", () => {
    expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(80);
  });
});

describe("confidenceToLevel", () => {
  it("maps 90+ to critical", () => {
    expect(confidenceToLevel(95)).toBe("critical");
    expect(confidenceToLevel(90)).toBe("critical");
  });

  it("maps 80-89 to high", () => {
    expect(confidenceToLevel(85)).toBe("high");
    expect(confidenceToLevel(80)).toBe("high");
  });

  it("maps 60-79 to medium", () => {
    expect(confidenceToLevel(70)).toBe("medium");
    expect(confidenceToLevel(60)).toBe("medium");
  });

  it("maps below 60 to low", () => {
    expect(confidenceToLevel(50)).toBe("low");
    expect(confidenceToLevel(0)).toBe("low");
  });
});

describe("filterByConfidence", () => {
  it("filters below threshold", () => {
    const findings = [makeFinding(90), makeFinding(70), makeFinding(50)];
    const filtered = filterByConfidence(findings, 80);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.confidence).toBe(90);
  });

  it("uses default threshold of 80", () => {
    const findings = [makeFinding(80), makeFinding(79)];
    const filtered = filterByConfidence(findings);
    expect(filtered).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const findings = [makeFinding(30), makeFinding(40)];
    expect(filterByConfidence(findings)).toHaveLength(0);
  });
});

describe("sortByConfidence", () => {
  it("sorts descending by confidence", () => {
    const findings = [makeFinding(50), makeFinding(90), makeFinding(70)];
    const sorted = sortByConfidence(findings);
    expect(sorted[0]?.confidence).toBe(90);
    expect(sorted[1]?.confidence).toBe(70);
    expect(sorted[2]?.confidence).toBe(50);
  });

  it("does not mutate original array", () => {
    const findings = [makeFinding(50), makeFinding(90)];
    sortByConfidence(findings);
    expect(findings[0]?.confidence).toBe(50);
  });
});
