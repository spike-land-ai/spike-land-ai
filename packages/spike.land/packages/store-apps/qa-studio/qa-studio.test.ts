/**
 * QA Studio Standalone Tools — Tests
 */

import { describe, expect, it, vi } from "vitest";
import { createMockContext, createMockRegistry } from "../shared/test-utils";
import { qaStudioTools } from "./tools";

// Mock browser session — most QA tools need an active browser tab
vi.mock("@/lib/qa-studio/browser-session", () => ({
  getOrCreateTab: vi.fn().mockResolvedValue({
    page: {
      goto: vi.fn().mockResolvedValue(undefined),
      title: vi.fn().mockResolvedValue("Test Page"),
      url: vi.fn().mockReturnValue("https://example.com"),
      screenshot: vi.fn().mockResolvedValue("base64data"),
      locator: vi.fn().mockReturnValue({
        screenshot: vi.fn().mockResolvedValue("base64data"),
      }),
      evaluate: vi.fn().mockResolvedValue([]),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
    },
    index: 0,
    entry: {
      consoleMessages: [
        { type: "error", text: "test error", url: "https://example.com", line: 1 },
        { type: "info", text: "test info", url: "https://example.com", line: 2 },
      ],
      networkRequests: [
        {
          method: "GET",
          status: 200,
          url: "https://example.com/api",
          resourceType: "xhr",
          contentLength: "1234",
        },
        {
          method: "GET",
          status: 404,
          url: "https://example.com/missing",
          resourceType: "xhr",
          contentLength: "0",
        },
      ],
    },
  }),
  getActiveTab: vi.fn().mockReturnValue({
    page: {
      url: vi.fn().mockReturnValue("https://example.com"),
      screenshot: vi.fn().mockResolvedValue("base64data"),
      locator: vi.fn().mockReturnValue({
        screenshot: vi.fn().mockResolvedValue("base64data"),
      }),
      evaluate: vi.fn().mockResolvedValue([]),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
    },
    index: 0,
    entry: {
      consoleMessages: [
        { type: "error", text: "test error", url: "https://example.com", line: 1 },
        { type: "info", text: "test info", url: "https://example.com", line: 2 },
      ],
      networkRequests: [
        {
          method: "GET",
          status: 200,
          url: "https://example.com/api",
          resourceType: "xhr",
          contentLength: "1234",
        },
        {
          method: "GET",
          status: 404,
          url: "https://example.com/missing",
          resourceType: "xhr",
          contentLength: "0",
        },
      ],
    },
  }),
  listTabs: vi.fn().mockResolvedValue([{ index: 0, title: "Tab 1", url: "https://example.com" }]),
  closeTab: vi.fn().mockResolvedValue(true),
}));

describe("qa-studio standalone tools", () => {
  const registry = createMockRegistry(qaStudioTools);
  const ctx = createMockContext();

  it("exports expected tool count", () => {
    // 11 qa-studio + 4 qa-performance = 15
    expect(registry.getToolNames().length).toBe(15);
  });

  it("has qa-studio category tools", () => {
    const studioTools = registry.getToolsByCategory("qa-studio");
    expect(studioTools.length).toBe(11);
  });

  it("has qa-performance category tools", () => {
    const perfTools = registry.getToolsByCategory("qa-performance");
    expect(perfTools.length).toBe(4);
  });

  describe("qa_navigate", () => {
    it("navigates to a URL", async () => {
      const result = await registry.call("qa_navigate", { url: "https://example.com" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Navigation Complete");
    });
  });

  describe("qa_screenshot", () => {
    it("captures a screenshot", async () => {
      const result = await registry.call("qa_screenshot", { fullPage: false }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Screenshot Captured");
    });
  });

  describe("qa_accessibility", () => {
    it("runs an audit", async () => {
      const result = await registry.call("qa_accessibility", { standard: "wcag2aa" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Accessibility Audit");
      expect(text).toContain("Score");
    });
  });

  describe("qa_console", () => {
    it("captures console messages", async () => {
      const result = await registry.call("qa_console", { level: "error" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Console Messages");
      expect(text).toContain("test error");
    });
  });

  describe("qa_network", () => {
    it("shows network requests", async () => {
      const result = await registry.call("qa_network", { includeStatic: false }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Network Requests");
    });
  });

  describe("qa_viewport", () => {
    it("sets viewport with preset", async () => {
      const result = await registry.call("qa_viewport", { preset: "mobile" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Viewport Updated");
      expect(text).toContain("375x812");
    });
  });

  describe("qa_evaluate", () => {
    it("evaluates JavaScript", async () => {
      const result = await registry.call("qa_evaluate", { expression: "document.title" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Evaluate Result");
    });
  });

  describe("qa_tabs", () => {
    it("lists tabs", async () => {
      const result = await registry.call("qa_tabs", { action: "list" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Browser Tabs");
    });
  });

  describe("qa_test_run", () => {
    it("rejects invalid paths", async () => {
      const result = await registry.call("qa_test_run", { target: "../../../etc/passwd" }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe("qa_lighthouse", () => {
    it("returns audit scores for a URL", async () => {
      const result = await registry.call("qa_lighthouse", { url: "https://example.com" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Lighthouse Audit");
      expect(text).toContain("Core Web Vitals");
    });
  });

  describe("qa_visual_diff", () => {
    it("creates a new baseline when no baseline_id provided", async () => {
      const result = await registry.call("qa_visual_diff", { url: "https://example.com" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Visual Baseline Created");
      expect(text).toContain("Baseline ID");
    });

    it("reports baseline not found for unknown ID", async () => {
      const result = await registry.call(
        "qa_visual_diff",
        { url: "https://example.com", baseline_id: "nonexistent" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Baseline Not Found");
    });
  });

  describe("qa_api_test", () => {
    it("tests an API endpoint", async () => {
      // This makes a real fetch; mock it
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: vi.fn().mockResolvedValue('{"hello":"world"}'),
        headers: new Headers({ "content-type": "application/json" }),
      }) as unknown as typeof fetch;

      try {
        const result = await registry.call(
          "qa_api_test",
          { url: "https://example.com/api", method: "GET", expected_status: 200 },
          ctx,
        );
        expect(result.isError).toBeFalsy();
        const text = (result.content[0] as { text: string }).text;
        expect(text).toContain("API Test Result");
        expect(text).toContain("PASS");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("qa_generate_test", () => {
    it("generates e2e test plan", async () => {
      const result = await registry.call(
        "qa_generate_test",
        { url: "https://example.com", test_type: "e2e" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Test Plan");
      expect(text).toContain("Test Case");
    });

    it("generates accessibility test plan", async () => {
      const result = await registry.call(
        "qa_generate_test",
        { url: "https://example.com", test_type: "accessibility" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("ACCESSIBILITY");
    });
  });
});
