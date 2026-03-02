import { describe, expect, it } from "vitest";

import { calculateEloChange, expectedScore, getKFactor } from "./elo";

describe("expectedScore", () => {
  it("returns ~0.5 for equal rated players", () => {
    const score = expectedScore(1500, 1500);
    expect(score).toBeCloseTo(0.5, 5);
  });

  it("returns higher expected score for higher rated player", () => {
    const strongScore = expectedScore(1800, 1500);
    const weakScore = expectedScore(1500, 1800);
    expect(strongScore).toBeGreaterThan(weakScore);
    expect(strongScore).toBeGreaterThan(0.5);
    expect(weakScore).toBeLessThan(0.5);
  });

  it("has symmetry: E_a + E_b = 1.0", () => {
    const eloA = 1600;
    const eloB = 1400;
    const scoreA = expectedScore(eloA, eloB);
    const scoreB = expectedScore(eloB, eloA);
    expect(scoreA + scoreB).toBeCloseTo(1.0, 10);
  });

  it("returns very low expected score for much weaker player", () => {
    const score = expectedScore(1000, 2000);
    expect(score).toBeLessThan(0.02);
  });
});

describe("getKFactor", () => {
  it("returns 40 for new player (<30 games)", () => {
    expect(getKFactor(1500, 10)).toBe(40);
    expect(getKFactor(1500, 29)).toBe(40);
  });

  it("returns 32 for default player", () => {
    expect(getKFactor(1500, 30)).toBe(32);
    expect(getKFactor(2400, 30)).toBe(32);
  });

  it("returns 16 for high rated player (>2400 ELO)", () => {
    expect(getKFactor(2401, 30)).toBe(16);
    expect(getKFactor(2800, 100)).toBe(16);
  });
});

describe("calculateEloChange", () => {
  it("white win: white ELO goes up, black goes down", () => {
    const result = calculateEloChange(1500, 1500, "white");
    expect(result.whiteChange).toBeGreaterThan(0);
    expect(result.blackChange).toBeLessThan(0);
    expect(result.whiteNewElo).toBeGreaterThan(1500);
    expect(result.blackNewElo).toBeLessThan(1500);
  });

  it("black win: black ELO goes up, white goes down", () => {
    const result = calculateEloChange(1500, 1500, "black");
    expect(result.blackChange).toBeGreaterThan(0);
    expect(result.whiteChange).toBeLessThan(0);
    expect(result.blackNewElo).toBeGreaterThan(1500);
    expect(result.whiteNewElo).toBeLessThan(1500);
  });

  it("draw between equal players: small or zero changes", () => {
    const result = calculateEloChange(1500, 1500, "draw");
    expect(Math.abs(result.whiteChange)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.blackChange)).toBeLessThanOrEqual(1);
  });

  it("whiteChange + blackChange approximately equals 0 for same K-factor", () => {
    const result = calculateEloChange(1500, 1500, "white");
    expect(result.whiteChange + result.blackChange).toBe(0);
  });

  it("equal players white win: change should be ~16 (K=32 * (1 - 0.5))", () => {
    const result = calculateEloChange(1500, 1500, "white");
    expect(result.whiteChange).toBe(16);
    expect(result.blackChange).toBe(-16);
  });

  it("large rating difference: lower rated player gains more from upset", () => {
    const result = calculateEloChange(1200, 1800, "white");
    expect(result.whiteChange).toBeGreaterThan(16);
  });

  it("new player gets K=40", () => {
    const result = calculateEloChange(1500, 1500, "white", 10, 30);
    // White is new (K=40), so whiteChange = 40 * (1 - 0.5) = 20
    expect(result.whiteChange).toBe(20);
    // Black is experienced (K=32), so blackChange = 32 * (0 - 0.5) = -16
    expect(result.blackChange).toBe(-16);
  });

  it("high rated player gets K=16", () => {
    const result = calculateEloChange(2500, 2500, "white", 100, 100);
    // Both K=16, change = 16 * (1 - 0.5) = 8
    expect(result.whiteChange).toBe(8);
    expect(result.blackChange).toBe(-8);
  });

  it("handles multiple result scenarios with expected values", () => {
    // 1600 vs 1400, white wins
    const whiteWin = calculateEloChange(1600, 1400, "white");
    expect(whiteWin.whiteChange).toBeLessThan(16); // expected to win, so less gain
    expect(whiteWin.blackChange).toBeGreaterThan(-16); // expected to lose, so less penalty

    // 1600 vs 1400, black wins (upset)
    const blackWin = calculateEloChange(1600, 1400, "black");
    expect(blackWin.blackChange).toBeGreaterThan(16); // upset win, more gain
    expect(blackWin.whiteChange).toBeLessThan(-16); // upset loss, more penalty
  });

  it("ELO changes are reasonable for extreme rating difference", () => {
    const result = calculateEloChange(1000, 2000, "white");
    // Massive upset: nearly maximum K gain for white
    expect(result.whiteChange).toBeGreaterThan(30);
    expect(result.blackChange).toBeLessThan(-1);
  });
});
