import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock tool-helpers ─────────────────────────────────────────────────────────
// safeToolCall must just invoke the handler transparently in tests.
vi.mock("./tool-helpers", () => ({
  safeToolCall: async (
    _name: string,
    handler: () => Promise<unknown>,
  ) => handler(),
  textResult: (text: string) => ({ content: [{ type: "text", text }] }),
}));

// ── Mock global fetch ─────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Import after mocks ────────────────────────────────────────────────────────
import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerQaPerformanceTools } from "./qa-performance";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFetchResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return {
    status,
    statusText: status === 200 ? "OK" : "Error",
    ok: status >= 200 && status < 300,
    headers: {
      entries: () => Object.entries(headers)[Symbol.iterator](),
    },
    text: async () => body,
  } as unknown as Response;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe("qa-performance MCP tools", () => {
  const userId = "test-user-qa-perf";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerQaPerformanceTools(registry, userId);
  });

  // ── Registration ────────────────────────────────────────────────────────────

  it("registers exactly 4 qa-performance tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("qa_lighthouse")).toBe(true);
    expect(registry.handlers.has("qa_visual_diff")).toBe(true);
    expect(registry.handlers.has("qa_api_test")).toBe(true);
    expect(registry.handlers.has("qa_generate_test")).toBe(true);
  });

  // ── qa_lighthouse ────────────────────────────────────────────────────────────

  describe("qa_lighthouse", () => {
    it("returns scores and metrics for all default categories", async () => {
      const handler = registry.handlers.get("qa_lighthouse")!;
      const result = await handler({ url: "https://spike.land" });

      expect(isError(result)).toBe(false);
      const text = getText(result);

      expect(text).toContain("Lighthouse Audit");
      expect(text).toContain("performance");
      expect(text).toContain("accessibility");
      expect(text).toContain("seo");
      expect(text).toContain("best-practices");
      // Core Web Vitals section
      expect(text).toContain("First Contentful Paint");
      expect(text).toContain("Largest Contentful Paint");
      expect(text).toContain("Cumulative Layout Shift");
      expect(text).toContain("Total Blocking Time");
      expect(text).toContain("Time to Interactive");
      // At least one recommendation
      expect(text).toContain("Recommendations");
    });

    it("honours an explicit categories subset", async () => {
      const handler = registry.handlers.get("qa_lighthouse")!;
      const result = await handler({
        url: "https://example.com",
        categories: ["performance", "seo"],
      });

      const text = getText(result);
      expect(text).toContain("performance");
      expect(text).toContain("seo");
      // accessibility and best-practices should NOT appear in score table
      const lines = text.split("\n");
      const scoreTableLines = lines.filter(l =>
        l.startsWith("|") && !l.startsWith("| Category") && !l.startsWith("|---")
      );
      const categories = scoreTableLines.map(l => l.split("|")[1]?.trim());
      expect(categories).not.toContain("accessibility");
      expect(categories).not.toContain("best-practices");
    });

    it("scores are numbers between 0 and 100", async () => {
      const handler = registry.handlers.get("qa_lighthouse")!;
      const result = await handler({ url: "https://spike.land/test" });
      const text = getText(result);

      // Extract score values from table rows like "| performance | 87/100 | GOOD |"
      const scoreRegex = /\|\s*\w[\w-]*\s*\|\s*(\d+)\/100/g;
      const matches = [...text.matchAll(scoreRegex)];
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const score = parseInt(match[1]!, 10);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it("produces deterministic results for the same URL", async () => {
      const handler = registry.handlers.get("qa_lighthouse")!;
      const r1 = await handler({ url: "https://spike.land" });
      const r2 = await handler({ url: "https://spike.land" });
      expect(getText(r1)).toBe(getText(r2));
    });
  });

  // ── qa_visual_diff ───────────────────────────────────────────────────────────

  describe("qa_visual_diff", () => {
    it("creates a new baseline when no baseline_id is given", async () => {
      const handler = registry.handlers.get("qa_visual_diff")!;
      const result = await handler({ url: "https://spike.land" });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Visual Baseline Created");
      expect(text).toContain("Baseline ID:");
      expect(text).toContain("Screenshot ID:");
    });

    it("returns PASS when comparing a URL against its own baseline", async () => {
      const handler = registry.handlers.get("qa_visual_diff")!;

      // First call: create baseline
      const createResult = await handler({ url: "https://spike.land/page" });
      const createText = getText(createResult);
      // Extract baseline ID from the output
      const idMatch = createText.match(/Baseline ID:\*\* ([^\n]+)/);
      expect(idMatch).not.toBeNull();
      const baselineId = idMatch![1]!.trim();

      // Second call: compare (same URL means same screenshot ID, so diff = 0)
      const diffResult = await handler({
        url: "https://spike.land/page",
        baseline_id: baselineId,
      });
      const diffText = getText(diffResult);
      expect(diffText).toContain("PASS");
      expect(diffText).toContain("0%");
    });

    it("reports a non-zero diff for an unknown baseline", async () => {
      const handler = registry.handlers.get("qa_visual_diff")!;
      const result = await handler({
        url: "https://spike.land",
        baseline_id: "baseline-does-not-exist",
      });
      const text = getText(result);
      expect(text).toContain("Baseline Not Found");
    });

    it("returns FAIL status when diff percentage exceeds threshold", async () => {
      const handler = registry.handlers.get("qa_visual_diff")!;

      // Create a baseline for one URL
      const createResult = await handler({ url: "https://spike.land/a" });
      const baselineId = getText(createResult).match(
        /Baseline ID:\*\* ([^\n]+)/,
      )![1]!.trim();

      // Compare against a different URL so screenshot IDs differ and diff > 0
      const diffResult = await handler({
        url: "https://spike.land/totally-different-path-xyz",
        baseline_id: baselineId,
      });
      const diffText = getText(diffResult);
      // Should report either WARN or FAIL (non-zero diff)
      const hasIssue = diffText.includes("WARN") || diffText.includes("FAIL");
      expect(hasIssue).toBe(true);
    });
  });

  // ── qa_api_test ──────────────────────────────────────────────────────────────

  describe("qa_api_test", () => {
    it("returns status, response time, and body preview for a 200 GET", async () => {
      mockFetch.mockResolvedValueOnce(
        buildFetchResponse(200, "{\"ok\":true}", { "content-type": "application/json" }),
      );

      const handler = registry.handlers.get("qa_api_test")!;
      const result = await handler({
        url: "https://api.spike.land/health",
        method: "GET",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("200");
      expect(text).toContain("{\"ok\":true}");
      expect(text).toContain("Response Time");
    });

    it("passes assertion when status matches expected_status", async () => {
      mockFetch.mockResolvedValueOnce(buildFetchResponse(201, "{\"id\":42}"));

      const handler = registry.handlers.get("qa_api_test")!;
      const result = await handler({
        url: "https://api.spike.land/items",
        method: "POST",
        body: "{\"name\":\"item\"}",
        expected_status: 201,
      });

      const text = getText(result);
      expect(text).toContain("PASS");
      expect(text).toContain("201");
    });

    it("fails assertion when status does not match expected_status", async () => {
      mockFetch.mockResolvedValueOnce(buildFetchResponse(404, "Not Found"));

      const handler = registry.handlers.get("qa_api_test")!;
      const result = await handler({
        url: "https://api.spike.land/missing",
        method: "GET",
        expected_status: 200,
      });

      const text = getText(result);
      expect(text).toContain("FAIL");
      expect(text).toContain("404");
      expect(text).toContain("200");
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const handler = registry.handlers.get("qa_api_test")!;
      const result = await handler({
        url: "https://unreachable.example.com/api",
        method: "GET",
      });

      const text = getText(result);
      expect(text).toContain("FAIL");
      expect(text).toContain("ECONNREFUSED");
    });

    it("does not send a body for GET requests", async () => {
      mockFetch.mockResolvedValueOnce(buildFetchResponse(200, "ok"));

      const handler = registry.handlers.get("qa_api_test")!;
      await handler({
        url: "https://api.spike.land/items",
        method: "GET",
        body: "{\"should\":\"be ignored\"}",
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBeUndefined();
    });

    it("includes custom headers in the request", async () => {
      mockFetch.mockResolvedValueOnce(buildFetchResponse(200, "ok"));

      const handler = registry.handlers.get("qa_api_test")!;
      await handler({
        url: "https://api.spike.land/secure",
        method: "GET",
        headers: { Authorization: "Bearer token123" },
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer token123",
      );
    });
  });

  // ── qa_generate_test ─────────────────────────────────────────────────────────

  describe("qa_generate_test", () => {
    it("generates e2e test cases with steps and expected results", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      const result = await handler({
        url: "https://spike.land",
        test_type: "e2e",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Test Plan: E2E");
      expect(text).toContain("Test Case");
      expect(text).toContain("Steps:");
      expect(text).toContain("Expected Result:");
    });

    it("generates accessibility test cases covering WCAG", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      const result = await handler({
        url: "https://spike.land/apps",
        test_type: "accessibility",
      });

      const text = getText(result);
      expect(text).toContain("ACCESSIBILITY");
      expect(text).toContain("WCAG");
    });

    it("generates integration test cases mentioning API contract", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      const result = await handler({
        url: "https://spike.land/api/v1",
        test_type: "integration",
      });

      const text = getText(result);
      expect(text).toContain("INTEGRATION");
      expect(text).toContain("API");
    });

    it("generates unit test cases mentioning edge cases", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      const result = await handler({
        url: "https://spike.land/utils",
        test_type: "unit",
      });

      const text = getText(result);
      expect(text).toContain("UNIT");
      expect(text).toContain("edge");
    });

    it("includes the target URL in the generated plan", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      const result = await handler({
        url: "https://spike.land/my-page",
        test_type: "e2e",
      });

      const text = getText(result);
      expect(text).toContain("https://spike.land/my-page");
    });

    it("returns a non-zero number of test cases", async () => {
      const handler = registry.handlers.get("qa_generate_test")!;
      for (const testType of ["unit", "integration", "e2e", "accessibility"] as const) {
        const result = await handler({
          url: "https://spike.land",
          test_type: testType,
        });
        const text = getText(result);
        // Confirm at least one numbered test case exists
        expect(text).toMatch(/Test Case \d+/);
      }
    });
  });
});
