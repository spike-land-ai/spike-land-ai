import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock auth ─────────────────────────────────────────────────
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

// ── Mock browser-session ──────────────────────────────────────
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

// ── Mock page ─────────────────────────────────────────────────
const mockPage = {
  goto: vi.fn(),
  title: vi.fn(),
  url: vi.fn().mockReturnValue("https://example.com"),
  screenshot: vi.fn(),
  evaluate: vi.fn(),
  setViewportSize: vi.fn(),
  close: vi.fn(),
  isClosed: vi.fn().mockReturnValue(false),
  locator: vi.fn().mockReturnValue({ screenshot: vi.fn() }),
};

function makeTabEntry() {
  return {
    page: mockPage,
    entry: {
      consoleMessages: [] as Array<{ type: string; text: string; url: string; line: number }>,
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

import {
  qaAccessibility,
  qaConsole,
  qaEvaluate,
  qaNetwork,
  qaScreenshot,
  qaViewport,
} from "@/lib/qa-studio/actions";
import { isActionError } from "@/lib/qa-studio/types";

const adminSession = { user: { role: "ADMIN" as const } };

describe("QA Studio actions - no active tab handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    mockAuth.mockResolvedValue(adminSession);
    mockGetActiveTab.mockReturnValue(null);
  });

  it("qaScreenshot returns error object instead of throwing when no tab", async () => {
    const result = await qaScreenshot();
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });

  it("qaAccessibility returns error object instead of throwing when no tab", async () => {
    const result = await qaAccessibility();
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });

  it("qaConsole returns error object instead of throwing when no tab", async () => {
    const result = await qaConsole();
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });

  it("qaNetwork returns error object instead of throwing when no tab", async () => {
    const result = await qaNetwork();
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });

  it("qaViewport returns error object instead of throwing when no tab", async () => {
    const result = await qaViewport({ preset: "desktop" });
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });

  it("qaEvaluate returns error object instead of throwing when no tab", async () => {
    const result = await qaEvaluate("document.title");
    expect(isActionError(result)).toBe(true);
    if (isActionError(result)) {
      expect(result.error).toContain("No active browser tab");
    }
  });
});

describe("QA Studio actions - success paths", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(adminSession);
  });

  it("qaScreenshot returns screenshot data when tab exists", async () => {
    const tab = makeTabEntry();
    mockGetActiveTab.mockReturnValue(tab);
    mockPage.screenshot.mockResolvedValue("base64data");

    const result = await qaScreenshot();
    expect(isActionError(result)).toBe(false);
    if (!isActionError(result)) {
      expect(result.base64).toBe("base64data");
      expect(result.url).toBe("https://example.com");
    }
  });

  it("qaConsole returns messages when tab exists", async () => {
    const tab = makeTabEntry();
    tab.entry.consoleMessages.push({
      type: "error",
      text: "test error",
      url: "test.js",
      line: 1,
    });
    mockGetActiveTab.mockReturnValue(tab);

    const result = await qaConsole("error");
    expect(isActionError(result)).toBe(false);
    if (!isActionError(result)) {
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe("test error");
    }
  });
});

describe("isActionError", () => {
  it("returns true for error objects", () => {
    expect(isActionError({ error: "something" })).toBe(true);
  });

  it("returns false for success results", () => {
    expect(isActionError({ url: "https://example.com", title: "Test" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isActionError(null)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isActionError([])).toBe(false);
  });
});
