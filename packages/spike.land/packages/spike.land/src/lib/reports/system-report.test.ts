import { describe, expect, it } from "vitest";
import { getDateRangeForPeriod } from "./system-report";

describe("reports/system-report", () => {
  describe("getDateRangeForPeriod", () => {
    it("should return a 7-day range for '7d'", () => {
      const before = Date.now();
      const { startDate, endDate } = getDateRangeForPeriod("7d");
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
      expect(endDate.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("should return a 30-day range for '30d'", () => {
      const { startDate, endDate } = getDateRangeForPeriod("30d");
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it("should return a 90-day range for '90d'", () => {
      const { startDate, endDate } = getDateRangeForPeriod("90d");
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(90, 0);
    });

    it("should return endDate >= startDate", () => {
      const { startDate, endDate } = getDateRangeForPeriod("7d");
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });
  });
});
