import { describe, expect, it } from "vitest";

import { calculateEloChange, expectedScore } from "./elo";

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it("returns high value when player is much stronger", () => {
    const result = expectedScore(1600, 1200);
    expect(result).toBeGreaterThan(0.9);
  });

  it("returns low value when player is much weaker", () => {
    const result = expectedScore(1200, 1600);
    expect(result).toBeLessThan(0.1);
  });

  it("expected scores of two opponents sum to 1", () => {
    const a = expectedScore(1300, 1500);
    const b = expectedScore(1500, 1300);
    expect(a + b).toBeCloseTo(1.0);
  });
});

describe("calculateEloChange", () => {
  it("returns positive change for a win", () => {
    const change = calculateEloChange(1200, 1200, 1);
    expect(change).toBeGreaterThan(0);
  });

  it("returns negative change for a loss", () => {
    const change = calculateEloChange(1200, 1200, 0);
    expect(change).toBeLessThan(0);
  });

  it("returns ~0 for a draw between equal players", () => {
    const change = calculateEloChange(1200, 1200, 0.5);
    expect(change).toBe(0);
  });

  it("gives larger gain for upset win (weaker beats stronger)", () => {
    const upsetWin = calculateEloChange(1000, 1400, 1);
    const normalWin = calculateEloChange(1400, 1000, 1);
    expect(upsetWin).toBeGreaterThan(normalWin);
  });

  it("uses K=32 factor", () => {
    // For equal players: expected=0.5, win=1 => change = 32*(1-0.5) = 16
    const change = calculateEloChange(1200, 1200, 1);
    expect(change).toBe(16);
  });

  it("returns integer values", () => {
    const change = calculateEloChange(1250, 1300, 1);
    expect(Number.isInteger(change)).toBe(true);
  });
});
