"use server";

import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  type QaAccessibilityResult,
  type QaActionError,
  type QaConsoleMessage,
  type QaCoverageResult,
  type QaEvaluateResult,
  type QaNavigateResult,
  type QaNetworkResult,
  type QaScreenshotResult,
  type QaTabInfo,
  type QaTestResult,
  type QaViewportResult,
} from "./types";

async function ensureAdmin() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPER_ADMIN)
  ) {
    throw new Error("Unauthorized");
  }
}

function ensureDev() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("QA Studio is only available in development mode");
  }
}

const NO_TAB_ERROR: QaActionError = {
  error: "No active browser tab. Navigate to a URL first using the Navigate panel.",
};

export async function qaNavigate(url: string): Promise<QaNavigateResult> {
  await ensureAdmin();
  ensureDev();

  const { getOrCreateTab } = await import("@/lib/qa-studio/browser-session");
  const { page } = await getOrCreateTab();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  const finalUrl = page.url();
  return { url: finalUrl, title };
}

export async function qaScreenshot(opts?: {
  fullPage?: boolean;
  selector?: string;
}): Promise<QaScreenshotResult | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab || !tab.page) return NO_TAB_ERROR;

  let raw: string | Buffer;
  try {
    if (opts?.selector) {
      const locator = tab.page.locator(opts.selector);
      raw = await locator.screenshot({ encoding: "base64" });
    } else {
      raw = await tab.page.screenshot({
        fullPage: opts?.fullPage ?? false,
        encoding: "base64",
        type: "png",
      });
    }
  } catch (err: unknown) {
    throw new Error(`Screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Playwright may return a Buffer (Uint8Array) instead of a plain string.
  // Next.js server actions can only serialize plain objects, so ensure it's a string.
  const base64 = typeof raw === "string" ? raw : Buffer.from(raw).toString("base64");

  return {
    base64,
    url: tab.page.url(),
    fullPage: opts?.fullPage ?? false,
  };
}

export async function qaAccessibility(
  standard?: string,
): Promise<QaAccessibilityResult | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab || !tab.page) return NO_TAB_ERROR;

  const std = standard ?? "wcag2aa";
  const violations: Array<{ issue: string; impact: string }> = [];

  // Use page.evaluate to inspect accessibility attributes directly,
  // since page.accessibility.snapshot() was removed in newer Playwright.
  const auditResult = (await tab.page.evaluate(() => {
    const issues: Array<{ issue: string; impact: string }> = [];
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.alt && !img.getAttribute("aria-label") && !img.getAttribute("aria-labelledby")) {
        issues.push({
          issue: `Image missing alt text: ${img.src.slice(-40)}`,
          impact: "serious",
        });
      }
    });
    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      const name = link.textContent?.trim() || link.getAttribute("aria-label") || "";
      if (!name) {
        issues.push({
          issue: `Link missing accessible name: ${link.href.slice(-40)}`,
          impact: "serious",
        });
      }
    });
    const buttons = document.querySelectorAll("button");
    buttons.forEach((btn) => {
      const name = btn.textContent?.trim() || btn.getAttribute("aria-label") || "";
      if (!name) {
        issues.push({
          issue: "Button missing accessible name",
          impact: "serious",
        });
      }
    });
    const inputs = document.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => {
      const id = input.id;
      const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasAriaLabel =
        !!input.getAttribute("aria-label") || !!input.getAttribute("aria-labelledby");
      if (!hasLabel && !hasAriaLabel) {
        issues.push({
          issue: `Form field missing label: ${input.tagName.toLowerCase()}[type=${
            input.getAttribute("type") ?? "text"
          }]`,
          impact: "moderate",
        });
      }
    });
    // Check document language
    if (!document.documentElement.lang) {
      issues.push({
        issue: "Document missing lang attribute",
        impact: "serious",
      });
    }
    // Check heading hierarchy
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    let lastLevel = 0;
    for (const h of headings) {
      const level = parseInt(h.tagName[1]!);
      if (level > lastLevel + 1 && lastLevel > 0) {
        issues.push({
          issue: `Heading hierarchy skip: h${lastLevel} → h${level}`,
          impact: "moderate",
        });
      }
      lastLevel = level;
    }
    return issues;
  })) as Array<{ issue: string; impact: string }>;

  violations.push(...auditResult);

  const score = violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 15);
  return { score, violations, standard: std };
}

export async function qaConsole(level?: string): Promise<QaConsoleMessage[] | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab) return NO_TAB_ERROR;

  const levelOrder = ["error", "warning", "info", "debug"];
  const minLevel = level ?? "info";
  const minIndex = levelOrder.indexOf(minLevel);

  return tab.entry.consoleMessages.filter((msg) => {
    const msgIndex = levelOrder.indexOf(msg.type === "warn" ? "warning" : msg.type);
    return msgIndex >= 0 && msgIndex <= minIndex;
  });
}

export async function qaNetwork(includeStatic?: boolean): Promise<QaNetworkResult | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab) return NO_TAB_ERROR;

  const staticTypes = new Set(["image", "font", "stylesheet", "media"]);
  let requests = tab.entry.networkRequests;
  if (!includeStatic) {
    requests = requests.filter((r) => !staticTypes.has(r.resourceType));
  }

  const totalSize = requests.reduce((sum, r) => sum + parseInt(r.contentLength || "0", 10), 0);
  const errorCount = requests.filter((r) => r.status >= 400).length;
  return { requests, totalSize, errorCount };
}

export async function qaViewport(opts: {
  preset?: string;
  width?: number;
  height?: number;
}): Promise<QaViewportResult | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab) return NO_TAB_ERROR;

  const PRESETS: Record<string, { width: number; height: number }> = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1440, height: 900 },
  };

  let width: number;
  let height: number;

  if (opts.preset && opts.preset in PRESETS) {
    const preset = PRESETS[opts.preset]!;
    width = preset.width;
    height = preset.height;
  } else if (opts.width && opts.height) {
    width = opts.width;
    height = opts.height;
  } else {
    throw new Error("Provide either a preset or both width and height");
  }

  await tab.page.setViewportSize({ width, height });
  return { width, height, preset: opts.preset ?? "custom" };
}

export async function qaEvaluate(expression: string): Promise<QaEvaluateResult | QaActionError> {
  await ensureAdmin();
  ensureDev();

  const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
  const tab = getActiveTab();
  if (!tab) return NO_TAB_ERROR;

  const result = await tab.page.evaluate(expression);
  const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return { output: output ?? "undefined", expression };
}

export async function qaTabs(action: string, index?: number): Promise<QaTabInfo[]> {
  await ensureAdmin();
  ensureDev();

  const session = await import("@/lib/qa-studio/browser-session");

  switch (action) {
    case "list":
      return session.listTabs();
    case "switch": {
      if (index === undefined) throw new Error("Tab index required");
      const { index: newIdx } = await session.getOrCreateTab(index);
      return [{ index: newIdx, url: "", title: "" }];
    }
    case "close": {
      if (index === undefined) throw new Error("Tab index required");
      const closed = await session.closeTab(index);
      if (!closed) throw new Error(`Tab ${index} not found`);
      return [];
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export async function qaTestRun(target: string, reporter?: string): Promise<QaTestResult> {
  await ensureAdmin();
  ensureDev();

  const { execFileSync } = await import("node:child_process");
  const isValid =
    /^[a-zA-Z0-9._/\-]+$/.test(target) && target.length <= 200 && !target.includes("..");
  if (!isValid) throw new Error("Invalid path");

  const rep = reporter ?? "verbose";
  try {
    const output = execFileSync("yarn", ["vitest", "run", target, `--reporter=${rep}`], {
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { passed: true, output: output.slice(-3000), target };
  } catch (err: unknown) {
    const output = (err as { stdout?: string }).stdout ?? String(err);
    return { passed: false, output: output.slice(-3000), target };
  }
}

export async function qaCoverage(target: string, format?: string): Promise<QaCoverageResult> {
  await ensureAdmin();
  ensureDev();

  const { execFileSync } = await import("node:child_process");
  const isValid =
    /^[a-zA-Z0-9._/\-]+$/.test(target) && target.length <= 200 && !target.includes("..");
  if (!isValid) throw new Error("Invalid path");

  try {
    const output = execFileSync(
      "yarn",
      ["vitest", "run", target, "--coverage", "--coverage.reporter=json-summary"],
      { encoding: "utf-8", timeout: 120_000, stdio: ["pipe", "pipe", "pipe"] },
    );

    const match = output.match(
      /Statements\s*:\s*([\d.]+)%.*?Branches\s*:\s*([\d.]+)%.*?Functions\s*:\s*([\d.]+)%.*?Lines\s*:\s*([\d.]+)%/s,
    );

    if (match) {
      return {
        target,
        statements: parseFloat(match[1]!),
        branches: parseFloat(match[2]!),
        functions: parseFloat(match[3]!),
        lines: parseFloat(match[4]!),
        raw: output.slice(-3000),
      };
    }

    return { target, raw: output.slice(-3000) };
  } catch (err: unknown) {
    const output = (err as { stdout?: string }).stdout ?? String(err);
    return {
      target,
      raw: `Error: ${format ?? "summary"}\n${output.slice(-3000)}`,
    };
  }
}
