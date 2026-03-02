/**
 * Browser Session Manager
 *
 * Singleton managing a headless Chromium instance via Playwright.
 * Lazy launch on first tool call, auto-cleanup after 5min idle.
 * Only available in development mode.
 */

type PlaywrightBrowser = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
  isConnected: () => boolean;
};

type PlaywrightPage = {
  goto: (url: string, opts?: { waitUntil?: string }) => Promise<unknown>;
  title: () => Promise<string>;
  url: () => string;
  screenshot: (opts?: {
    fullPage?: boolean;
    encoding?: "base64" | "binary";
    type?: "png" | "jpeg";
  }) => Promise<string | Buffer>;
  evaluate: (fn: string | ((...args: unknown[]) => unknown)) => Promise<unknown>;
  setViewportSize: (size: { width: number; height: number }) => Promise<void>;
  close: () => Promise<void>;
  isClosed: () => boolean;
  locator: (selector: string) => {
    screenshot: (opts?: { encoding?: "base64" }) => Promise<string | Buffer>;
  };
};

interface ConsoleMessage {
  type: () => string;
  text: () => string;
  location: () => { url: string; lineNumber: number };
}

interface PageRequest {
  url: () => string;
  method: () => string;
  resourceType: () => string;
  response: () => Promise<{
    status: () => number;
    headers: () => Record<string, string>;
  } | null>;
}

export interface BrowserTab {
  index: number;
  url: string;
  title: string;
}

interface TabEntry {
  page: PlaywrightPage;
  consoleMessages: Array<{ type: string; text: string; url: string; line: number }>;
  networkRequests: Array<{
    url: string;
    method: string;
    resourceType: string;
    status: number;
    contentLength: string;
  }>;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let browser: PlaywrightBrowser | null = null;
let launchPromise: Promise<PlaywrightBrowser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const tabs = new Map<number, TabEntry>();
let activeTabIndex = 0;
let nextTabIndex = 0;

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void cleanup();
  }, IDLE_TIMEOUT_MS);
}

async function ensureBrowser(): Promise<PlaywrightBrowser> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Browser session is only available in development mode");
  }

  if (browser && browser.isConnected()) {
    resetIdleTimer();
    return browser;
  }

  // Prevent double-init with a promise lock
  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    try {
      const pw = await import("playwright");
      const b = await pw.chromium.launch({ headless: true });
      browser = b as unknown as PlaywrightBrowser;
      resetIdleTimer();
      return browser;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

function setupPageListeners(page: PlaywrightPage, entry: TabEntry): void {
  const p = page as unknown as {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  p.on("console", (msg: unknown) => {
    const m = msg as ConsoleMessage;
    const loc = m.location();
    entry.consoleMessages.push({
      type: m.type(),
      text: m.text(),
      url: loc.url,
      line: loc.lineNumber,
    });
  });

  p.on("requestfinished", (req: unknown) => {
    const r = req as PageRequest;
    void r.response().then((res) => {
      entry.networkRequests.push({
        url: r.url(),
        method: r.method(),
        resourceType: r.resourceType(),
        status: res?.status() ?? 0,
        contentLength: res?.headers()["content-length"] ?? "0",
      });
    });
  });
}

export async function getOrCreateTab(index?: number): Promise<{
  page: PlaywrightPage;
  entry: TabEntry;
  index: number;
}> {
  const b = await ensureBrowser();

  if (index !== undefined && tabs.has(index)) {
    activeTabIndex = index;
    const entry = tabs.get(index)!;
    return { page: entry.page, entry, index };
  }

  const page = await b.newPage();
  const tabIndex = nextTabIndex++;
  const entry: TabEntry = {
    page,
    consoleMessages: [],
    networkRequests: [],
  };
  setupPageListeners(page, entry);
  tabs.set(tabIndex, entry);
  activeTabIndex = tabIndex;
  return { page, entry, index: tabIndex };
}

export function getActiveTab(): {
  page: PlaywrightPage;
  entry: TabEntry;
  index: number;
} | null {
  const entry = tabs.get(activeTabIndex);
  if (!entry || entry.page.isClosed()) return null;
  resetIdleTimer();
  return { page: entry.page, entry, index: activeTabIndex };
}

export async function listTabs(): Promise<BrowserTab[]> {
  const result: BrowserTab[] = [];
  for (const [index, entry] of tabs) {
    if (entry.page.isClosed()) {
      tabs.delete(index);
      continue;
    }
    result.push({
      index,
      url: entry.page.url(),
      title: await entry.page.title(),
    });
  }
  return result;
}

export async function closeTab(index: number): Promise<boolean> {
  const entry = tabs.get(index);
  if (!entry) return false;
  if (!entry.page.isClosed()) {
    await entry.page.close();
  }
  tabs.delete(index);
  if (activeTabIndex === index) {
    const remaining = [...tabs.keys()];
    activeTabIndex = remaining.length > 0 ? remaining[0]! : 0;
  }
  return true;
}

export async function cleanup(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  for (const [index, entry] of tabs) {
    if (!entry.page.isClosed()) {
      await entry.page.close();
    }
    tabs.delete(index);
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
  nextTabIndex = 0;
  activeTabIndex = 0;
}
