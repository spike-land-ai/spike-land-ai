import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock playwright ───────────────────────────────────────────
const mockGoto = vi.fn();
const mockTitle = vi.fn();
const mockUrl = vi.fn();
const mockScreenshot = vi.fn();
const mockEvaluate = vi.fn();
const mockSetViewportSize = vi.fn();
const mockClose = vi.fn();
const mockIsClosed = vi.fn().mockReturnValue(false);
const mockLocatorScreenshot = vi.fn();

const mockPage = {
  goto: mockGoto,
  title: mockTitle,
  url: mockUrl,
  screenshot: mockScreenshot,
  evaluate: mockEvaluate,
  setViewportSize: mockSetViewportSize,
  close: mockClose,
  isClosed: mockIsClosed,
  locator: vi.fn().mockReturnValue({ screenshot: mockLocatorScreenshot }),
  on: vi.fn(),
};

const mockNewPage = vi.fn().mockResolvedValue(mockPage);
const mockBrowserClose = vi.fn();
const mockIsConnected = vi.fn().mockReturnValue(true);

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: mockNewPage,
      close: mockBrowserClose,
      isConnected: mockIsConnected,
    }),
  },
}));

// ── Mock browser-session ──────────────────────────────────────
// We mock the session module to control tab behavior without real Playwright
const mockGetOrCreateTab = vi.fn();
const mockGetActiveTab = vi.fn();
const mockListTabs = vi.fn();
const mockCloseTab = vi.fn();

vi.mock("@/lib/qa-studio/browser-session", () => ({
  getOrCreateTab: (...args: unknown[]) => mockGetOrCreateTab(...args),
  getActiveTab: (...args: unknown[]) => mockGetActiveTab(...args),
  listTabs: (...args: unknown[]) => mockListTabs(...args),
  closeTab: (...args: unknown[]) => mockCloseTab(...args),
  cleanup: vi.fn(),
}));

// ── Mock node:child_process ───────────────────────────────────
const mockExecFileSync = vi.fn();
vi.mock("node:child_process", async importOriginal => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const mocked = {
    ...actual,
    execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  };
  return { ...mocked, default: mocked };
});

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerQaStudioTools } from "./qa-studio";

// Default tab entry for tests
function makeTabEntry(): {
  page: typeof mockPage | null;
  entry: {
    consoleMessages: Array<
      { type: string; text: string; url: string; line: number; }
    >;
    networkRequests: Array<
      {
        url: string;
        method: string;
        resourceType: string;
        status: number;
        contentLength: string;
      }
    >;
  };
  index: number;
} {
  return {
    page: mockPage,
    entry: {
      consoleMessages: [] as Array<
        { type: string; text: string; url: string; line: number; }
      >,
      networkRequests: [] as Array<{
        url: string;
        method: string;
        resourceType: string;
        status: number;
        contentLength: string;
      }>,
    },
    index: 0,
  };
}

describe("qa-studio tools", () => {
  const userId = "test-user";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerQaStudioTools(registry, userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register 11 QA Studio tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(11);
    const names = [
      "qa_navigate",
      "qa_screenshot",
      "qa_accessibility",
      "qa_console",
      "qa_network",
      "qa_viewport",
      "qa_evaluate",
      "qa_tabs",
      "qa_test_run",
      "qa_coverage",
      "qa_mobile_audit",
    ];
    for (const name of names) {
      expect(registry.handlers.has(name)).toBe(true);
    }
  });

  it("should register all tools as alwaysEnabled in qa-studio category", () => {
    const mockRegister = registry.register as ReturnType<typeof vi.fn>;
    for (const call of mockRegister.mock.calls) {
      const def = call[0] as {
        category: string;
        tier: string;
        alwaysEnabled: boolean;
      };
      expect(def.category).toBe("qa-studio");
      expect(def.tier).toBe("free");
      expect(def.alwaysEnabled).toBe(true);
    }
  });

  // ── qa_navigate ─────────────────────────────────────────────

  describe("qa_navigate", () => {
    it("should navigate and return page info", async () => {
      const tab = makeTabEntry();
      mockGetOrCreateTab.mockResolvedValue(tab);
      mockGoto.mockResolvedValue(undefined);
      mockTitle.mockResolvedValue("Example Page");
      mockUrl.mockReturnValue("https://example.com/");

      const handler = registry.handlers.get("qa_navigate")!;
      const result = await handler({ url: "https://example.com" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Navigation Complete");
      expect(getText(result)).toContain("Example Page");
      expect(getText(result)).toContain("https://example.com/");
    });

    it("should return error on navigation failure", async () => {
      mockGetOrCreateTab.mockRejectedValue(
        new Error("net::ERR_CONNECTION_REFUSED"),
      );

      const handler = registry.handlers.get("qa_navigate")!;
      const result = await handler({ url: "https://example.com" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Navigation failed");
    });
  });

  // ── qa_screenshot ───────────────────────────────────────────

  describe("qa_screenshot", () => {
    it("should capture viewport screenshot", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockUrl.mockReturnValue("https://example.com");
      mockScreenshot.mockResolvedValue("iVBORw0KGgoAAAA==");

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Screenshot Captured");
      expect(getText(result)).toContain("iVBORw0KGgoAAAA==");
    });

    it("should capture full page screenshot", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockUrl.mockReturnValue("https://example.com");
      mockScreenshot.mockResolvedValue("base64data");

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({ fullPage: true });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Full Page:** true");
    });

    it("should capture element screenshot by selector", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockUrl.mockReturnValue("https://example.com");
      mockLocatorScreenshot.mockResolvedValue("element-base64");

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({ selector: "#hero" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("element-base64");
      expect(getText(result)).toContain("#hero");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No active browser tab");
    });
  });

  // ── qa_accessibility ────────────────────────────────────────

  describe("qa_accessibility", () => {
    it("should return 100 score when no violations", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      // The new implementation calls page.evaluate which runs DOM queries
      // and returns an array of issues directly
      mockEvaluate.mockResolvedValue([]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Score:** 100/100");
      expect(getText(result)).toContain("Violations:** 0");
    });

    it("should detect missing alt text on images", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([
        { issue: "Image missing alt text", impact: "serious" },
      ]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Image missing alt text");
      expect(getText(result)).toContain("SERIOUS");
    });

    it("should detect missing link names", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([
        { issue: "Link missing accessible name", impact: "serious" },
      ]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Link missing accessible name");
    });

    it("should detect missing button names", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([
        { issue: "Button missing accessible name", impact: "serious" },
      ]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Button missing accessible name");
    });

    it("should report page missing h1 heading", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([
        { issue: "Page missing h1 heading", impact: "serious" },
      ]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Page missing h1 heading");
      expect(getText(result)).toContain("SERIOUS");
    });

    it("should use specified standard", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([]);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({ standard: "wcag21aa" });
      expect(getText(result)).toContain("Standard:** wcag21aa");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
    });
  });

  // ── qa_console ──────────────────────────────────────────────

  describe("qa_console", () => {
    it("should return console messages", async () => {
      const tab = makeTabEntry();
      tab.entry.consoleMessages = [
        { type: "error", text: "Something broke", url: "app.js", line: 42 },
        { type: "info", text: "Loaded", url: "", line: 0 },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_console")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Something broke");
      expect(getText(result)).toContain("Loaded");
    });

    it("should filter by error level", async () => {
      const tab = makeTabEntry();
      tab.entry.consoleMessages = [
        { type: "error", text: "Err msg", url: "", line: 0 },
        { type: "info", text: "Info msg", url: "", line: 0 },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_console")!;
      const result = await handler({ level: "error" });
      expect(getText(result)).toContain("Err msg");
      expect(getText(result)).not.toContain("Info msg");
    });

    it("should handle warn type as warning", async () => {
      const tab = makeTabEntry();
      tab.entry.consoleMessages = [
        { type: "warn", text: "Deprecation", url: "", line: 0 },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_console")!;
      const result = await handler({ level: "warning" });
      expect(getText(result)).toContain("Deprecation");
    });

    it("should return empty message when no messages", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_console")!;
      const result = await handler({});
      expect(getText(result)).toContain("No messages");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_console")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
    });
  });

  // ── qa_network ──────────────────────────────────────────────

  describe("qa_network", () => {
    it("should return network requests", async () => {
      const tab = makeTabEntry();
      tab.entry.networkRequests = [
        {
          url: "https://api.example.com/data",
          method: "GET",
          resourceType: "xhr",
          status: 200,
          contentLength: "1024",
        },
        {
          url: "https://example.com/logo.png",
          method: "GET",
          resourceType: "image",
          status: 200,
          contentLength: "5000",
        },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_network")!;
      const result = await handler({});
      // Without includeStatic, should filter out images
      expect(getText(result)).toContain("api.example.com");
      expect(getText(result)).not.toContain("logo.png");
    });

    it("should include static resources when requested", async () => {
      const tab = makeTabEntry();
      tab.entry.networkRequests = [
        {
          url: "https://example.com/logo.png",
          method: "GET",
          resourceType: "image",
          status: 200,
          contentLength: "5000",
        },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_network")!;
      const result = await handler({ includeStatic: true });
      expect(getText(result)).toContain("logo.png");
    });

    it("should count errors", async () => {
      const tab = makeTabEntry();
      tab.entry.networkRequests = [
        {
          url: "https://api.example.com/fail",
          method: "POST",
          resourceType: "xhr",
          status: 500,
          contentLength: "0",
        },
        {
          url: "https://api.example.com/ok",
          method: "GET",
          resourceType: "xhr",
          status: 200,
          contentLength: "100",
        },
      ];
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_network")!;
      const result = await handler({});
      expect(getText(result)).toContain("Errors (4xx/5xx):** 1");
    });

    it("should return empty message when no requests", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_network")!;
      const result = await handler({});
      expect(getText(result)).toContain("No requests captured");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_network")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
    });
  });

  // ── qa_viewport ─────────────────────────────────────────────

  describe("qa_viewport", () => {
    it("should set mobile preset", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "mobile" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("375x812");
      expect(getText(result)).toContain("mobile");
    });

    it("should set tablet preset", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "tablet" });
      expect(getText(result)).toContain("768x1024");
    });

    it("should set desktop preset", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "desktop" });
      expect(getText(result)).toContain("1440x900");
    });

    it("should set custom dimensions", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ width: 800, height: 600 });
      expect(getText(result)).toContain("800x600");
      expect(getText(result)).toContain("custom");
    });

    it("should error without preset or dimensions", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Provide either a preset");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "mobile" });
      expect(isError(result)).toBe(true);
    });
  });

  // ── qa_evaluate ─────────────────────────────────────────────

  describe("qa_evaluate", () => {
    it("should evaluate expression and return result", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue({ title: "Hello" });

      const handler = registry.handlers.get("qa_evaluate")!;
      const result = await handler({ expression: "document.title" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Evaluate Result");
      expect(getText(result)).toContain("Hello");
    });

    it("should handle string results", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue("hello world");

      const handler = registry.handlers.get("qa_evaluate")!;
      const result = await handler({ expression: "'hello world'" });
      expect(getText(result)).toContain("hello world");
    });

    it("should handle evaluation errors", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockRejectedValue(
        new Error("ReferenceError: foo is not defined"),
      );

      const handler = registry.handlers.get("qa_evaluate")!;
      const result = await handler({ expression: "foo.bar" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Evaluation failed");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_evaluate")!;
      const result = await handler({ expression: "1+1" });
      expect(isError(result)).toBe(true);
    });
  });

  // ── qa_tabs ─────────────────────────────────────────────────

  describe("qa_tabs", () => {
    it("should list open tabs", async () => {
      mockListTabs.mockResolvedValue([
        { index: 0, url: "https://example.com", title: "Example" },
        { index: 1, url: "https://google.com", title: "Google" },
      ]);
      mockGetActiveTab.mockReturnValue({ index: 0 });

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "list" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Browser Tabs (2)");
      expect(getText(result)).toContain("Example");
      expect(getText(result)).toContain("Google");
    });

    it("should show empty tabs message", async () => {
      mockListTabs.mockResolvedValue([]);

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "list" });
      expect(getText(result)).toContain("No open tabs");
    });

    it("should switch tab", async () => {
      mockGetOrCreateTab.mockResolvedValue({ index: 2 });

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "switch", index: 2 });
      expect(getText(result)).toContain("Switched to tab 2");
    });

    it("should error on switch without index", async () => {
      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "switch" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tab index required");
    });

    it("should close tab", async () => {
      mockCloseTab.mockResolvedValue(true);

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "close", index: 1 });
      expect(getText(result)).toContain("Closed tab 1");
    });

    it("should error closing nonexistent tab", async () => {
      mockCloseTab.mockResolvedValue(false);

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "close", index: 99 });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should error on close without index", async () => {
      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "close" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tab index required");
    });
  });

  // ── qa_test_run ─────────────────────────────────────────────

  describe("qa_test_run", () => {
    it("should return PASS when tests succeed", async () => {
      mockExecFileSync.mockReturnValue("Tests passed\n 5 passed\n");

      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Test Results: PASS");
    });

    it("should return FAIL when tests fail", async () => {
      const err = new Error("Tests failed") as Error & { stdout?: string; };
      err.stdout = "FAIL src/test.ts\n Expected true, got false";
      mockExecFileSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Test Results: FAIL");
    });

    it("should reject invalid paths", async () => {
      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: "../../../etc/passwd" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid path");
    });

    it("should reject paths with shell metacharacters", async () => {
      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: "src; rm -rf /" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid path");
    });

    it("should use verbose reporter by default", async () => {
      mockExecFileSync.mockReturnValue("Tests passed\n");

      const handler = registry.handlers.get("qa_test_run")!;
      await handler({ target: "src/lib/mcp" });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "yarn",
        ["vitest", "run", "src/lib/mcp", "--reporter=verbose"],
        expect.objectContaining({ timeout: 120_000 }),
      );
    });

    it("should accept custom reporter", async () => {
      mockExecFileSync.mockReturnValue("Tests passed\n");

      const handler = registry.handlers.get("qa_test_run")!;
      await handler({ target: "src/lib/mcp", reporter: "default" });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "yarn",
        expect.arrayContaining(["--reporter=default"]),
        expect.objectContaining({ timeout: 120_000 }),
      );
    });
  });

  // ── qa_coverage ─────────────────────────────────────────────

  describe("qa_coverage", () => {
    it("should parse coverage output", async () => {
      mockExecFileSync.mockReturnValue(
        "Statements : 85.5%\nBranches   : 72.3%\nFunctions  : 90.1%\nLines      : 88.2%\n",
      );

      const handler = registry.handlers.get("qa_coverage")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Coverage Report");
      expect(getText(result)).toContain("85.5%");
      expect(getText(result)).toContain("72.3%");
      expect(getText(result)).toContain("90.1%");
      expect(getText(result)).toContain("88.2%");
    });

    it("should color-code coverage levels", async () => {
      mockExecFileSync.mockReturnValue(
        "Statements : 85.5%\nBranches   : 65.0%\nFunctions  : 50.0%\nLines      : 88.2%\n",
      );

      const handler = registry.handlers.get("qa_coverage")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(getText(result)).toContain("good");
      expect(getText(result)).toContain("needs improvement");
      expect(getText(result)).toContain("low");
    });

    it("should return raw output when coverage format is unrecognized", async () => {
      mockExecFileSync.mockReturnValue("Some other output format\n");

      const handler = registry.handlers.get("qa_coverage")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(getText(result)).toContain("Coverage Report");
      expect(getText(result)).toContain("Some other output format");
    });

    it("should return error on coverage failure", async () => {
      const err = new Error("No tests found") as Error & { stdout?: string; };
      err.stdout = "Error: no test files found";
      mockExecFileSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("qa_coverage")!;
      const result = await handler({ target: "src/nonexistent" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Coverage Analysis Failed");
    });

    it("should reject invalid paths", async () => {
      const handler = registry.handlers.get("qa_coverage")!;
      const result = await handler({ target: "$(whoami)" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid path");
    });

    it("should pass coverage args via execFileSync", async () => {
      mockExecFileSync.mockReturnValue(
        "Statements : 80%\nBranches : 80%\nFunctions : 80%\nLines : 80%\n",
      );

      const handler = registry.handlers.get("qa_coverage")!;
      await handler({ target: "src/lib/mcp" });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "yarn",
        [
          "vitest",
          "run",
          "src/lib/mcp",
          "--coverage",
          "--coverage.reporter=json-summary",
        ],
        expect.objectContaining({ timeout: 120_000 }),
      );
    });
  });

  // ── qa_mobile_audit ─────────────────────────────────────────

  describe("qa_mobile_audit", () => {
    it("should perform mobile audit and find issues", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([
        {
          type: "100vh Usage",
          details: "Found 5 elements",
          impact: "moderate",
        },
        {
          type: "Missing viewport-fit=cover",
          details: "Essential for notch",
          impact: "moderate",
        },
      ]);

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Mobile Compatibility Audit");
      expect(getText(result)).toContain("100vh Usage");
      expect(getText(result)).toContain("MODERATE");
    });

    it("should report success when no issues found", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockResolvedValue([]);

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(getText(result)).toContain("No common mobile issues found");
    });

    it("should return error when no active tab", async () => {
      mockGetActiveTab.mockReturnValue(null);

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
    });

    it("should return error when tab exists but page is null", async () => {
      const tab = makeTabEntry();
      tab.page = null;
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Browser tab has no active page");
    });

    it("should return error when setViewportSize throws (catch block)", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockRejectedValue(
        new Error("viewport resize failed"),
      );

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Mobile audit failed");
    });

    it("should run evaluate callback and detect missing viewport-fit=cover", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Missing viewport-fit=cover");
    });

    it("should detect inline vh usage via evaluate callback", async () => {
      const div = document.createElement("div");
      div.style.height = "100vh";
      document.body.appendChild(div);

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(getText(result)).toContain("100vh Usage");

      document.body.removeChild(div);
    });

    it("should detect horizontal scroll via evaluate callback", async () => {
      // Mock scrollWidth > clientWidth to trigger horizontal scroll detection
      const origScrollWidth = Object.getOwnPropertyDescriptor(
        document.documentElement,
        "scrollWidth",
      );
      const origClientWidth = Object.getOwnPropertyDescriptor(
        document.documentElement,
        "clientWidth",
      );
      Object.defineProperty(document.documentElement, "scrollWidth", {
        value: 1024,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 375,
        configurable: true,
      });

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(getText(result)).toContain("Horizontal Scroll");

      // Restore original descriptors
      if (origScrollWidth) {
        Object.defineProperty(
          document.documentElement,
          "scrollWidth",
          origScrollWidth,
        );
      } else {
        Object.defineProperty(document.documentElement, "scrollWidth", {
          value: 0,
          configurable: true,
        });
      }
      if (origClientWidth) {
        Object.defineProperty(
          document.documentElement,
          "clientWidth",
          origClientWidth,
        );
      } else {
        Object.defineProperty(document.documentElement, "clientWidth", {
          value: 0,
          configurable: true,
        });
      }
    });

    it("should detect small touch targets via evaluate callback", async () => {
      const btn = document.createElement("button");
      btn.textContent = "Click";
      document.body.appendChild(btn);

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockResolvedValue(undefined);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_mobile_audit")!;
      const result = await handler({});
      expect(getText(result)).toContain("Small Touch Targets");

      document.body.removeChild(btn);
    });
  });

  // ── Additional edge-case coverage ────────────────────────────

  describe("qa_screenshot (page null edge case)", () => {
    it("should return error when tab exists but page is null", async () => {
      const tab = makeTabEntry();
      tab.page = null;
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Browser tab has no active page");
    });

    it("should return error when screenshot throws (catch block)", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockScreenshot.mockRejectedValue(new Error("screenshot failed"));

      const handler = registry.handlers.get("qa_screenshot")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Screenshot failed");
    });
  });

  describe("qa_accessibility (page null and callback edge cases)", () => {
    it("should return error when tab exists but page is null", async () => {
      const tab = makeTabEntry();
      tab.page = null;
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Browser tab has no active page");
    });

    it("should return error when evaluate throws (catch block)", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockRejectedValue(new Error("evaluate crashed"));

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Accessibility audit failed");
    });

    it("should run evaluate callback and detect issues via jsdom", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Accessibility Audit");
    });

    it("should detect images without alt text via evaluate callback", async () => {
      const img = document.createElement("img");
      img.src = "test.png";
      document.body.appendChild(img);

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Image missing alt text");

      document.body.removeChild(img);
    });

    it("should detect links without accessible name via evaluate callback", async () => {
      const link = document.createElement("a");
      link.href = "https://example.com";
      document.body.appendChild(link);

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Link missing accessible name");

      document.body.removeChild(link);
    });

    it("should detect buttons without accessible name via evaluate callback", async () => {
      const btn = document.createElement("button");
      document.body.appendChild(btn);

      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Button missing accessible name");

      document.body.removeChild(btn);
    });

    it("should detect missing h1 heading via evaluate callback", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockEvaluate.mockImplementation((fn: () => unknown) => {
        if (typeof fn === "function") return Promise.resolve(fn());
        return Promise.resolve(fn);
      });

      const handler = registry.handlers.get("qa_accessibility")!;
      const result = await handler({});
      expect(getText(result)).toContain("Page missing h1 heading");
    });
  });

  describe("qa_viewport (page null and catch edge cases)", () => {
    it("should return error when tab exists but page is null", async () => {
      const tab = makeTabEntry();
      tab.page = null;
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "mobile" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Browser tab has no active page");
    });

    it("should return error when setViewportSize throws (catch block)", async () => {
      const tab = makeTabEntry();
      mockGetActiveTab.mockReturnValue(tab);
      mockSetViewportSize.mockRejectedValue(new Error("viewport failed"));

      const handler = registry.handlers.get("qa_viewport")!;
      const result = await handler({ preset: "mobile" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Viewport change failed");
    });
  });

  describe("qa_evaluate (page null edge case)", () => {
    it("should return error when tab exists but page is null", async () => {
      const tab = makeTabEntry();
      tab.page = null;
      mockGetActiveTab.mockReturnValue(tab);

      const handler = registry.handlers.get("qa_evaluate")!;
      const result = await handler({ expression: "1+1" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Browser tab has no active page");
    });
  });

  describe("qa_tabs (unknown action and catch block)", () => {
    it("should return error for unknown action", async () => {
      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "foo" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unknown action: foo");
    });

    it("should return error when tab operation throws", async () => {
      mockListTabs.mockRejectedValue(new Error("browser crashed"));

      const handler = registry.handlers.get("qa_tabs")!;
      const result = await handler({ action: "list" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tab operation failed");
      expect(getText(result)).toContain("browser crashed");
    });
  });

  describe("qa_test_run (failure without stdout)", () => {
    it("should fall back to String(err) when error has no stdout", async () => {
      const err = new Error("Process exited with code 1");
      mockExecFileSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: "src/lib/mcp" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Test Results: FAIL");
      expect(getText(result)).toContain("Process exited with code 1");
    });
  });

  describe("isValidPath edge cases", () => {
    it("should reject paths longer than 200 characters", async () => {
      const longPath = "src/" + "a".repeat(200);
      const handler = registry.handlers.get("qa_test_run")!;
      const result = await handler({ target: longPath });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid path");
    });
  });
});
