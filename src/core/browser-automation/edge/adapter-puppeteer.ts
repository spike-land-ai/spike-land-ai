/**
 * Puppeteer Browser Adapter (Cloudflare Workers Browser Rendering API)
 *
 * Implements BrowserAdapter using @cloudflare/puppeteer for CF Workers deployment.
 */

import type { AccessibilityNode } from "../core-logic/types.js";
import type { BrowserAdapter, BrowserPage, CdpAxNode } from "../core-logic/adapter.js";
import { rebuildTree } from "../core-logic/adapter.js";

// ─── Puppeteer type aliases (runtime import from @cloudflare/puppeteer) ──────

type PuppeteerBrowser = {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
  isConnected(): boolean;
};

type PuppeteerPage = {
  goto(url: string, opts?: { waitUntil?: string | string[] }): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  screenshot(opts?: {
    fullPage?: boolean;
    encoding?: "base64" | "binary";
    type?: "png" | "jpeg" | "webp";
  }): Promise<string | Buffer>;
  evaluate<T>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  setViewport(vp: { width: number; height: number }): Promise<void>;
  close(): Promise<void>;
  isClosed(): boolean;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  mouse: { wheel(opts: { deltaX: number; deltaY: number }): Promise<void> };
  viewport(): { width: number; height: number } | null;
  $(selector: string): Promise<PuppeteerElementHandle | null>;
  $$(selector: string): Promise<PuppeteerElementHandle[]>;
  createCDPSession(): Promise<{
    send(method: string, params?: Record<string, unknown>): Promise<{ nodes?: CdpAxNode[] }>;
  }>;
};

type PuppeteerElementHandle = {
  click(): Promise<void>;
  type(text: string): Promise<void>;
  evaluate<T>(fn: (el: unknown) => T): Promise<T>;
  select(...values: string[]): Promise<string[]>;
};

// ─── PuppeteerPage wraps raw page to implement BrowserPage ───────────────────

class PuppeteerPageWrapper implements BrowserPage {
  private _page: PuppeteerPage;
  keyboard: BrowserPage["keyboard"];
  mouse: BrowserPage["mouse"];

  constructor(page: PuppeteerPage) {
    this._page = page;
    this.keyboard = page.keyboard;
    // Puppeteer mouse.wheel takes an object, normalize to (deltaX, deltaY)
    this.mouse = {
      wheel: (deltaX: number, deltaY: number) =>
        page.mouse.wheel({ deltaX, deltaY }),
    };
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
    return this._page.evaluate(fn as string | (() => unknown));
  }
  async setViewportSize(size: { width: number; height: number }) {
    await this._page.setViewport(size);
  }
  close() {
    return this._page.close();
  }
  isClosed() {
    return this._page.isClosed();
  }
  viewportSize() {
    return this._page.viewport();
  }

  getByRole(role: string, opts?: { name?: string | RegExp }) {
    const page = this._page;
    // Puppeteer uses ARIA selectors: aria/Name[role="role"]
    const ariaSelector = buildAriaSelector(role, opts?.name);

    return {
      async click() {
        const el = await page.$(ariaSelector);
        if (!el) throw new Error(`No element found for role="${role}" name="${opts?.name}"`);
        await el.click();
      },
      async fill(text: string) {
        const el = await page.$(ariaSelector);
        if (!el) throw new Error(`No element found for role="${role}" name="${opts?.name}"`);
        // Clear existing value then type
        await el.evaluate((input: unknown) => {
          const inp = input as HTMLInputElement;
          inp.value = "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await el.type(text);
      },
      async clear() {
        const el = await page.$(ariaSelector);
        if (!el) throw new Error(`No element found for role="${role}" name="${opts?.name}"`);
        await el.evaluate((input: unknown) => {
          const inp = input as HTMLInputElement;
          inp.value = "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        });
      },
      async selectOption(value: string): Promise<string[]> {
        const el = await page.$(ariaSelector);
        if (!el) throw new Error(`No element found for role="${role}" name="${opts?.name}"`);
        return el.select(value);
      },
    };
  }

  async getAccessibilityTree(): Promise<AccessibilityNode | null> {
    try {
      const client = await this._page.createCDPSession();
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
}

function buildAriaSelector(role: string, name?: string | RegExp): string {
  if (name) {
    const nameStr = name instanceof RegExp ? name.source : name;
    return `aria/${nameStr}[role="${role}"]`;
  }
  return `[role="${role}"]`;
}

// ─── PuppeteerAdapter implements BrowserAdapter ──────────────────────────────

export class PuppeteerAdapter implements BrowserAdapter {
  private _browserBinding: Fetcher;
  private _browser: PuppeteerBrowser | null = null;

  constructor(browserBinding: Fetcher) {
    this._browserBinding = browserBinding;
  }

  async launch(): Promise<void> {
    if (this._browser?.isConnected()) return;
    const puppeteer = await import("@cloudflare/puppeteer");
    this._browser = await (puppeteer.default ?? puppeteer).launch(
      this._browserBinding,
    ) as unknown as PuppeteerBrowser;
  }

  async newPage(): Promise<BrowserPage> {
    if (!this._browser) await this.launch();
    const rawPage = await this._browser!.newPage();
    return new PuppeteerPageWrapper(rawPage);
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
