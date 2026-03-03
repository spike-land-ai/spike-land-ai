/**
 * QA Studio MCP Tools
 *
 * Browser automation and test execution tools for the QA Studio dashboard.
 * Only registered when NODE_ENV=development.
 *
 * Tools:
 * 1. qa_navigate - Navigate to URL, return page info
 * 2. qa_screenshot - Capture page screenshot (base64)
 * 3. qa_accessibility - WCAG accessibility audit
 * 4. qa_console - Capture console messages
 * 5. qa_network - Analyze network requests
 * 6. qa_viewport - Responsive viewport testing
 * 7. qa_evaluate - Execute JavaScript on page
 * 8. qa_tabs - Manage multiple browser tabs/sessions
 * 9. qa_test_run - Run vitest on specific files
 * 10. qa_coverage - Analyze test coverage
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "node:child_process";
import {
  closeTab,
  getActiveTab,
  getOrCreateTab,
  listTabs,
} from "@/lib/qa-studio/browser-session";

const CATEGORY = "qa-studio";
const TIER = "free" as const;

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(msg: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

/** Validate test target path to prevent command injection. */
function isValidPath(p: string): boolean {
  return /^[a-zA-Z0-9._/\-]+$/.test(p) && p.length <= 200 && !p.includes("..");
}

const VIEWPORT_PRESETS: Record<string, { width: number; height: number; }> = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export function registerQaStudioTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── qa_navigate ──────────────────────────────────────────────
  registry.register({
    name: "qa_navigate",
    description:
      "Navigate to a URL in the QA browser. Returns the page title and final URL after navigation.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      url: z.string().url().describe("The URL to navigate to"),
    },
    handler: async (input: { url: string; }) => {
      try {
        const { page } = await getOrCreateTab();
        await page.goto(input.url, { waitUntil: "domcontentloaded" });
        const title = await page.title();
        const finalUrl = page.url();
        return textResult(
          [
            `## Navigation Complete`,
            `- **URL:** ${finalUrl}`,
            `- **Title:** ${title}`,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Navigation failed: ${(err as Error).message}`);
      }
    },
  });

  // ── qa_screenshot ────────────────────────────────────────────
  registry.register({
    name: "qa_screenshot",
    description:
      "Capture a screenshot of the current page or a specific element. Returns a base64-encoded PNG.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      fullPage: z.boolean().optional().describe(
        "Capture full scrollable page (default: false)",
      ),
      selector: z.string().optional().describe(
        "CSS selector to screenshot a specific element",
      ),
    },
    handler: async (input: { fullPage?: boolean; selector?: string; }) => {
      try {
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult(
            "Browser tab has no active page. Navigate to a URL first.",
          );
        }

        let base64: string;
        if (input.selector) {
          const locator = tab.page.locator(input.selector);
          base64 = (await locator.screenshot({ encoding: "base64" })) as string;
        } else {
          base64 = (await tab.page.screenshot({
            fullPage: input.fullPage ?? false,
            encoding: "base64",
            type: "png",
          })) as string;
        }

        return textResult(
          [
            `## Screenshot Captured`,
            `- **Page:** ${tab.page.url()}`,
            `- **Full Page:** ${input.fullPage ?? false}`,
            `- **Selector:** ${input.selector ?? "(viewport)"}`,
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
  });

  // ── qa_accessibility ─────────────────────────────────────────
  registry.register({
    name: "qa_accessibility",
    description:
      "Run an accessibility audit on the current page using the browser's accessibility tree. Returns violations and score.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      standard: z
        .enum(["wcag2a", "wcag2aa", "wcag21aa"])
        .optional()
        .describe("WCAG standard to audit against (default: wcag2aa)"),
    },
    handler: async (input: { standard?: string; }) => {
      try {
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult(
            "Browser tab has no active page. Navigate to a URL first.",
          );
        }

        const auditResult = await tab.page.evaluate(() => {
          const issues: Array<{ issue: string; impact: string; }> = [];
          // Check for images without alt text
          document.querySelectorAll("img").forEach(img => {
            if (!img.getAttribute("alt")) {
              issues.push({
                issue: "Image missing alt text",
                impact: "serious",
              });
            }
          });
          // Check for links without accessible name
          document.querySelectorAll("a").forEach(a => {
            if (!a.textContent?.trim() && !a.getAttribute("aria-label")) {
              issues.push({
                issue: "Link missing accessible name",
                impact: "serious",
              });
            }
          });
          // Check for buttons without accessible name
          document.querySelectorAll("button").forEach(btn => {
            if (!btn.textContent?.trim() && !btn.getAttribute("aria-label")) {
              issues.push({
                issue: "Button missing accessible name",
                impact: "serious",
              });
            }
          });
          // Check heading structure
          if (!document.querySelector("h1")) {
            issues.push({
              issue: "Page missing h1 heading",
              impact: "serious",
            });
          }
          return issues;
        }) as Array<{ issue: string; impact: string; }>;
        const standard = input.standard ?? "wcag2aa";

        const violations = auditResult;

        const score = violations.length === 0
          ? 100
          : Math.max(0, 100 - violations.length * 15);

        const violationsList = violations.length > 0
          ? violations.map(v => `  - [${v.impact.toUpperCase()}] ${v.issue}`)
            .join("\n")
          : "  None found";

        return textResult(
          [
            `## Accessibility Audit`,
            `- **Standard:** ${standard}`,
            `- **Score:** ${score}/100`,
            `- **Violations:** ${violations.length}`,
            ``,
            `### Issues`,
            violationsList,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(
          `Accessibility audit failed: ${(err as Error).message}`,
        );
      }
    },
  });

  // ── qa_console ───────────────────────────────────────────────
  registry.register({
    name: "qa_console",
    description: "Capture console messages from the current browser tab. Filter by log level.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      level: z
        .enum(["error", "warning", "info", "debug"])
        .optional()
        .describe("Minimum log level to include (default: info)"),
    },
    handler: async (input: { level?: string; }) => {
      const tab = getActiveTab();
      if (!tab) {
        return errorResult("No active browser tab. Use qa_navigate first.");
      }

      const levelOrder = ["error", "warning", "info", "debug"];
      const minLevel = input.level ?? "info";
      const minIndex = levelOrder.indexOf(minLevel);

      const filtered = tab.entry.consoleMessages.filter(msg => {
        const msgIndex = levelOrder.indexOf(
          msg.type === "warn" ? "warning" : msg.type,
        );
        return msgIndex >= 0 && msgIndex <= minIndex;
      });

      if (filtered.length === 0) {
        return textResult(
          `## Console Messages\n\nNo messages at level "${minLevel}" or above.`,
        );
      }

      const lines = filtered.map(
        msg =>
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
  });

  // ── qa_network ───────────────────────────────────────────────
  registry.register({
    name: "qa_network",
    description:
      "Analyze network requests from the current browser tab. Shows URLs, methods, status codes, and sizes.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      includeStatic: z
        .boolean()
        .optional()
        .describe(
          "Include static resources like images, fonts, scripts (default: false)",
        ),
    },
    handler: async (input: { includeStatic?: boolean; }) => {
      const tab = getActiveTab();
      if (!tab) {
        return errorResult("No active browser tab. Use qa_navigate first.");
      }

      const staticTypes = new Set(["image", "font", "stylesheet", "media"]);
      let requests = tab.entry.networkRequests;
      if (!input.includeStatic) {
        requests = requests.filter(r => !staticTypes.has(r.resourceType));
      }

      if (requests.length === 0) {
        return textResult(`## Network Requests\n\nNo requests captured.`);
      }

      const totalSize = requests.reduce(
        (sum, r) => sum + parseInt(r.contentLength || "0", 10),
        0,
      );
      const errors = requests.filter(r => r.status >= 400);

      const rows = requests
        .slice(0, 50) // Limit to 50 requests
        .map(
          r =>
            `| ${r.method} | ${r.status} | ${r.resourceType} | ${r.contentLength} | ${
              r.url.slice(0, 80)
            } |`,
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
  });

  // ── qa_viewport ──────────────────────────────────────────────
  registry.register({
    name: "qa_viewport",
    description:
      "Set the browser viewport size for responsive testing. Use presets or custom dimensions.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      preset: z
        .enum(["mobile", "tablet", "desktop"])
        .optional()
        .describe("Viewport preset (overrides width/height)"),
      width: z.number().optional().describe("Custom viewport width in pixels"),
      height: z.number().optional().describe(
        "Custom viewport height in pixels",
      ),
    },
    handler: async (
      input: { preset?: string; width?: number; height?: number; },
    ) => {
      try {
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult(
            "Browser tab has no active page. Navigate to a URL first.",
          );
        }

        let width: number;
        let height: number;

        if (input.preset && input.preset in VIEWPORT_PRESETS) {
          const preset = VIEWPORT_PRESETS[input.preset]!;
          width = preset.width;
          height = preset.height;
        } else if (input.width && input.height) {
          width = input.width;
          height = input.height;
        } else {
          return errorResult(
            "Provide either a preset or both width and height.",
          );
        }

        await tab.page.setViewportSize({ width, height });

        return textResult(
          [
            `## Viewport Updated`,
            `- **Size:** ${width}x${height}`,
            `- **Preset:** ${input.preset ?? "custom"}`,
          ].join("\n"),
        );
      } catch (err: unknown) {
        return errorResult(`Viewport change failed: ${(err as Error).message}`);
      }
    },
  });

  // ── qa_evaluate ──────────────────────────────────────────────
  registry.register({
    name: "qa_evaluate",
    description:
      "Execute a JavaScript expression in the current browser tab and return the result.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      expression: z.string().describe(
        "JavaScript expression to evaluate in the page context",
      ),
    },
    handler: async (input: { expression: string; }) => {
      try {
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult(
            "Browser tab has no active page. Navigate to a URL first.",
          );
        }

        const result = await tab.page.evaluate(input.expression);
        const output = typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2);

        return textResult(
          [
            `## Evaluate Result`,
            `- **Expression:** \`${input.expression.slice(0, 100)}\``,
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
  });

  // ── qa_tabs ──────────────────────────────────────────────────
  registry.register({
    name: "qa_tabs",
    description: "Manage browser tabs: list open tabs, switch between them, or close a tab.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      action: z.enum(["list", "switch", "close"]).describe(
        "Tab action to perform",
      ),
      index: z.number().optional().describe(
        "Tab index (required for switch/close)",
      ),
    },
    handler: async (input: { action: string; index?: number; }) => {
      try {
        switch (input.action) {
          case "list": {
            const tabList = await listTabs();
            if (tabList.length === 0) {
              return textResult("## Browser Tabs\n\nNo open tabs.");
            }
            const active = getActiveTab();
            const rows = tabList.map(
              t =>
                `| ${t.index === active?.index ? "**>>**" : ""} ${t.index} | ${
                  t.title.slice(0, 40)
                } | ${t.url.slice(0, 60)} |`,
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
            if (input.index === undefined) {
              return errorResult("Tab index required for switch action.");
            }
            const { index } = await getOrCreateTab(input.index);
            return textResult(`Switched to tab ${index}.`);
          }
          case "close": {
            if (input.index === undefined) {
              return errorResult("Tab index required for close action.");
            }
            const closed = await closeTab(input.index);
            return closed
              ? textResult(`Closed tab ${input.index}.`)
              : errorResult(`Tab ${input.index} not found.`);
          }
          default:
            return errorResult(`Unknown action: ${input.action}`);
        }
      } catch (err: unknown) {
        return errorResult(`Tab operation failed: ${(err as Error).message}`);
      }
    },
  });

  // ── qa_test_run ──────────────────────────────────────────────
  registry.register({
    name: "qa_test_run",
    description:
      "Run Vitest tests on a specific file or directory. Returns test results with pass/fail status.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      target: z.string().describe(
        "Test file or directory path (e.g., 'src/lib/mcp')",
      ),
      reporter: z.enum(["verbose", "default"]).optional().describe(
        "Test reporter format",
      ),
    },
    handler: async (input: { target: string; reporter?: string; }) => {
      if (!isValidPath(input.target)) {
        return errorResult(
          "Invalid path. Use alphanumeric characters, dots, slashes, and dashes only.",
        );
      }

      const reporter = input.reporter ?? "verbose";
      const args = ["vitest", "run", input.target, `--reporter=${reporter}`];

      try {
        const output = execFileSync("yarn", args, {
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return textResult(
          [
            `## Test Results: PASS`,
            `- **Target:** ${input.target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      } catch (err: unknown) {
        const output = (err as { stdout?: string; }).stdout ?? String(err);
        return errorResult(
          [
            `## Test Results: FAIL`,
            `- **Target:** ${input.target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      }
    },
  });

  // ── qa_coverage ──────────────────────────────────────────────
  registry.register({
    name: "qa_coverage",
    description:
      "Analyze test coverage for a specific file or directory. Returns line, function, branch, and statement coverage.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {
      target: z.string().describe(
        "Source file or directory to analyze coverage for",
      ),
      format: z
        .enum(["summary", "detailed"])
        .optional()
        .describe("Output format (default: summary)"),
    },
    handler: async (input: { target: string; format?: string; }) => {
      if (!isValidPath(input.target)) {
        return errorResult(
          "Invalid path. Use alphanumeric characters, dots, slashes, and dashes only.",
        );
      }

      const format = input.format ?? "summary";
      const args = [
        "vitest",
        "run",
        input.target,
        "--coverage",
        "--coverage.reporter=json-summary",
      ];

      try {
        const output = execFileSync("yarn", args, {
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Try to extract coverage summary from output
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
              `- **Target:** ${input.target}`,
              `- **Format:** ${format}`,
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
            `- **Target:** ${input.target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      } catch (err: unknown) {
        const output = (err as { stdout?: string; }).stdout ?? String(err);
        return errorResult(
          [
            `## Coverage Analysis Failed`,
            `- **Target:** ${input.target}`,
            ``,
            "```",
            output.slice(-3000),
            "```",
          ].join("\n"),
        );
      }
    },
  });

  // ── qa_mobile_audit ──────────────────────────────────────────
  registry.register({
    name: "qa_mobile_audit",
    description:
      "Audit the current page for iPhone/mobile compatibility issues like 100vh usage and missing safe-areas.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: {},
    handler: async () => {
      try {
        const tab = getActiveTab();
        if (!tab) {
          return errorResult("No active browser tab. Use qa_navigate first.");
        }
        if (!tab.page) {
          return errorResult(
            "Browser tab has no active page. Navigate to a URL first.",
          );
        }

        // Set viewport to iPhone 15 Pro size
        await tab.page.setViewportSize(VIEWPORT_PRESETS.mobile!);

        const audit = await tab.page.evaluate(() => {
          const issues: Array<
            { type: string; details: string; impact: string; }
          > = [];

          // 1. Check for 100vh usage in inline styles (which often override CSS)
          const vhElements = Array.from(document.querySelectorAll("*"))
            .filter(el => {
              const style = (el as HTMLElement).style;
              return style.height?.includes("vh")
                || style.minHeight?.includes("vh");
            });

          if (vhElements.length > 0) {
            issues.push({
              type: "100vh Usage",
              details:
                `Found ${vhElements.length} elements with inline 100vh. Use 100dvh for better mobile support.`,
              impact: "moderate",
            });
          }

          // 2. Check for small touch targets
          const touchTargets = Array.from(
            document.querySelectorAll("button, a, [role='button']"),
          );
          const smallTargets = touchTargets.filter(el => {
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

          // 3. Check for horizontal scrolling
          const hasHorizontalScroll = document.documentElement.scrollWidth
            > document.documentElement.clientWidth;
          if (hasHorizontalScroll) {
            issues.push({
              type: "Horizontal Scroll",
              details: "The page has horizontal scrolling on mobile viewport.",
              impact: "serious",
            });
          }

          // 4. Check for viewport meta tag
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
        }) as Array<{ type: string; details: string; impact: string; }>;

        const lines = audit.map(
          i => `- **[${i.impact.toUpperCase()}]** ${i.type}: ${i.details}`,
        );

        return textResult(
          [
            `## Mobile Compatibility Audit (iPhone 15)`,
            lines.length > 0
              ? lines.join("\n")
              : "✅ No common mobile issues found.",
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
  });
}
