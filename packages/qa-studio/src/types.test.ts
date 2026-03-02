import { describe, expect, it } from "vitest";

import {
  isActionError,
  type QaAccessibilityResult,
  type QaActionError,
  type QaCoverageResult,
  type QaEvaluateResult,
  type QaNavigateResult,
  type QaNetworkRequest,
  type QaNetworkResult,
  type QaScreenshotResult,
  type QaTabInfo,
  type QaTestResult,
  type QaViewportResult,
} from "./types.js";

describe("isActionError", () => {
  it("returns true for object with error property", () => {
    const result: QaActionError = { error: "something went wrong" };
    expect(isActionError(result)).toBe(true);
  });

  it("returns true for object with extra properties alongside error", () => {
    expect(isActionError({ error: "fail", extra: 42 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isActionError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isActionError(undefined)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isActionError("error string")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isActionError(42)).toBe(false);
  });

  it("returns false for an object without error property", () => {
    expect(isActionError({ url: "https://example.com", title: "Example" })).toBe(false);
  });

  it("returns false for an empty object", () => {
    expect(isActionError({})).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isActionError([])).toBe(false);
  });

  it("returns true when error value is empty string", () => {
    expect(isActionError({ error: "" })).toBe(true);
  });

  it("returns true when error value is 0 (falsy non-string)", () => {
    expect(isActionError({ error: 0 })).toBe(true);
  });
});

describe("type shape validation", () => {
  it("QaNavigateResult has url and title", () => {
    const result: QaNavigateResult = { url: "https://example.com", title: "Example" };
    expect(result.url).toBe("https://example.com");
    expect(result.title).toBe("Example");
  });

  it("QaScreenshotResult has base64, url, and fullPage", () => {
    const result: QaScreenshotResult = {
      base64: "abc123==",
      url: "https://example.com",
      fullPage: true,
    };
    expect(result.base64).toBe("abc123==");
    expect(result.fullPage).toBe(true);
  });

  it("QaAccessibilityResult has score, violations, and standard", () => {
    const result: QaAccessibilityResult = {
      score: 85,
      violations: [{ issue: "missing alt text", impact: "serious" }],
      standard: "WCAG2AA",
    };
    expect(result.score).toBe(85);
    expect(result.violations).toHaveLength(1);
    expect(result.standard).toBe("WCAG2AA");
  });

  it("QaAccessibilityResult with no violations", () => {
    const result: QaAccessibilityResult = {
      score: 100,
      violations: [],
      standard: "WCAG2A",
    };
    expect(result.violations).toHaveLength(0);
  });

  it("QaNetworkRequest has all required fields", () => {
    const req: QaNetworkRequest = {
      url: "https://api.example.com/data",
      method: "GET",
      resourceType: "fetch",
      status: 200,
      contentLength: "1234",
    };
    expect(req.method).toBe("GET");
    expect(req.status).toBe(200);
    expect(req.resourceType).toBe("fetch");
  });

  it("QaNetworkResult aggregates requests with totalSize and errorCount", () => {
    const result: QaNetworkResult = {
      requests: [],
      totalSize: 0,
      errorCount: 0,
    };
    expect(result.requests).toHaveLength(0);
    expect(result.errorCount).toBe(0);
  });

  it("QaNetworkResult with multiple requests", () => {
    const result: QaNetworkResult = {
      requests: [
        {
          url: "https://example.com/a",
          method: "GET",
          resourceType: "document",
          status: 200,
          contentLength: "500",
        },
        {
          url: "https://example.com/b",
          method: "POST",
          resourceType: "fetch",
          status: 500,
          contentLength: "0",
        },
      ],
      totalSize: 500,
      errorCount: 1,
    };
    expect(result.requests).toHaveLength(2);
    expect(result.errorCount).toBe(1);
  });

  it("QaViewportResult has width, height, preset", () => {
    const result: QaViewportResult = {
      width: 1280,
      height: 720,
      preset: "desktop",
    };
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.preset).toBe("desktop");
  });

  it("QaEvaluateResult has output and expression", () => {
    const result: QaEvaluateResult = {
      output: "42",
      expression: "1 + 41",
    };
    expect(result.output).toBe("42");
    expect(result.expression).toBe("1 + 41");
  });

  it("QaTabInfo has index, url, title", () => {
    const tab: QaTabInfo = { index: 0, url: "about:blank", title: "" };
    expect(tab.index).toBe(0);
    expect(tab.url).toBe("about:blank");
  });

  it("QaTestResult has passed, output, target", () => {
    const result: QaTestResult = { passed: true, output: "All tests passed", target: "homepage" };
    expect(result.passed).toBe(true);
    expect(result.target).toBe("homepage");
  });

  it("QaCoverageResult has required fields without optional coverage numbers", () => {
    const result: QaCoverageResult = {
      target: "src/index.ts",
      raw: "{}",
    };
    expect(result.target).toBe("src/index.ts");
    expect(result.statements).toBeUndefined();
    expect(result.branches).toBeUndefined();
    expect(result.functions).toBeUndefined();
    expect(result.lines).toBeUndefined();
  });

  it("QaCoverageResult with all optional coverage numbers", () => {
    const result: QaCoverageResult = {
      target: "src/main.ts",
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 91,
      raw: "{}",
    };
    expect(result.statements).toBe(90);
    expect(result.branches).toBe(85);
    expect(result.functions).toBe(95);
    expect(result.lines).toBe(91);
  });
});
