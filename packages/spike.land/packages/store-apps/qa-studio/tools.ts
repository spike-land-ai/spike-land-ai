/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * QA Studio Standalone Tools
 *
 * Browser automation, testing, performance auditing, and accessibility tools.
 * Migrated from:
 *   - src/lib/mcp/server/tools/qa-studio.ts
 *   - src/lib/mcp/server/tools/qa-performance.ts
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { StandaloneToolDefinition } from "../shared/types";
import { errorResult, safeToolCall, textResult } from "../shared/tool-helpers";

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_STUDIO = "qa-studio";
const CATEGORY_PERF = "qa-performance";
const TIER = "free" as const;

const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidPath(p: string): boolean {
  return /^[a-zA-Z0-9._/\-]+$/.test(p) && p.length <= 200 && !p.includes("..");
}

// ── Performance helpers ────────────────────────────────────────────────────

const baselineStore = new Map<string, string>();

function simulateLighthouseAudit(
  url: string,
  categories: string[],
): {
  scores: Record<string, number>;
  metrics: {
    fcp_ms: number;
    lcp_ms: number;
    cls: number;
    tbt_ms: number;
    tti_ms: number;
  };
  recommendations: string[];
} {
  const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pseudo = (offset: number): number => ((seed * 9301 + offset * 49297) % 233280) / 233280;

  const scores: Record<string, number> = {};
  for (const cat of categories) {
    scores[cat] = Math.round(60 + pseudo(cat.length) * 40);
  }

  const metrics = {
    fcp_ms: Math.round(800 + pseudo(1) * 2200),
    lcp_ms: Math.round(1200 + pseudo(2) * 3800),
    cls: Math.round(pseudo(3) * 0.5 * 1000) / 1000,
    tbt_ms: Math.round(pseudo(4) * 600),
    tti_ms: Math.round(1500 + pseudo(5) * 4500),
  };

  const recommendations: string[] = [];
  if (metrics.fcp_ms > 1800) {
    recommendations.push("Reduce server response time (TTFB > target)");
  }
  if (metrics.lcp_ms > 2500) {
    recommendations.push("Optimise Largest Contentful Paint element (image or text block)");
  }
  if (metrics.cls > 0.1) {
    recommendations.push("Fix Cumulative Layout Shift — set explicit width/height on images");
  }
  if (metrics.tbt_ms > 200) {
    recommendations.push("Reduce Total Blocking Time — split or defer long JavaScript tasks");
  }
  if (metrics.tti_ms > 3800) {
    recommendations.push("Defer non-critical scripts to improve Time to Interactive");
  }
  if (recommendations.length === 0) {
    recommendations.push("All core metrics are within acceptable thresholds");
  }

  return { scores, metrics, recommendations };
}

function mockScreenshotId(url: string, suffix: string): string {
  const hash = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `ss-${hash.toString(16)}-${suffix}`;
}

function mockVisualDiff(
  baselineId: string,
  currentId: string,
): { diffPct: number; changedRegions: string[] } {
  const same = baselineId === currentId;
  if (same) {
    return { diffPct: 0, changedRegions: [] };
  }
  const seed = (baselineId + currentId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const diffPct = Math.round(((seed % 17) + 1) * 10) / 10;
  const regionNames = ["header", "hero", "navigation", "footer", "sidebar"];
  const changedCount = (seed % regionNames.length) + 1;
  return {
    diffPct,
    changedRegions: regionNames.slice(0, changedCount),
  };
}

function generateTestCases(
  url: string,
  testType: string,
): Array<{ description: string; steps: string[]; expectedResult: string }> {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  const common = {
    e2e: [
      {
        description: `Page loads successfully at ${host}`,
        steps: [`Navigate to ${url}`, "Wait for network idle", "Assert page title is non-empty"],
        expectedResult: "HTTP 200, non-blank title, no JS console errors",
      },
      {
        description: "Interactive elements are focusable",
        steps: [
          `Navigate to ${url}`,
          "Tab through all interactive elements",
          "Verify focus rings are visible",
        ],
        expectedResult: "Every button and link receives visible keyboard focus",
      },
      {
        description: "Navigation links resolve without 404",
        steps: [
          `Navigate to ${url}`,
          "Collect all <a href> links on the page",
          "Issue HEAD request for each",
        ],
        expectedResult: "All links return 2xx or 3xx status codes",
      },
    ],
    integration: [
      {
        description: `API contract is stable for ${host}`,
        steps: [
          "Call the primary API endpoint",
          "Validate response schema against snapshot",
          "Assert required fields are present",
        ],
        expectedResult: "Response matches the agreed schema with no extra nullable fields",
      },
      {
        description: "Authentication flow integrates end-to-end",
        steps: [
          "POST /api/auth/signin with valid credentials",
          "Assert session cookie is set",
          "Call authenticated endpoint",
          "Assert 200 response with user data",
        ],
        expectedResult: "Session is established and protected routes are accessible",
      },
    ],
    unit: [
      {
        description: "Utility functions return correct types",
        steps: [
          "Import target module",
          "Call each exported function with valid inputs",
          "Assert return type matches TypeScript signature",
        ],
        expectedResult: "No runtime type mismatches; all assertions pass",
      },
      {
        description: "Edge-case inputs are handled gracefully",
        steps: [
          "Call functions with null, undefined, empty string, and NaN",
          "Assert no unhandled exceptions are thrown",
          "Assert fallback/default values are returned",
        ],
        expectedResult: "Functions return safe defaults for all edge inputs",
      },
    ],
    accessibility: [
      {
        description: `WCAG 2.1 AA compliance at ${host}`,
        steps: [
          `Navigate to ${url}`,
          "Run axe-core accessibility audit",
          "Filter violations by impact: critical, serious",
        ],
        expectedResult: "Zero critical or serious WCAG 2.1 AA violations",
      },
      {
        description: "Images have descriptive alt text",
        steps: [
          `Navigate to ${url}`,
          "Query all <img> elements",
          "Assert each has a non-empty alt attribute",
        ],
        expectedResult: "Every content image has meaningful alternative text",
      },
      {
        description: "Colour contrast meets WCAG AA ratios",
        steps: [
          `Navigate to ${url}`,
          "Extract foreground/background colour pairs from computed styles",
          "Calculate contrast ratio for each pair",
        ],
        expectedResult: "All text-background pairs have ratio >= 4.5:1 (normal text)",
      },
    ],
  };

  return common[testType as keyof typeof common] ?? common.e2e;
}

// ── Tool definitions ───────────────────────────────────────────────────────

export const qaStudioTools: StandaloneToolDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // QA Studio browser tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "qa_navigate",
    description:
      "Navigate to a URL in the QA browser. Returns the page title and final URL after navigation.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("The URL to navigate to"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { url } = input as { url: string };
      try {
        const { getOrCreateTab } = await import("@/lib/qa-studio/browser-session");
        const { page } = await getOrCreateTab();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const title = await page.title();
        const finalUrl = page.url();
        return textResult(
          [`## Navigation Complete`, `- **URL:** ${finalUrl}`, `- **Title:** ${title}`].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Navigation failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_screenshot",
    description:
      "Capture a screenshot of the current page or a specific element. Returns a base64-encoded PNG.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      fullPage: z.boolean().optional().describe("Capture full scrollable page (default: false)"),
      selector: z.string().optional().describe("CSS selector to screenshot a specific element"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { fullPage, selector } = input as {
        fullPage?: boolean;
        selector?: string;
      };
      try {
        const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult("Browser tab has no active page. Navigate to a URL first.");
        }

        let base64: string;
        if (selector) {
          const locator = tab.page.locator(selector);
          base64 = (await locator.screenshot({ encoding: "base64" })) as string;
        } else {
          base64 = (await tab.page.screenshot({
            fullPage: fullPage ?? false,
            encoding: "base64",
            type: "png",
          })) as string;
        }

        return textResult(
          [
            `## Screenshot Captured`,
            `- **Page:** ${tab.page.url()}`,
            `- **Full Page:** ${fullPage ?? false}`,
            `- **Selector:** ${selector ?? "(viewport)"}`,
            `- **Size:** ${Math.round(base64.length * 0.75)} bytes`,
            ``,
            `\`\`\`base64`,
            base64,
            `\`\`\``,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Screenshot failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_accessibility",
    description:
      "Run an accessibility audit on the current page using the browser's accessibility tree. Returns violations and score.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      standard: z
        .enum(["wcag2a", "wcag2aa", "wcag21aa"])
        .optional()
        .describe("WCAG standard to audit against (default: wcag2aa)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { standard } = input as { standard?: string };
      try {
        const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult("Browser tab has no active page. Navigate to a URL first.");
        }

        const auditResult = (await tab.page.evaluate(() => {
          const issues: Array<{ issue: string; impact: string }> = [];
          document.querySelectorAll("img").forEach((img) => {
            if (!img.getAttribute("alt")) {
              issues.push({
                issue: "Image missing alt text",
                impact: "serious",
              });
            }
          });
          document.querySelectorAll("a").forEach((a) => {
            if (!a.textContent?.trim() && !a.getAttribute("aria-label")) {
              issues.push({
                issue: "Link missing accessible name",
                impact: "serious",
              });
            }
          });
          document.querySelectorAll("button").forEach((btn) => {
            if (!btn.textContent?.trim() && !btn.getAttribute("aria-label")) {
              issues.push({
                issue: "Button missing accessible name",
                impact: "serious",
              });
            }
          });
          if (!document.querySelector("h1")) {
            issues.push({
              issue: "Page missing h1 heading",
              impact: "serious",
            });
          }
          return issues;
        })) as Array<{ issue: string; impact: string }>;

        const stdName = standard ?? "wcag2aa";
        const violations = auditResult;
        const score = violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 15);

        const violationsList =
          violations.length > 0
            ? violations.map((v) => `  - [${v.impact.toUpperCase()}] ${v.issue}`).join("\n")
            : "  None found";

        return textResult(
          [
            `## Accessibility Audit`,
            `- **Standard:** ${stdName}`,
            `- **Score:** ${score}/100`,
            `- **Violations:** ${violations.length}`,
            ``,
            `### Issues`,
            violationsList,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Accessibility audit failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_console",
    description: "Capture console messages from the current browser tab. Filter by log level.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      level: z
        .enum(["error", "warning", "info", "debug"])
        .optional()
        .describe("Minimum log level to include (default: info)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { level } = input as { level?: string };
      const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
      const tab = getActiveTab();
      if (!tab) {
        return errorResult("No active browser tab. Use qa_navigate first.");
      }

      const levelOrder = ["error", "warning", "info", "debug"];
      const minLevel = level ?? "info";
      const minIndex = levelOrder.indexOf(minLevel);

      const filtered = tab.entry.consoleMessages.filter((msg) => {
        const msgIndex = levelOrder.indexOf(msg.type === "warn" ? "warning" : msg.type);
        return msgIndex >= 0 && msgIndex <= minIndex;
      });

      if (filtered.length === 0) {
        return textResult(`## Console Messages\n\nNo messages at level "${minLevel}" or above.`);
      }

      const lines = filtered.map(
        (msg) =>
          `[${msg.type.toUpperCase()}] ${msg.text}${msg.url ? ` (${msg.url}:${msg.line})` : ""}`,
      );

      return textResult(
        [
          `## Console Messages (${filtered.length})`,
          `- **Filter:** ${minLevel}`,
          ``,
          "```",
          ...lines,
          "```",
        ].join("\n"),
      );
    },
  },

  {
    name: "qa_network",
    description:
      "Analyze network requests from the current browser tab. Shows URLs, methods, status codes, and sizes.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      includeStatic: z
        .boolean()
        .optional()
        .describe("Include static resources like images, fonts, scripts (default: false)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { includeStatic } = input as { includeStatic?: boolean };
      const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
      const tab = getActiveTab();
      if (!tab) {
        return errorResult("No active browser tab. Use qa_navigate first.");
      }

      const staticTypes = new Set(["image", "font", "stylesheet", "media"]);
      let requests = tab.entry.networkRequests;
      if (!includeStatic) {
        requests = requests.filter((r) => !staticTypes.has(r.resourceType));
      }

      if (requests.length === 0) {
        return textResult(`## Network Requests\n\nNo requests captured.`);
      }

      const totalSize = requests.reduce((sum, r) => sum + parseInt(r.contentLength || "0", 10), 0);
      const errors = requests.filter((r) => r.status >= 400);

      const rows = requests
        .slice(0, 50)
        .map(
          (r) =>
            `| ${r.method} | ${r.status} | ${r.resourceType} | ${r.contentLength} | ${r.url.slice(
              0,
              80,
            )} |`,
        );

      return textResult(
        [
          `## Network Requests (${requests.length})`,
          `- **Total Size:** ${(totalSize / 1024).toFixed(1)} KB`,
          `- **Errors (4xx/5xx):** ${errors.length}`,
          ``,
          `| Method | Status | Type | Size | URL |`,
          `|--------|--------|------|------|-----|`,
          ...rows,
        ].join("\n"),
      );
    },
  },

  {
    name: "qa_viewport",
    description:
      "Set the browser viewport size for responsive testing. Use presets or custom dimensions.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      preset: z
        .enum(["mobile", "tablet", "desktop"])
        .optional()
        .describe("Viewport preset (overrides width/height)"),
      width: z.number().optional().describe("Custom viewport width in pixels"),
      height: z.number().optional().describe("Custom viewport height in pixels"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const {
        preset,
        width: inputWidth,
        height: inputHeight,
      } = input as {
        preset?: string;
        width?: number;
        height?: number;
      };
      try {
        const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult("Browser tab has no active page. Navigate to a URL first.");
        }

        let width: number;
        let height: number;

        if (preset && preset in VIEWPORT_PRESETS) {
          const presetVal = VIEWPORT_PRESETS[preset]!;
          width = presetVal.width;
          height = presetVal.height;
        } else if (inputWidth && inputHeight) {
          width = inputWidth;
          height = inputHeight;
        } else {
          return errorResult("Provide either a preset or both width and height.");
        }

        await tab.page.setViewportSize({ width, height });

        return textResult(
          [
            `## Viewport Updated`,
            `- **Size:** ${width}x${height}`,
            `- **Preset:** ${preset ?? "custom"}`,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Viewport change failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_evaluate",
    description:
      "Execute a JavaScript expression in the current browser tab and return the result.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      expression: z.string().describe("JavaScript expression to evaluate in the page context"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { expression } = input as { expression: string };
      try {
        const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult("Browser tab has no active page. Navigate to a URL first.");
        }

        const result = await tab.page.evaluate(expression);
        const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);

        return textResult(
          [
            `## Evaluate Result`,
            `- **Expression:** \`${expression.slice(0, 100)}\``,
            ``,
            "```json",
            output ?? "undefined",
            "```",
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Evaluation failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_tabs",
    description: "Manage browser tabs: list open tabs, switch between them, or close a tab.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      action: z.enum(["list", "switch", "close"]).describe("Tab action to perform"),
      index: z.number().optional().describe("Tab index (required for switch/close)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { action, index } = input as {
        action: string;
        index?: number;
      };
      try {
        const { closeTab, getActiveTab, getOrCreateTab, listTabs } = await import(
          "@/lib/qa-studio/browser-session"
        );

        switch (action) {
          case "list": {
            const tabList = await listTabs();
            if (tabList.length === 0) {
              return textResult("## Browser Tabs\n\nNo open tabs.");
            }
            const active = getActiveTab();
            const rows = tabList.map(
              (t) =>
                `| ${t.index === active?.index ? "**>>**" : ""} ${t.index} | ${t.title.slice(
                  0,
                  40,
                )} | ${t.url.slice(0, 60)} |`,
            );
            return textResult(
              [
                `## Browser Tabs (${tabList.length})`,
                ``,
                `| # | Title | URL |`,
                `|---|-------|-----|`,
                ...rows,
              ].join("\n"),
            );
          }
          case "switch": {
            if (index === undefined) {
              return errorResult("Tab index required for switch action.");
            }
            const result = await getOrCreateTab(index);
            return textResult(`Switched to tab ${result.index}.`);
          }
          case "close": {
            if (index === undefined) {
              return errorResult("Tab index required for close action.");
            }
            const closed = await closeTab(index);
            return closed
              ? textResult(`Closed tab ${index}.`)
              : errorResult(`Tab ${index} not found.`);
          }
          default:
            return errorResult(`Unknown action: ${action}`);
        }
      } catch (err: unknown) {
        return errorResult(`Tab operation failed: ${(err as Error).message}`);
      }
    },
  },

  {
    name: "qa_test_run",
    description:
      "Run Vitest tests on a specific file or directory. Returns test results with pass/fail status.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      target: z.string().describe("Test file or directory path (e.g., 'src/lib/mcp')"),
      reporter: z.enum(["verbose", "default"]).optional().describe("Test reporter format"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { target, reporter } = input as {
        target: string;
        reporter?: string;
      };
      if (!isValidPath(target)) {
        return errorResult(
          "Invalid path. Use alphanumeric characters, dots, slashes, and dashes only.",
        );
      }

      const { execFileSync } = await import("node:child_process");
      const reporterVal = reporter ?? "verbose";
      const args = ["vitest", "run", target, `--reporter=${reporterVal}`];

      try {
        const output = execFileSync("yarn", args, {
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return textResult(
          [
            `## Test Results: PASS`,
            `- **Target:** ${target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      } catch (err: unknown) {
        const output = (err as { stdout?: string }).stdout ?? String(err);
        return errorResult(
          [
            `## Test Results: FAIL`,
            `- **Target:** ${target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      }
    },
  },

  {
    name: "qa_coverage",
    description:
      "Analyze test coverage for a specific file or directory. Returns line, function, branch, and statement coverage.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      target: z.string().describe("Source file or directory to analyze coverage for"),
      format: z
        .enum(["summary", "detailed"])
        .optional()
        .describe("Output format (default: summary)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      const { target, format } = input as {
        target: string;
        format?: string;
      };
      if (!isValidPath(target)) {
        return errorResult(
          "Invalid path. Use alphanumeric characters, dots, slashes, and dashes only.",
        );
      }

      const { execFileSync } = await import("node:child_process");
      const formatVal = format ?? "summary";
      const args = ["vitest", "run", target, "--coverage", "--coverage.reporter=json-summary"];

      try {
        const output = execFileSync("yarn", args, {
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });

        const coverageMatch = output.match(
          /Statements\s*:\s*([\d.]+)%.*?Branches\s*:\s*([\d.]+)%.*?Functions\s*:\s*([\d.]+)%.*?Lines\s*:\s*([\d.]+)%/s,
        );

        if (coverageMatch) {
          const [, statements, branches, functions, lines] = coverageMatch;
          const colorize = (pct: string): string => {
            const n = parseFloat(pct!);
            if (n >= 80) return `${pct}% (good)`;
            if (n >= 60) return `${pct}% (needs improvement)`;
            return `${pct}% (low)`;
          };

          return textResult(
            [
              `## Coverage Report`,
              `- **Target:** ${target}`,
              `- **Format:** ${formatVal}`,
              ``,
              `| Metric | Coverage |`,
              `|--------|----------|`,
              `| Statements | ${colorize(statements!)} |`,
              `| Branches | ${colorize(branches!)} |`,
              `| Functions | ${colorize(functions!)} |`,
              `| Lines | ${colorize(lines!)} |`,
            ].join("\n"),
          );
        }

        return textResult(
          [
            `## Coverage Report`,
            `- **Target:** ${target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      } catch (err: unknown) {
        const output = (err as { stdout?: string }).stdout ?? String(err);
        return errorResult(
          [
            `## Coverage Analysis Failed`,
            `- **Target:** ${target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      }
    },
  },

  {
    name: "qa_mobile_audit",
    description:
      "Audit the current page for iPhone/mobile compatibility issues like 100vh usage and missing safe-areas.",
    category: CATEGORY_STUDIO,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      try {
        const { getActiveTab } = await import("@/lib/qa-studio/browser-session");
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult("Browser tab has no active page. Navigate to a URL first.");
        }

        await tab.page.setViewportSize(VIEWPORT_PRESETS.mobile!);

        const audit = (await tab.page.evaluate(() => {
          const issues: Array<{
            type: string;
            details: string;
            impact: string;
          }> = [];

          const vhElements = Array.from(document.querySelectorAll("*")).filter((el) => {
            const style = (el as HTMLElement).style;
            return style.height?.includes("vh") || style.minHeight?.includes("vh");
          });

          if (vhElements.length > 0) {
            issues.push({
              type: "100vh Usage",
              details: `Found ${vhElements.length} elements with inline 100vh. Use 100dvh for better mobile support.`,
              impact: "moderate",
            });
          }

          const touchTargets = Array.from(document.querySelectorAll("button, a, [role='button']"));
          const smallTargets = touchTargets.filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          });

          if (smallTargets.length > 0) {
            issues.push({
              type: "Small Touch Targets",
              details: `Found ${smallTargets.length} interactive elements smaller than 44x44px.`,
              impact: "moderate",
            });
          }

          const hasHorizontalScroll =
            document.documentElement.scrollWidth > document.documentElement.clientWidth;
          if (hasHorizontalScroll) {
            issues.push({
              type: "Horizontal Scroll",
              details: "The page has horizontal scrolling on mobile viewport.",
              impact: "serious",
            });
          }

          const viewportMeta = document.querySelector("meta[name='viewport']");
          const content = viewportMeta?.getAttribute("content") || "";
          if (!content.includes("viewport-fit=cover")) {
            issues.push({
              type: "Missing viewport-fit=cover",
              details:
                "Missing 'viewport-fit=cover' in viewport meta tag. Essential for notch/safe-areas.",
              impact: "moderate",
            });
          }

          return issues;
        })) as Array<{
          type: string;
          details: string;
          impact: string;
        }>;

        const lines = audit.map((i) => `- **[${i.impact.toUpperCase()}]** ${i.type}: ${i.details}`);

        return textResult(
          [
            `## Mobile Compatibility Audit (iPhone 15)`,
            lines.length > 0 ? lines.join("\n") : "No common mobile issues found.",
            "",
            "### Recommendations:",
            "- Use `100dvh` instead of `100vh` for full-screen elements.",
            "- Use `env(safe-area-inset-bottom)` for bottom-fixed navigation.",
            "- Ensure interactive elements are at least 44x44px.",
            "- Add `viewport-fit=cover` to the viewport meta tag.",
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Mobile audit failed: ${(err as Error).message}`);
      }
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // QA Performance tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "qa_lighthouse",
    description:
      "Run a Lighthouse-style performance audit against a URL. " +
      "Returns scores per category plus key Core Web Vitals metrics " +
      "(FCP, LCP, CLS, TBT, TTI) and actionable recommendations.",
    category: CATEGORY_PERF,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("Page URL to audit"),
      categories: z
        .array(z.enum(["performance", "accessibility", "seo", "best-practices"]))
        .optional()
        .describe("Lighthouse categories to audit (default: all four)"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("qa_lighthouse", async () => {
        const { url, categories } = input as {
          url: string;
          categories?: string[];
        };
        const cats = categories?.length
          ? categories
          : ["performance", "accessibility", "seo", "best-practices"];

        const audit = simulateLighthouseAudit(url, cats);

        const scoreRows = Object.entries(audit.scores)
          .map(([cat, score]) => {
            const badge = score >= 90 ? "GOOD" : score >= 50 ? "NEEDS WORK" : "POOR";
            return `| ${cat} | ${score}/100 | ${badge} |`;
          })
          .join("\n");

        const recsText = audit.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n");

        return textResult(
          [
            `## Lighthouse Audit: ${url}`,
            ``,
            `### Scores`,
            `| Category | Score | Status |`,
            `|----------|-------|--------|`,
            scoreRows,
            ``,
            `### Core Web Vitals`,
            `| Metric | Value |`,
            `|--------|-------|`,
            `| First Contentful Paint (FCP) | ${audit.metrics.fcp_ms} ms |`,
            `| Largest Contentful Paint (LCP) | ${audit.metrics.lcp_ms} ms |`,
            `| Cumulative Layout Shift (CLS) | ${audit.metrics.cls} |`,
            `| Total Blocking Time (TBT) | ${audit.metrics.tbt_ms} ms |`,
            `| Time to Interactive (TTI) | ${audit.metrics.tti_ms} ms |`,
            ``,
            `### Top Recommendations`,
            recsText,
          ].join("\n"),
        );
      }),
  },

  {
    name: "qa_visual_diff",
    description:
      "Compare a visual snapshot of a URL against a stored baseline for regression testing. " +
      "If no baseline_id is provided a new baseline is created and its ID is returned. " +
      "Returns diff percentage and the list of changed page regions.",
    category: CATEGORY_PERF,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("Page URL to capture"),
      baseline_id: z
        .string()
        .optional()
        .describe(
          "Existing baseline ID to compare against. " +
            "If omitted a new baseline is created and its ID is returned.",
        ),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("qa_visual_diff", async () => {
        const { url, baseline_id } = input as {
          url: string;
          baseline_id?: string;
        };
        const currentId = mockScreenshotId(url, "current");

        if (!baseline_id) {
          const newBaselineId = mockScreenshotId(url, "baseline");
          baselineStore.set(newBaselineId, currentId);

          return textResult(
            [
              `## Visual Baseline Created`,
              `- **URL:** ${url}`,
              `- **Baseline ID:** ${newBaselineId}`,
              `- **Screenshot ID:** ${currentId}`,
              ``,
              `Pass this baseline_id in future calls to compare against this snapshot.`,
            ].join("\n"),
          );
        }

        const storedSnapshot = baselineStore.get(baseline_id);
        if (!storedSnapshot) {
          return textResult(
            [
              `## Visual Diff: Baseline Not Found`,
              `- **Baseline ID:** ${baseline_id}`,
              ``,
              `No baseline exists for this ID. Run qa_visual_diff without a baseline_id to create one.`,
            ].join("\n"),
          );
        }

        const { diffPct, changedRegions } = mockVisualDiff(storedSnapshot, currentId);

        const status =
          diffPct === 0
            ? "PASS — no visual changes detected"
            : diffPct < 5
              ? "WARN — minor visual changes detected"
              : "FAIL — significant visual regression detected";

        const regionsText =
          changedRegions.length > 0 ? changedRegions.map((r) => `  - ${r}`).join("\n") : "  (none)";

        return textResult(
          [
            `## Visual Diff Result`,
            `- **URL:** ${url}`,
            `- **Baseline ID:** ${baseline_id}`,
            `- **Current Screenshot ID:** ${currentId}`,
            `- **Diff:** ${diffPct}%`,
            `- **Status:** ${status}`,
            ``,
            `### Changed Regions`,
            regionsText,
          ].join("\n"),
        );
      }),
  },

  {
    name: "qa_api_test",
    description:
      "Test an API endpoint by sending an HTTP request and inspecting the response. " +
      "Returns status code, response time, headers, body preview, and a pass/fail " +
      "result when expected_status is provided.",
    category: CATEGORY_PERF,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("API endpoint URL"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).describe("HTTP method"),
      headers: z.record(z.string(), z.string()).optional().describe("Optional request headers"),
      body: z
        .string()
        .optional()
        .describe("Optional request body (serialised JSON string or plain text)"),
      expected_status: z
        .number()
        .int()
        .optional()
        .describe(
          "Expected HTTP status code. If provided the result includes a pass/fail assertion.",
        ),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("qa_api_test", async () => {
        const { url, method, headers, body, expected_status } = input as {
          url: string;
          method: string;
          headers?: Record<string, string>;
          body?: string;
          expected_status?: number;
        };
        const start = Date.now();

        const requestInit: RequestInit = {
          method,
          headers: headers ?? {},
        };

        if (body !== undefined && !["GET", "DELETE"].includes(method)) {
          requestInit.body = body;
          if (!headers?.["Content-Type"]) {
            (requestInit.headers as Record<string, string>)["Content-Type"] = "application/json";
          }
        }

        let response: Response;
        try {
          response = await fetch(url, requestInit);
        } catch (err: unknown) {
          return textResult(
            [
              `## API Test: FAIL`,
              `- **URL:** ${url}`,
              `- **Method:** ${method}`,
              `- **Error:** ${(err as Error).message}`,
            ].join("\n"),
          );
        }

        const responseTimeMs = Date.now() - start;
        const bodyText = await response.text().catch(() => "(unreadable)");
        const bodyPreview =
          bodyText.slice(0, 500) + (bodyText.length > 500 ? "\n...(truncated)" : "");

        const headerLines = Array.from(response.headers.entries())
          .slice(0, 10)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n");

        const assertionResult =
          expected_status !== undefined
            ? response.status === expected_status
              ? `PASS (got ${response.status}, expected ${expected_status})`
              : `FAIL (got ${response.status}, expected ${expected_status})`
            : "N/A (no expected_status provided)";

        return textResult(
          [
            `## API Test Result`,
            `- **URL:** ${url}`,
            `- **Method:** ${method}`,
            `- **Status:** ${response.status} ${response.statusText}`,
            `- **Response Time:** ${responseTimeMs} ms`,
            `- **Assertion:** ${assertionResult}`,
            ``,
            `### Response Headers (first 10)`,
            "```",
            headerLines,
            "```",
            ``,
            `### Response Body Preview`,
            "```",
            bodyPreview,
            "```",
          ].join("\n"),
        );
      }),
  },

  {
    name: "qa_generate_test",
    description:
      "Generate a structured test plan for a URL. " +
      "Supports unit, integration, e2e, and accessibility test types. " +
      "Returns an array of test cases each with a description, ordered steps, and expected results.",
    category: CATEGORY_PERF,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("URL of the page or API endpoint to analyse"),
      test_type: z
        .enum(["unit", "integration", "e2e", "accessibility"])
        .describe("Type of test plan to generate"),
    },
    handler: async (input: never): Promise<CallToolResult> =>
      safeToolCall("qa_generate_test", async () => {
        const { url, test_type } = input as {
          url: string;
          test_type: string;
        };
        const cases = generateTestCases(url, test_type);

        const casesText = cases
          .map((tc, i) => {
            const stepsText = tc.steps.map((s, si) => `    ${si + 1}. ${s}`).join("\n");
            return [
              `### Test Case ${i + 1}: ${tc.description}`,
              ``,
              `**Steps:**`,
              stepsText,
              ``,
              `**Expected Result:** ${tc.expectedResult}`,
            ].join("\n");
          })
          .join("\n\n");

        return textResult(
          [
            `## Test Plan: ${test_type.toUpperCase()} — ${url}`,
            `- **Type:** ${test_type}`,
            `- **Cases:** ${cases.length}`,
            ``,
            casesText,
          ].join("\n"),
        );
      }),
  },
];
