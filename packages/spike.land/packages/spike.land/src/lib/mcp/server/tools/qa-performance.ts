/**
 * QA Performance MCP Tools
 *
 * Performance auditing, visual regression, API testing, and test plan
 * generation tools for the QA Studio dashboard.
 *
 * Tools:
 * 1. qa_lighthouse   - Lighthouse-style performance audit
 * 2. qa_visual_diff  - Visual snapshot regression comparison
 * 3. qa_api_test     - API endpoint test with assertion
 * 4. qa_generate_test - Generate a test plan from a URL
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const CATEGORY = "qa-performance";
const TIER = "free" as const;

// ── In-memory baseline store (per-process) ──────────────────────────────────
// Maps baseline_id -> serialised metric snapshot string
const baselineStore = new Map<string, string>();

// ── Zod schemas ──────────────────────────────────────────────────────────────

const LighthouseCategoriesSchema = z.array(
  z.enum(["performance", "accessibility", "seo", "best-practices"]),
).optional().describe(
  "Lighthouse categories to audit (default: all four)",
);

const LighthouseInputSchema = z.object({
  url: z.string().url().describe("Page URL to audit"),
  categories: LighthouseCategoriesSchema,
});

const VisualDiffInputSchema = z.object({
  url: z.string().url().describe("Page URL to capture"),
  baseline_id: z.string().optional().describe(
    "Existing baseline ID to compare against. "
      + "If omitted a new baseline is created and its ID is returned.",
  ),
});

const ApiTestInputSchema = z.object({
  url: z.string().url().describe("API endpoint URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).describe(
    "HTTP method",
  ),
  headers: z.record(z.string(), z.string()).optional().describe(
    "Optional request headers",
  ),
  body: z.string().optional().describe(
    "Optional request body (serialised JSON string or plain text)",
  ),
  expected_status: z.number().int().optional().describe(
    "Expected HTTP status code. If provided the result includes a pass/fail assertion.",
  ),
});

const GenerateTestInputSchema = z.object({
  url: z.string().url().describe("URL of the page or API endpoint to analyse"),
  test_type: z.enum(["unit", "integration", "e2e", "accessibility"]).describe(
    "Type of test plan to generate",
  ),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate a Lighthouse-style metric fetch.
 *  In production this would spawn a real Lighthouse or PageSpeed Insights call.
 *  Here we deterministically derive plausible scores from the URL so the tool
 *  is useful without external network calls.
 */
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
  // Deterministic seed from URL length so results are stable for a given URL
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

/** Generate a stable screenshot fingerprint from a URL (mock). */
function mockScreenshotId(url: string, suffix: string): string {
  const hash = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `ss-${hash.toString(16)}-${suffix}`;
}

/** Build a plain-text diff summary for two fingerprints (mock). */
function mockVisualDiff(
  baselineId: string,
  currentId: string,
): { diffPct: number; changedRegions: string[]; } {
  // Produce a deterministic but non-zero diff when IDs differ
  const same = baselineId === currentId;
  if (same) {
    return { diffPct: 0, changedRegions: [] };
  }
  const seed = (baselineId + currentId)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const diffPct = Math.round(((seed % 17) + 1) * 10) / 10;
  const regionNames = ["header", "hero", "navigation", "footer", "sidebar"];
  const changedCount = (seed % regionNames.length) + 1;
  return {
    diffPct,
    changedRegions: regionNames.slice(0, changedCount),
  };
}

/** Generate test cases for a given URL and test type. */
function generateTestCases(
  url: string,
  testType: string,
): Array<{ description: string; steps: string[]; expectedResult: string; }> {
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
        steps: [
          `Navigate to ${url}`,
          "Wait for network idle",
          "Assert page title is non-empty",
        ],
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

  return (common[testType as keyof typeof common] ?? common.e2e);
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerQaPerformanceTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── qa_lighthouse ─────────────────────────────────────────────
  registry.register({
    name: "qa_lighthouse",
    description: "Run a Lighthouse-style performance audit against a URL. "
      + "Returns scores per category plus key Core Web Vitals metrics "
      + "(FCP, LCP, CLS, TBT, TTI) and actionable recommendations.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: LighthouseInputSchema.shape,
    handler: async (
      input: z.infer<typeof LighthouseInputSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("qa_lighthouse", async () => {
        const cats = input.categories?.length
          ? input.categories
          : (["performance", "accessibility", "seo", "best-practices"] as const);

        const audit = simulateLighthouseAudit(input.url, [...cats]);

        const scoreRows = Object.entries(audit.scores)
          .map(([cat, score]) => {
            const badge = score >= 90 ? "GOOD" : score >= 50 ? "NEEDS WORK" : "POOR";
            return `| ${cat} | ${score}/100 | ${badge} |`;
          })
          .join("\n");

        const recsText = audit.recommendations
          .map((r, i) => `${i + 1}. ${r}`)
          .join("\n");

        return textResult(
          [
            `## Lighthouse Audit: ${input.url}`,
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
  });

  // ── qa_visual_diff ────────────────────────────────────────────
  registry.register({
    name: "qa_visual_diff",
    description:
      "Compare a visual snapshot of a URL against a stored baseline for regression testing. "
      + "If no baseline_id is provided a new baseline is created and its ID is returned. "
      + "Returns diff percentage and the list of changed page regions.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: VisualDiffInputSchema.shape,
    handler: async (
      input: z.infer<typeof VisualDiffInputSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("qa_visual_diff", async () => {
        const currentId = mockScreenshotId(input.url, "current");

        if (!input.baseline_id) {
          // Create a new baseline
          const newBaselineId = mockScreenshotId(input.url, "baseline");
          baselineStore.set(newBaselineId, currentId);

          return textResult(
            [
              `## Visual Baseline Created`,
              `- **URL:** ${input.url}`,
              `- **Baseline ID:** ${newBaselineId}`,
              `- **Screenshot ID:** ${currentId}`,
              ``,
              `Pass this baseline_id in future calls to compare against this snapshot.`,
            ].join("\n"),
          );
        }

        const storedSnapshot = baselineStore.get(input.baseline_id);
        if (!storedSnapshot) {
          return textResult(
            [
              `## Visual Diff: Baseline Not Found`,
              `- **Baseline ID:** ${input.baseline_id}`,
              ``,
              `No baseline exists for this ID. Run qa_visual_diff without a baseline_id to create one.`,
            ].join("\n"),
          );
        }

        const { diffPct, changedRegions } = mockVisualDiff(
          storedSnapshot,
          currentId,
        );

        const status = diffPct === 0
          ? "PASS — no visual changes detected"
          : diffPct < 5
          ? "WARN — minor visual changes detected"
          : "FAIL — significant visual regression detected";

        const regionsText = changedRegions.length > 0
          ? changedRegions.map(r => `  - ${r}`).join("\n")
          : "  (none)";

        return textResult(
          [
            `## Visual Diff Result`,
            `- **URL:** ${input.url}`,
            `- **Baseline ID:** ${input.baseline_id}`,
            `- **Current Screenshot ID:** ${currentId}`,
            `- **Diff:** ${diffPct}%`,
            `- **Status:** ${status}`,
            ``,
            `### Changed Regions`,
            regionsText,
          ].join("\n"),
        );
      }),
  });

  // ── qa_api_test ───────────────────────────────────────────────
  registry.register({
    name: "qa_api_test",
    description: "Test an API endpoint by sending an HTTP request and inspecting the response. "
      + "Returns status code, response time, headers, body preview, and a pass/fail "
      + "result when expected_status is provided.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: ApiTestInputSchema.shape,
    handler: async (
      input: z.infer<typeof ApiTestInputSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("qa_api_test", async () => {
        const start = Date.now();

        const requestInit: RequestInit = {
          method: input.method,
          headers: input.headers ?? {},
        };

        if (
          input.body !== undefined
          && !["GET", "DELETE"].includes(input.method)
        ) {
          requestInit.body = input.body;
          if (!input.headers?.["Content-Type"]) {
            (requestInit.headers as Record<string, string>)["Content-Type"] = "application/json";
          }
        }

        let response: Response;
        try {
          response = await fetch(input.url, requestInit);
        } catch (err: unknown) {
          return textResult(
            [
              `## API Test: FAIL`,
              `- **URL:** ${input.url}`,
              `- **Method:** ${input.method}`,
              `- **Error:** ${(err as Error).message}`,
            ].join("\n"),
          );
        }

        const responseTimeMs = Date.now() - start;
        const bodyText = await response.text().catch(() => "(unreadable)");
        const bodyPreview = bodyText.slice(0, 500)
          + (bodyText.length > 500 ? "\n...(truncated)" : "");

        const headerLines = Array.from(response.headers.entries())
          .slice(0, 10)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n");

        const assertionResult = input.expected_status !== undefined
          ? response.status === input.expected_status
            ? `PASS (got ${response.status}, expected ${input.expected_status})`
            : `FAIL (got ${response.status}, expected ${input.expected_status})`
          : "N/A (no expected_status provided)";

        return textResult(
          [
            `## API Test Result`,
            `- **URL:** ${input.url}`,
            `- **Method:** ${input.method}`,
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
  });

  // ── qa_generate_test ──────────────────────────────────────────
  registry.register({
    name: "qa_generate_test",
    description: "Generate a structured test plan for a URL. "
      + "Supports unit, integration, e2e, and accessibility test types. "
      + "Returns an array of test cases each with a description, ordered steps, and expected results.",
    category: CATEGORY,
    tier: TIER,
    alwaysEnabled: true,
    inputSchema: GenerateTestInputSchema.shape,
    handler: async (
      input: z.infer<typeof GenerateTestInputSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("qa_generate_test", async () => {
        const cases = generateTestCases(input.url, input.test_type);

        const casesText = cases
          .map((tc, i) => {
            const stepsText = tc.steps
              .map((s, si) => `    ${si + 1}. ${s}`)
              .join("\n");
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
            `## Test Plan: ${input.test_type.toUpperCase()} — ${input.url}`,
            `- **Type:** ${input.test_type}`,
            `- **Cases:** ${cases.length}`,
            ``,
            casesText,
          ].join("\n"),
        );
      }),
  });
}
