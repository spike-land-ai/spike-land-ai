import { describe, expect, it } from "vitest";
import { TIME_CONTROL_MS } from "./types";

describe("chess/types", () => {
  describe("TIME_CONTROL_MS", () => {
    it("should have BULLET_1 as 60 seconds", () => {
      expect(TIME_CONTROL_MS["BULLET_1"]).toBe(60_000);
    });

    it("should have BULLET_2 as 120 seconds", () => {
      expect(TIME_CONTROL_MS["BULLET_2"]).toBe(120_000);
    });

    it("should have BLITZ_3 as 180 seconds", () => {
      expect(TIME_CONTROL_MS["BLITZ_3"]).toBe(180_000);
    });

    it("should have BLITZ_5 as 300 seconds", () => {
      expect(TIME_CONTROL_MS["BLITZ_5"]).toBe(300_000);
    });

    it("should have RAPID_10 as 600 seconds", () => {
      expect(TIME_CONTROL_MS["RAPID_10"]).toBe(600_000);
    });

    it("should have RAPID_15 as 900 seconds", () => {
      expect(TIME_CONTROL_MS["RAPID_15"]).toBe(900_000);
    });

    it("should have CLASSICAL_30 as 1800 seconds", () => {
      expect(TIME_CONTROL_MS["CLASSICAL_30"]).toBe(1_800_000);
    });

    it("should have UNLIMITED as 0", () => {
      expect(TIME_CONTROL_MS["UNLIMITED"]).toBe(0);
    });

    it("should have exactly 8 time controls", () => {
      expect(Object.keys(TIME_CONTROL_MS)).toHaveLength(8);
    });

    it("should have all values as non-negative numbers", () => {
      for (const [, ms] of Object.entries(TIME_CONTROL_MS)) {
        expect(ms).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
