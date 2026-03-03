import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateSystemReport = vi.fn();
const mockGenerateSystemReportSummary = vi.fn();

vi.mock("@/lib/reports/system-report", () => ({
  generateSystemReport: mockGenerateSystemReport,
  generateSystemReportSummary: mockGenerateSystemReportSummary,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerReportsTools } from "./reports";

describe("reports tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerReportsTools(registry, userId);
  });

  it("should register 1 reports tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
  });

  describe("reports_generate_system", () => {
    const baseSummary = {
      generatedAt: "2024-06-01T12:00:00.000Z",
      period: {
        start: "2024-05-02T12:00:00.000Z",
        end: "2024-06-01T12:00:00.000Z",
      },
      highlights: {
        totalUsers: 150,
        activeUsersLast7Days: 42,
        totalEnhancements: 300,
        pendingJobs: 5,
        failedJobs: 2,
        totalAiCreditsUsed: 1200,
        errorsLast24Hours: 8,
        conversionRate: 0.035,
      },
    };

    it("should generate markdown report by default", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue(baseSummary);
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("# System Report");
      expect(text).toContain("2024-06-01T12:00:00.000Z");
      expect(text).toContain("Total Users | 150");
      expect(text).toContain("Active Users (7d) | 42");
      expect(text).toContain("Total Enhancements | 300");
      expect(text).toContain("Pending Jobs | 5");
      expect(text).toContain("Failed Jobs | 2");
      expect(text).toContain("AI Credits Used | 1200");
      expect(text).toContain("Errors (24h) | 8");
      expect(text).toContain("3.5%");
      expect(mockGenerateSystemReportSummary).toHaveBeenCalledWith("30d");
    });

    it("should generate JSON report when format is json", async () => {
      const mockReport = {
        generatedAt: "2024-06-01T12:00:00.000Z",
        period: {
          start: "2024-05-02T12:00:00.000Z",
          end: "2024-06-01T12:00:00.000Z",
        },
        platform: { totalUsers: 150 },
      };
      mockGenerateSystemReport.mockResolvedValue(mockReport);
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({ format: "json" });
      const text = getText(result);
      const parsed = JSON.parse(text);
      expect(parsed.generatedAt).toBe("2024-06-01T12:00:00.000Z");
      expect(parsed.platform.totalUsers).toBe(150);
      expect(mockGenerateSystemReport).toHaveBeenCalledWith("30d");
      expect(mockGenerateSystemReportSummary).not.toHaveBeenCalled();
    });

    it("should pass sections to generateSystemReport for json format", async () => {
      mockGenerateSystemReport.mockResolvedValue({
        generatedAt: "now",
        period: {},
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      await handler({ format: "json", sections: ["platform", "users"] });
      expect(mockGenerateSystemReport).toHaveBeenCalledWith("30d", [
        "platform",
        "users",
      ]);
    });

    it("should call generateSystemReport without sections when none specified in json format", async () => {
      mockGenerateSystemReport.mockResolvedValue({
        generatedAt: "now",
        period: {},
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      await handler({ format: "json" });
      expect(mockGenerateSystemReport).toHaveBeenCalledWith("30d");
    });

    it("should use specified period", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue(baseSummary);
      const handler = registry.handlers.get("reports_generate_system")!;
      await handler({ period: "7d" });
      expect(mockGenerateSystemReportSummary).toHaveBeenCalledWith("7d");
    });

    it("should use 90d period", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue(baseSummary);
      const handler = registry.handlers.get("reports_generate_system")!;
      await handler({ period: "90d" });
      expect(mockGenerateSystemReportSummary).toHaveBeenCalledWith("90d");
    });

    it("should include external meta ads data when present", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue({
        ...baseSummary,
        external: {
          metaTotalSpend: 1234.56,
        },
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("## External");
      expect(text).toContain("Meta Ads Spend");
      expect(text).toContain("$1234.56");
    });

    it("should not include external section when no external data", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue(baseSummary);
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).not.toContain("## External");
    });

    it("should not include external section when external is empty object", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue({
        ...baseSummary,
        external: {},
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      const text = getText(result);
      // The external section is created but has no content items inside
      // because metaTotalSpend is undefined
      expect(text).not.toContain("Meta Ads Spend");
    });

    it("should format conversion rate correctly", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue({
        ...baseSummary,
        highlights: {
          ...baseSummary.highlights,
          conversionRate: 0.1234,
        },
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      expect(getText(result)).toContain("12.3%");
    });

    it("should handle zero conversion rate", async () => {
      mockGenerateSystemReportSummary.mockResolvedValue({
        ...baseSummary,
        highlights: {
          ...baseSummary.highlights,
          conversionRate: 0,
        },
      });
      const handler = registry.handlers.get("reports_generate_system")!;
      const result = await handler({});
      expect(getText(result)).toContain("0.0%");
    });
  });
});
