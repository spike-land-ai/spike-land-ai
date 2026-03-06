/**
 * Playwright Browser Adapter
 *
 * Implements BrowserAdapter using Playwright for Node.js CLI usage.
 */

import type { AccessibilityNode } from "../core-logic/types.js";
import type { BrowserAdapter, BrowserPage, CdpAxNode } from "../core-logic/adapter.js";
import { rebuildTree } from "../core-logic/adapter.js";

// ─── Playwright type aliases (never import Playwright types directly) ────────

type PwBrowser = {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
  isConnected(): boolean;
};

type PwPage = {
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  screenshot(opts?: {
    fullPage?: boolean;
    encoding?: "base64" | "binary";
    type?: "png" | "jpeg";
  }): Promise<string | Buffer>;
  evaluate(fn: string | ((...args: unknown[]) => unknown)): Promise<unknown>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  close(): Promise<void>;
  isClosed(): boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  getByRole(
    role: string,
    opts?: { name?: string | RegExp },
  ): {
    click(): Promise<void>;
    fill(text: string): Promise<void>;
    clear(): Promise<void>;
    selectOption(value: string): Promise<string[]>;
  };
  mouse: { wheel(deltaX: number, deltaY: number): Promise<void> };
  viewportSize(): { width: number; height: number } | null;
  context(): {
    newCDPSession(
      page: PwPage,
    ): Promise<{
      send(method: string): Promise<{ nodes?: CdpAxNode[] }>;
    }>;
  };
};

interface ConsoleMessage {
  type(): string;
  text(): string;
  location(): { url: string; lineNumber: number };
}

interface PageRequest {
  url(): string;
  method(): string;
  resourceType(): string;
  response(): Promise<{
    status(): number;
    headers(): Record<string, string>;
  } | null>;
}

export interface BrowserConfig {
  headless?: boolean;
  slowMo?: number;
}

export interface TabEntry {
  page: BrowserPage;
  consoleMessages: Array<{ type: string; text: string; url: string; line: number }>;
  networkRequests: Array<{
    url: string;
    method: string;
    resourceType: string;
    status: number;
    contentLength: string;
  }>;
}

// ─── PlaywrightPage wraps PwPage to implement BrowserPage ────────────────────

class PlaywrightPageWrapper implements BrowserPage {
  private _page: PwPage;
  keyboard: BrowserPage["keyboard"];
  mouse: BrowserPage["mouse"];

  constructor(page: PwPage) {
    this._page = page;
    this.keyboard = page.keyboard;
    this.mouse = page.mouse;
  }

  goto(url: string, opts?: { waitUntil?: string }) {
    return this._page.goto(url, opts);
  }
  title() {
    return this._page.title();
  }
  url() {
    return this._page.url();
  }
  screenshot(opts?: { fullPage?: boolean; encoding?: "base64" | "binary"; type?: "png" | "jpeg" }) {
    return this._page.screenshot(opts);
  }
  evaluate(fn: string | ((...args: unknown[]) => unknown)) {
    return this._page.evaluate(fn);
  }
  setViewportSize(size: { width: number; height: number }) {
    return this._page.setViewportSize(size);
  }
  close() {
    return this._page.close();
  }
  isClosed() {
    return this._page.isClosed();
  }
  getByRole(role: string, opts?: { name?: string | RegExp }) {
    return this._page.getByRole(role, opts);
  }
  viewportSize() {
    return this._page.viewportSize();
  }

  async getAccessibilityTree(): Promise<AccessibilityNode | null> {
    try {
      const client = await this._page.context().newCDPSession(this._page);
      const result = await client.send("Accessibility.getFullAXTree");
      if (result?.nodes) {
        return rebuildTree(result.nodes);
      }
    } catch (err) {
      throw new Error(
        `Failed to get accessibility tree via CDP: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Access underlying Playwright page for event listeners */
  get rawPage(): PwPage {
    return this._page;
  }
}

// ─── PlaywrightAdapter implements BrowserAdapter ─────────────────────────────

export class PlaywrightAdapter implements BrowserAdapter {
  private _config: BrowserConfig;
  private _browser: PwBrowser | null = null;
  private _launchPromise: Promise<PwBrowser> | null = null;

  constructor(config: BrowserConfig = { headless: true }) {
    this._config = config;
  }

  setConfig(config: Partial<BrowserConfig>): void {
    this._config = { ...this._config, ...config };
  }

  async launch(): Promise<void> {
    if (this._browser && this._browser.isConnected()) return;
    if (this._launchPromise) {
      await this._launchPromise;
      return;
    }

    this._launchPromise = (async () => {
      const pw = await import("playwright");
      const b = await pw.chromium.launch({
        headless: this._config.headless ?? true,
        ...(this._config.slowMo !== undefined ? { slowMo: this._config.slowMo } : {}),
      });
      this._browser = b as unknown as PwBrowser;
      return this._browser;
    })();

    try {
      await this._launchPromise;
    } finally {
      this._launchPromise = null;
    }
  }

  async newPage(): Promise<BrowserPage> {
    await this.launch();
    const rawPage = await this._browser!.newPage();
    return new PlaywrightPageWrapper(rawPage);
  }

  isConnected(): boolean {
    return this._browser?.isConnected() ?? false;
  }

  async close(): Promise<void> {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
    }
  }
}

/**
 * Set up console and network event listeners on a Playwright page wrapper.
 * Only works with PlaywrightPageWrapper (has rawPage).
 */
export function setupPageListeners(page: BrowserPage, entry: TabEntry): void {
  const wrapper = page as PlaywrightPageWrapper;
  if (!wrapper.rawPage) return;

  const raw = wrapper.rawPage as unknown as {
    on(event: string, handler: (...args: unknown[]) => void): void;
  };

  raw.on("console", (msg: unknown) => {
    const m = msg as ConsoleMessage;
    const loc = m.location();
    entry.consoleMessages.push({
      type: m.type(),
      text: m.text(),
      url: loc.url,
      line: loc.lineNumber,
    });
  });

  raw.on("requestfinished", (req: unknown) => {
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
