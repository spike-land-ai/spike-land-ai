import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Playwright mock setup (hoisted so vi.mock works) ---
const mockPageOn = vi.fn();
const mockPageClose = vi.fn().mockResolvedValue(undefined);
const mockPageIsClosed = vi.fn().mockReturnValue(false);
const mockPageUrl = vi.fn().mockReturnValue("about:blank");
const mockPageTitle = vi.fn().mockResolvedValue("Blank");

const mockAccessibilitySnapshot = vi
  .fn()
  .mockResolvedValue({ role: "RootWebArea", name: "Test", children: [] });

function makeMockPage() {
  return {
    goto: vi.fn().mockResolvedValue(null),
    title: mockPageTitle,
    url: mockPageUrl,
    screenshot: vi.fn().mockResolvedValue("base64data"),
    evaluate: vi.fn().mockResolvedValue(undefined),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    close: mockPageClose,
    isClosed: mockPageIsClosed,
    locator: vi.fn().mockReturnValue({
      screenshot: vi.fn().mockResolvedValue("locator-base64"),
    }),
    on: mockPageOn,
    accessibility: { snapshot: mockAccessibilitySnapshot },
    keyboard: { press: vi.fn(), type: vi.fn() },
    getByRole: vi
      .fn()
      .mockReturnValue({ click: vi.fn(), fill: vi.fn(), clear: vi.fn(), selectOption: vi.fn() }),
    mouse: { wheel: vi.fn() },
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
  };
}

const mockBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockBrowserIsConnected = vi.fn().mockReturnValue(true);
const mockBrowserNewPage = vi.fn();

const mockChromiumLaunch = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launch: mockChromiumLaunch,
  },
}));

// Import after mocks
import {
  cleanup,
  closeTab,
  getActiveTab,
  getOrCreateTab,
  _getPageSnapshot,
  listTabs,
  _setBrowserConfig,
} from "../../src/core/browser-automation/core-logic/browser-session.js";

// Reset all singleton state and re-configure mocks between tests
async function resetAll() {
  // Cleanup FIRST (before clearAllMocks) so the real cleanup runs on current mocks
  await cleanup();
  vi.clearAllMocks();

  // Re-configure mock defaults after clear
  mockPageIsClosed.mockReturnValue(false);
  mockPageUrl.mockReturnValue("about:blank");
  mockPageTitle.mockResolvedValue("Blank");
  mockPageClose.mockResolvedValue(undefined);
  mockBrowserClose.mockResolvedValue(undefined);
  mockBrowserIsConnected.mockReturnValue(true);
  mockBrowserNewPage.mockImplementation(() => Promise.resolve(makeMockPage()));
  mockChromiumLaunch.mockResolvedValue({
    newPage: mockBrowserNewPage,
    close: mockBrowserClose,
    isConnected: mockBrowserIsConnected,
  });

  process.env.NODE_ENV = "development";
}

beforeEach(async () => {
  await resetAll();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  delete process.env.NODE_ENV;
});

describe("browser-session", () => {
  describe("getOrCreateTab", () => {
    it("launches browser and creates first tab", async () => {
      const result = await getOrCreateTab();

      expect(mockChromiumLaunch).toHaveBeenCalledWith({ headless: true });
      expect(mockBrowserNewPage).toHaveBeenCalledOnce();
      expect(result.index).toBe(0);
      expect(result.page).toBeDefined();
      expect(result.entry).toBeDefined();
    });

    it("reuses existing tab when index provided", async () => {
      const first = await getOrCreateTab();
      const reused = await getOrCreateTab(first.index);

      expect(mockBrowserNewPage).toHaveBeenCalledOnce();
      expect(reused.index).toBe(first.index);
      expect(reused.page).toBe(first.page);
    });

    it("creates new tab when index is undefined", async () => {
      await getOrCreateTab();
      await getOrCreateTab();

      expect(mockBrowserNewPage).toHaveBeenCalledTimes(2);
    });

    it("creates new tab when index does not exist", async () => {
      const result = await getOrCreateTab(99);

      // Tab 99 doesn't exist so a new tab is created at nextTabIndex (0)
      expect(result.index).toBe(0);
      expect(mockBrowserNewPage).toHaveBeenCalledOnce();
    });

    it("tab entry has empty consoleMessages and networkRequests initially", async () => {
      const { entry } = await getOrCreateTab();
      expect(entry.consoleMessages).toHaveLength(0);
      expect(entry.networkRequests).toHaveLength(0);
    });

    it("sets up page listeners for console and requestfinished events", async () => {
      await getOrCreateTab();
      const events = mockPageOn.mock.calls.map((c: unknown[]) => c[0]);
      expect(events).toContain("console");
      expect(events).toContain("requestfinished");
    });

    it("launches browser regardless of NODE_ENV", async () => {
      await cleanup();
      process.env.NODE_ENV = "production";

      // Re-configure launch mock after cleanup
      mockChromiumLaunch.mockResolvedValue({
        newPage: mockBrowserNewPage,
        close: mockBrowserClose,
        isConnected: mockBrowserIsConnected,
      });

      const result = await getOrCreateTab();
      expect(result.page).toBeDefined();
      expect(mockChromiumLaunch).toHaveBeenCalled();
    });

    it("increments tab index for each new tab", async () => {
      const t0 = await getOrCreateTab();
      const t1 = await getOrCreateTab();
      const t2 = await getOrCreateTab();

      expect(t0.index).toBe(0);
      expect(t1.index).toBe(1);
      expect(t2.index).toBe(2);
    });

    it("reuses browser on second call without re-launching", async () => {
      await getOrCreateTab();
      await getOrCreateTab();

      expect(mockChromiumLaunch).toHaveBeenCalledOnce();
    });

    it("prevents double-launch when called in parallel", async () => {
      const [t1, t2] = await Promise.all([getOrCreateTab(), getOrCreateTab()]);
      expect(mockChromiumLaunch).toHaveBeenCalledOnce();
      expect(t1.page).not.toBe(t2.page);
    });
  });

  describe("getActiveTab", () => {
    it("returns null when no tabs exist", () => {
      const result = getActiveTab();
      expect(result).toBeNull();
    });

    it("returns the active tab after creation", async () => {
      const { index } = await getOrCreateTab();
      const active = getActiveTab();

      expect(active).not.toBeNull();
      expect(active!.index).toBe(index);
    });

    it("returns null if active tab is closed", async () => {
      await getOrCreateTab();
      mockPageIsClosed.mockReturnValue(true);

      const active = getActiveTab();
      expect(active).toBeNull();
    });

    it("returns the most recently created tab as active", async () => {
      await getOrCreateTab(); // index 0
      await getOrCreateTab(); // index 1

      const active = getActiveTab();
      expect(active!.index).toBe(1);
    });
  });

  describe("listTabs", () => {
    it("returns empty array when no tabs exist", async () => {
      const result = await listTabs();
      expect(result).toHaveLength(0);
    });

    it("lists all open tabs with url and title", async () => {
      mockPageUrl.mockReturnValue("about:blank");
      mockPageTitle.mockResolvedValue("Blank");

      await getOrCreateTab();
      await getOrCreateTab();

      const result = await listTabs();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        index: 0,
        url: "about:blank",
        title: "Blank",
      });
      expect(result[1]).toEqual({
        index: 1,
        url: "about:blank",
        title: "Blank",
      });
    });

    it("excludes closed tabs from the result", async () => {
      await getOrCreateTab(); // index 0

      // Second tab will appear closed
      mockPageIsClosed.mockReturnValueOnce(false).mockReturnValueOnce(true);
      await getOrCreateTab(); // index 1

      // When listing, tab 0 is open but tab 1 is closed
      mockPageIsClosed.mockReturnValueOnce(false).mockReturnValueOnce(true);
      const result = await listTabs();

      expect(result.length).toBeLessThan(2);
    });
  });

  describe("closeTab", () => {
    it("returns false when tab does not exist", async () => {
      const result = await closeTab(99);
      expect(result).toBe(false);
    });

    it("closes an existing tab and returns true", async () => {
      const { index } = await getOrCreateTab();

      const result = await closeTab(index);

      expect(result).toBe(true);
      // Tab is removed — verify via listTabs (page.close mock tracking is covered in cleanup tests)
      const remaining = await listTabs();
      expect(remaining).toHaveLength(0);
    });

    it("removes the tab from the list after closing", async () => {
      await getOrCreateTab();

      await closeTab(0);

      const result = await listTabs();
      expect(result).toHaveLength(0);
    });

    it("does not call page.close() if page is already closed", async () => {
      await getOrCreateTab();
      mockPageIsClosed.mockReturnValue(true);

      const result = await closeTab(0);

      expect(result).toBe(true);
      expect(mockPageClose).not.toHaveBeenCalled();
    });

    it("updates activeTabIndex to remaining tab when active tab is closed", async () => {
      await getOrCreateTab(); // index 0
      await getOrCreateTab(); // index 1 — becomes active

      await closeTab(1); // close the active tab

      const active = getActiveTab();
      // Active should now be tab 0
      expect(active!.index).toBe(0);
    });

    it("sets activeTabIndex to 0 when last tab is closed", async () => {
      await getOrCreateTab(); // index 0

      await closeTab(0);

      // No tabs left
      const result = await listTabs();
      expect(result).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("closes all tabs and browser", async () => {
      await getOrCreateTab();
      await getOrCreateTab();

      await cleanup();

      expect(mockPageClose).toHaveBeenCalledTimes(2);
      expect(mockBrowserClose).toHaveBeenCalledOnce();
    });

    it("re-launches browser after cleanup on next getOrCreateTab call", async () => {
      await getOrCreateTab();
      await cleanup();

      // Reset mock to allow re-launch
      mockChromiumLaunch.mockResolvedValue({
        newPage: mockBrowserNewPage,
        close: mockBrowserClose,
        isConnected: mockBrowserIsConnected,
      });

      await getOrCreateTab();

      expect(mockChromiumLaunch).toHaveBeenCalledTimes(2);
    });

    it("is safe to call when no browser or tabs exist", async () => {
      await expect(cleanup()).resolves.toBeUndefined();
    });

    it("resets nextTabIndex to 0 after cleanup", async () => {
      await getOrCreateTab(); // index 0
      await getOrCreateTab(); // index 1

      await cleanup();

      // Re-configure launch after cleanup cleared mocks
      mockChromiumLaunch.mockResolvedValue({
        newPage: mockBrowserNewPage,
        close: mockBrowserClose,
        isConnected: mockBrowserIsConnected,
      });

      const result = await getOrCreateTab();
      expect(result.index).toBe(0);
    });

    it("skips close on already-closed pages", async () => {
      await getOrCreateTab();
      mockPageIsClosed.mockReturnValue(true);

      await cleanup();

      expect(mockPageClose).not.toHaveBeenCalled();
      expect(mockBrowserClose).toHaveBeenCalledOnce();
    });

    it("triggers cleanup after idle timeout", async () => {
      vi.useFakeTimers();
      await getOrCreateTab();

      // Fast forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000 + 100);

      // Wait for any pending async operations (void cleanup() call)
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBrowserClose).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });
  });

  describe("page event listeners", () => {
    it("records console messages via page listener", async () => {
      const { entry } = await getOrCreateTab();

      // Find and invoke the 'console' listener registered via page.on
      const consoleCall = mockPageOn.mock.calls.find((c: unknown[]) => c[0] === "console");
      expect(consoleCall).toBeDefined();
      const consoleHandler = consoleCall![1] as (msg: unknown) => void;

      consoleHandler({
        type: () => "log",
        text: () => "hello from page",
        location: () => ({ url: "https://example.com", lineNumber: 10 }),
      });

      expect(entry.consoleMessages).toHaveLength(1);
      expect(entry.consoleMessages[0]).toEqual({
        type: "log",
        text: "hello from page",
        url: "https://example.com",
        line: 10,
      });
    });

    it("records multiple console messages", async () => {
      const { entry } = await getOrCreateTab();

      const consoleCall = mockPageOn.mock.calls.find((c: unknown[]) => c[0] === "console");
      const consoleHandler = consoleCall![1] as (msg: unknown) => void;

      consoleHandler({
        type: () => "warn",
        text: () => "first",
        location: () => ({ url: "a.js", lineNumber: 1 }),
      });
      consoleHandler({
        type: () => "error",
        text: () => "second",
        location: () => ({ url: "b.js", lineNumber: 2 }),
      });

      expect(entry.consoleMessages).toHaveLength(2);
      expect(entry.consoleMessages[0]!.type).toBe("warn");
      expect(entry.consoleMessages[1]!.type).toBe("error");
    });

    it("records network requests via requestfinished listener", async () => {
      const { entry } = await getOrCreateTab();

      const reqCall = mockPageOn.mock.calls.find((c: unknown[]) => c[0] === "requestfinished");
      expect(reqCall).toBeDefined();
      const reqHandler = reqCall![1] as (req: unknown) => void;

      reqHandler({
        url: () => "https://api.example.com/data",
        method: () => "GET",
        resourceType: () => "fetch",
        response: () =>
          Promise.resolve({
            status: () => 200,
            headers: () => ({ "content-length": "1024" }),
          }),
      });

      // Wait for async response() to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(entry.networkRequests).toHaveLength(1);
      expect(entry.networkRequests[0]).toEqual({
        url: "https://api.example.com/data",
        method: "GET",
        resourceType: "fetch",
        status: 200,
        contentLength: "1024",
      });
    });

    it("records network request with null response (status 0, contentLength '0')", async () => {
      const { entry } = await getOrCreateTab();

      const reqCall = mockPageOn.mock.calls.find((c: unknown[]) => c[0] === "requestfinished");
      const reqHandler = reqCall![1] as (req: unknown) => void;

      reqHandler({
        url: () => "https://api.example.com/fail",
        method: () => "POST",
        resourceType: () => "fetch",
        response: () => Promise.resolve(null),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(entry.networkRequests[0]).toMatchObject({
        status: 0,
        contentLength: "0",
      });
    });

    it("records network request with missing content-length header (defaults to '0')", async () => {
      const { entry } = await getOrCreateTab();

      const reqCall = mockPageOn.mock.calls.find((c: unknown[]) => c[0] === "requestfinished");
      const reqHandler = reqCall![1] as (req: unknown) => void;

      reqHandler({
        url: () => "https://api.example.com/nolen",
        method: () => "GET",
        resourceType: () => "document",
        response: () =>
          Promise.resolve({
            status: () => 304,
            headers: () => ({}),
          }),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(entry.networkRequests[0]).toMatchObject({
        status: 304,
        contentLength: "0",
      });
    });
  });
});
