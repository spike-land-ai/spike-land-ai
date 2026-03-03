import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListIssues, mockGetDetail, mockGetStats } = vi.hoisted(() => ({
  mockListIssues: vi.fn(),
  mockGetDetail: vi.fn(),
  mockGetStats: vi.fn(),
}));

vi.mock("@/lib/bridges/error-log", () => ({
  listErrorIssues: mockListIssues,
  getErrorDetail: mockGetDetail,
  getErrorStats: mockGetStats,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerSentryBridgeTools } from "./sentry-bridge";

describe("error log bridge tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerSentryBridgeTools(registry, "user-123");
  });

  it("registers 3 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("error_issues")).toBe(true);
    expect(registry.handlers.has("error_detail")).toBe(true);
    expect(registry.handlers.has("error_stats")).toBe(true);
  });

  describe("error_issues", () => {
    it("should list issues", async () => {
      mockListIssues.mockResolvedValue([
        {
          message: "TypeError in handler",
          count: 42,
          firstSeen: "2026-01-01T00:00:00.000Z",
          lastSeen: "2026-02-14T00:00:00.000Z",
          environment: "BACKEND",
          errorType: "TypeError",
        },
      ]);
      const handler = registry.handlers.get("error_issues")!;
      const result = await handler({});
      expect(getText(result)).toContain("TypeError in handler");
      expect(getText(result)).toContain("BACKEND");
      expect(getText(result)).toContain("Count: 42");
    });

    it("should return empty message when no issues found", async () => {
      mockListIssues.mockResolvedValue([]);
      const handler = registry.handlers.get("error_issues")!;
      const result = await handler({});
      expect(getText(result)).toContain("No error issues found");
    });

    it("should pass query and limit to bridge", async () => {
      mockListIssues.mockResolvedValue([]);
      const handler = registry.handlers.get("error_issues")!;
      await handler({ query: "TypeError", limit: 10 });
      expect(mockListIssues).toHaveBeenCalledWith({
        query: "TypeError",
        limit: 10,
      });
    });
  });

  describe("error_detail", () => {
    it("should return error details", async () => {
      mockGetDetail.mockResolvedValue({
        id: "clx123",
        message: "TypeError in handler",
        stack: "Error: TypeError in handler\n  at handler (app/api/route.ts:10)",
        sourceFile: "app/api/route.ts",
        sourceLine: 10,
        sourceColumn: 5,
        callerName: "handler",
        errorType: "TypeError",
        errorCode: null,
        route: "/api/test",
        userId: null,
        environment: "BACKEND",
        metadata: null,
        timestamp: "2026-02-14T00:00:00.000Z",
      });
      const handler = registry.handlers.get("error_detail")!;
      const result = await handler({ error_id: "clx123" });
      expect(getText(result)).toContain("TypeError in handler");
      expect(getText(result)).toContain("app/api/route.ts");
      expect(getText(result)).toContain("BACKEND");
      expect(getText(result)).toContain("clx123");
    });

    it("should return not-found when error is null", async () => {
      mockGetDetail.mockResolvedValue(null);
      const handler = registry.handlers.get("error_detail")!;
      const result = await handler({ error_id: "nonexistent" });
      expect(getText(result)).toContain("Error not found");
    });
  });

  describe("error_stats", () => {
    it("should return stats", async () => {
      mockGetStats.mockResolvedValue({
        last24h: 10,
        last7d: 50,
        last30d: 200,
        byEnvironment: { FRONTEND: 120, BACKEND: 80 },
      });
      const handler = registry.handlers.get("error_stats")!;
      const result = await handler({});
      expect(getText(result)).toContain("Last 24h: 10");
      expect(getText(result)).toContain("Last 7d: 50");
      expect(getText(result)).toContain("Last 30d: 200");
      expect(getText(result)).toContain("FRONTEND: 120");
      expect(getText(result)).toContain("BACKEND: 80");
    });

    it("should return error when stats are null", async () => {
      mockGetStats.mockResolvedValue(null);
      const handler = registry.handlers.get("error_stats")!;
      const result = await handler({});
      expect(getText(result)).toContain("Could not fetch error stats");
    });
  });
});
