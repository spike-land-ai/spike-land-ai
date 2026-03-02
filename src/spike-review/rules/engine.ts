/**
 * Rule Engine
 *
 * Loads and executes review rules from BAZDMEG checkpoints,
 * CLAUDE.md files, and .spike-review.yaml configuration.
 */

import type { GateResult, GateStatus } from "../types.js";

const LARGE_CHANGE_THRESHOLD = 1000;
const MEDIUM_CHANGE_THRESHOLD = 500;

export interface ReviewRule {
  name: string;
  description: string;
  category: string;
  check: (context: RuleContext) => GateResult;
}

export interface RuleContext {
  diff: string;
  files: string[];
  additions: number;
  deletions: number;
  prTitle: string;
  prBody: string | null;
  claudeMdRules: string[];
}

// ── Helper: extract added lines from a unified diff ──────────────────────────

function getAddedLines(diff: string): string[] {
  return diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
}

// ── BAZDMEG Pre-PR Gate Rules ────────────────────────────────────────────────

const bazdmegPrePRRules: ReviewRule[] = [
  {
    name: "Unit Tests Present",
    description: "PR must include or modify test files",
    category: "bazdmeg:testing",
    check: (ctx) => {
      const testFiles = ctx.files.filter((f) => f.includes(".test.") || f.includes(".spec."));
      if (testFiles.length > 0) {
        return {
          name: "Unit Tests Present",
          status: "GREEN",
          detail: `${testFiles.length} test file(s) included`,
        };
      }
      const codeFiles = ctx.files.filter(
        (f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".jsx"),
      );
      if (codeFiles.length === 0) {
        return {
          name: "Unit Tests Present",
          status: "GREEN",
          detail: "No code files changed — tests not required",
        };
      }
      return {
        name: "Unit Tests Present",
        status: "RED",
        detail: "Code changed but no test files included in PR",
      };
    },
  },
  {
    name: "TypeScript Strict Compliance",
    description: "No `any` type, no eslint-disable, no ts-ignore",
    category: "bazdmeg:quality",
    check: (ctx) => {
      const issues: string[] = [];
      const addedLines = getAddedLines(ctx.diff);

      // Patterns that indicate code quality violations
      const violationPatterns: Array<{ pattern: RegExp; msg: string }> = [
        {
          pattern: /:\s*any\s*[,;)\]}]|as\s+any\b/,
          msg: "`any` type detected",
        },
        { pattern: /eslint-disable/, msg: "`eslint-disable` comment detected" },
        {
          pattern: /@ts-ignore|@ts-nocheck/,
          msg: "`@ts-ignore`/`@ts-nocheck` detected",
        },
      ];

      for (const line of addedLines) {
        for (const { pattern, msg } of violationPatterns) {
          if (pattern.test(line)) {
            issues.push(msg);
          }
        }
      }

      const uniqueIssues = [...new Set(issues)];
      if (uniqueIssues.length === 0) {
        return {
          name: "TypeScript Strict Compliance",
          status: "GREEN",
          detail: "No `any`, `eslint-disable`, or `@ts-ignore` found",
        };
      }
      return {
        name: "TypeScript Strict Compliance",
        status: "RED",
        detail: uniqueIssues.join("; "),
      };
    },
  },
  {
    name: "PR Description Quality",
    description: "PR description explains the thinking, not just the change",
    category: "bazdmeg:documentation",
    check: (ctx) => {
      if (!ctx.prBody || ctx.prBody.trim().length < 20) {
        return {
          name: "PR Description Quality",
          status: "RED",
          detail: "PR description is missing or too short (< 20 chars)",
        };
      }
      if (ctx.prBody.length < 100) {
        return {
          name: "PR Description Quality",
          status: "YELLOW",
          detail: "PR description is brief — consider explaining the 'why'",
        };
      }
      return {
        name: "PR Description Quality",
        status: "GREEN",
        detail: "PR description appears substantive",
      };
    },
  },
  {
    name: "Security Patterns",
    description: "No hardcoded secrets, API keys, or dangerous patterns",
    category: "bazdmeg:security",
    check: (ctx) => {
      const addedLines = getAddedLines(ctx.diff);

      // Detect hardcoded credentials and dangerous function calls in added code
      const securityPatterns: Array<{ pattern: RegExp; msg: string }> = [
        {
          pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
          msg: "Potential API key",
        },
        {
          pattern: /password\s*[:=]\s*["'][^"']+["']/i,
          msg: "Hardcoded password",
        },
        {
          pattern: /(secret|token)\s*[:=]\s*["'][A-Za-z0-9+/=]{10,}["']/i,
          msg: "Potential secret/token",
        },
        { pattern: /innerHTML\s*=/, msg: "innerHTML assignment (XSS risk)" },
      ];

      const found: string[] = [];
      for (const line of addedLines) {
        for (const { pattern, msg } of securityPatterns) {
          if (pattern.test(line)) {
            found.push(msg);
          }
        }
      }

      const uniqueFindings = [...new Set(found)];
      if (uniqueFindings.length === 0) {
        return {
          name: "Security Patterns",
          status: "GREEN",
          detail: "No security anti-patterns detected",
        };
      }
      return {
        name: "Security Patterns",
        status: "RED",
        detail: uniqueFindings.join("; "),
      };
    },
  },
  {
    name: "Change Size",
    description: "Large changes need extra review attention",
    category: "bazdmeg:review",
    check: (ctx) => {
      const total = ctx.additions + ctx.deletions;
      if (total > LARGE_CHANGE_THRESHOLD) {
        return {
          name: "Change Size",
          status: "RED",
          detail: `${total} lines changed — consider splitting this PR`,
        };
      }
      if (total > MEDIUM_CHANGE_THRESHOLD) {
        return {
          name: "Change Size",
          status: "YELLOW",
          detail: `${total} lines changed — large PR, review carefully`,
        };
      }
      return {
        name: "Change Size",
        status: "GREEN",
        detail: `${total} lines changed`,
      };
    },
  },
];

// ── Rule Engine ──────────────────────────────────────────────────────────────

export function getBuiltinRules(): ReviewRule[] {
  return [...bazdmegPrePRRules];
}

export function runGates(rules: ReviewRule[], context: RuleContext): GateResult[] {
  return rules.map((rule) => rule.check(context));
}

export function computeOverallStatus(gates: GateResult[]): GateStatus {
  if (gates.some((g) => g.status === "RED")) return "RED";
  if (gates.some((g) => g.status === "YELLOW")) return "YELLOW";
  return "GREEN";
}

export function formatGateResults(gates: GateResult[]): string {
  const overall = computeOverallStatus(gates);
  const statusEmoji = (s: GateStatus): string => {
    switch (s) {
      case "GREEN":
        return "✅";
      case "YELLOW":
        return "⚠️";
      case "RED":
        return "❌";
    }
  };

  let text = `## Spike Review — BAZDMEG Quality Gates ${statusEmoji(overall)}\n\n`;
  text += `| Gate | Status | Detail |\n`;
  text += `|------|--------|--------|\n`;
  for (const gate of gates) {
    text += `| ${gate.name} | ${statusEmoji(gate.status)} | ${gate.detail} |\n`;
  }

  text += `\n**Overall: ${overall}**`;
  if (overall === "RED") {
    text += ` — Issues must be addressed before merge.`;
  } else if (overall === "YELLOW") {
    text += ` — Minor concerns noted. Proceed with caution.`;
  } else {
    text += ` — All quality gates passing.`;
  }

  return text;
}
