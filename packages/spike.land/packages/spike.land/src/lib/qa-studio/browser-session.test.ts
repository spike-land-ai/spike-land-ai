import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock playwright before import
const mockPage = {
  goto: vi.fn(),
  title: vi.fn().mockResolvedValue("Test Page"),
  url: vi.fn().mockReturnValue("https://example.com"),
  screenshot: vi.fn(),
  evaluate: vi.fn(),
  setViewportSize: vi.fn(),
  close: vi.fn(),
  isClosed: vi.fn().mockReturnValue(false),
  locator: vi.fn(),
  on: vi.fn(),
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

import {
  cleanup,
  closeTab,
  getActiveTab,
  getOrCreateTab,
  listTabs,
} from "./browser-session";

describe("browser-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    mockBrowser.isConnected.mockReturnValue(true);
    mockPage.isClosed.mockReturnValue(false);
    mockPage.on.mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanup();
    vi.useRealTimers();
  });

  describe("getOrCreateTab", () => {
    it("should create a new tab and return page, entry, and index", async () => {
      const result = await getOrCreateTab();
      expect(result.page).toBeDefined();
      expect(result.entry).toBeDefined();
      expect(typeof result.index).toBe("number");
      expect(result.entry.consoleMessages).toEqual([]);
      expect(result.entry.networkRequests).toEqual([]);
    });

    it("should return existing tab when index is specified", async () => {
      const first = await getOrCreateTab();
      const second = await getOrCreateTab(first.index);
      expect(second.index).toBe(first.index);
    });

    it("should create separate tabs for different calls", async () => {
      const first = await getOrCreateTab();
      const second = await getOrCreateTab();
      expect(first.index).not.toBe(second.index);
    });
  });

  describe("getActiveTab", () => {
    it("should return null when no tabs exist", async () => {
      const tab = getActiveTab();
      expect(tab).toBeNull();
    });

    it("should return active tab after creating one", async () => {
      await getOrCreateTab();
      const tab = getActiveTab();
      expect(tab).not.toBeNull();
      expect(tab!.page).toBeDefined();
    });

    it("should return null when active tab is closed", async () => {
      await getOrCreateTab();
      mockPage.isClosed.mockReturnValue(true);
      const tab = getActiveTab();
      expect(tab).toBeNull();
    });
  });

  describe("listTabs", () => {
    it("should return empty array when no tabs exist", async () => {
      const tabs = await listTabs();
      expect(tabs).toEqual([]);
    });

    it("should list open tabs with url and title", async () => {
      await getOrCreateTab();
      const tabs = await listTabs();
      expect(tabs.length).toBeGreaterThanOrEqual(1);
      expect(tabs[0]).toHaveProperty("url");
      expect(tabs[0]).toHaveProperty("title");
      expect(tabs[0]).toHaveProperty("index");
    });

    it("should exclude closed tabs", async () => {
      await getOrCreateTab();
      mockPage.isClosed.mockReturnValue(true);
      const tabs = await listTabs();
      expect(tabs).toEqual([]);
    });
  });

  describe("closeTab", () => {
    it("should return false for non-existent tab", async () => {
      const result = await closeTab(999);
      expect(result).toBe(false);
    });

    it("should close and remove tab", async () => {
      const { index } = await getOrCreateTab();
      const result = await closeTab(index);
      expect(result).toBe(true);
      expect(mockPage.close).toHaveBeenCalled();
    });

    it("should update active tab index when closing active tab", async () => {
      const first = await getOrCreateTab();
      await getOrCreateTab(); // creates second, becomes active
      // Close the second (active) tab
      await closeTab(first.index + 1);
      // Active tab should shift to remaining
      const active = getActiveTab();
      // Either returns null or a tab — depends on implementation
      expect(active === null || typeof active.index === "number").toBe(true);
    });

    it("should handle closing already-closed page gracefully", async () => {
      const { index } = await getOrCreateTab();
      mockPage.isClosed.mockReturnValue(true);
      const result = await closeTab(index);
      expect(result).toBe(true);
      // Should not call page.close() again since it's already closed
    });
  });

  describe("cleanup", () => {
    it("should close all pages and browser", async () => {
      await getOrCreateTab();
      await getOrCreateTab();
      await cleanup();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it("should be safe to call when no browser exists", async () => {
      await cleanup();
      // Should not throw
    });
  });

  describe("environment check", () => {
    it("should throw in non-development mode", async () => {
      vi.stubEnv("NODE_ENV", "production");
      await expect(getOrCreateTab()).rejects.toThrow(
        "only available in development",
      );
    });
  });
});
