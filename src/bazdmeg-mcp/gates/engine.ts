/**
 * Gates Engine
 *
 * 6 BAZDMEG quality gates: 5 copied from spike-review + workspace scope gate.
 * Runs quality checks against diffs and workspace state.
 */

import type { GateResult, GateStatus, ReviewRule, RuleContext } from "../types.js";

const LARGE_CHANGE_THRESHOLD = 1000;
const MEDIUM_CHANGE_THRESHOLD = 500;

// ── Helper: extract added lines from a unified diff ──────────────────────────

export function getAddedLines(diff: string): string[] {
  return diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
}

/**
 * Extract changed file paths from a unified diff.
 */
export function getChangedFiles(diff: string): string[] {
  const files: string[] = [];
  const regex = /^(?:diff --git a\/(.+?) b\/|^\+\+\+ b\/(.+?)$)/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(diff)) !== null) {
    const file = match[1] ?? match[2];
    if (file && !files.includes(file)) {
      files.push(file);
    }
  }
  return files;
}

/**
 * Count additions and deletions from a unified diff.
 */
export function countChanges(diff: string): { additions: number; deletions: number } {
  const lines = diff.split("\n");
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}

// ── BAZDMEG Pre-PR Gate Rules ────────────────────────────────────────────────

const bazdmegRules: ReviewRule[] = [
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
  {
    name: "Workspace Scope Compliance",
    description: "All changed files must fall within declared workspace paths",
    category: "bazdmeg:workspace",
    check: (ctx) => {
      if (!ctx.allowedPaths || ctx.allowedPaths.length === 0) {
        return {
          name: "Workspace Scope Compliance",
          status: "GREEN",
          detail: "No workspace restrictions active",
        };
      }

      const outOfScope = ctx.files.filter((file) => {
        const normalized = file.replace(/^\.\//, "").replace(/^\//, "");
        return !ctx.allowedPaths!.some((allowed) => normalized.startsWith(allowed));
      });

      if (outOfScope.length === 0) {
        return {
          name: "Workspace Scope Compliance",
          status: "GREEN",
          detail: `All ${ctx.files.length} changed files are within workspace scope`,
        };
      }

      return {
        name: "Workspace Scope Compliance",
        status: "RED",
        detail: `${outOfScope.length} file(s) outside workspace: ${outOfScope.slice(0, 3).join(", ")}${outOfScope.length > 3 ? "..." : ""}`,
      };
    },
  },
];

// ── Rule Engine ──────────────────────────────────────────────────────────────

export function getBuiltinRules(): ReviewRule[] {
  return [...bazdmegRules];
}

export function getRuleByName(name: string): ReviewRule | undefined {
  return bazdmegRules.find((r) => r.name === name);
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
        return "pass";
      case "YELLOW":
        return "warn";
      case "RED":
        return "fail";
    }
  };

  let text = `## BAZDMEG Quality Gates [${statusEmoji(overall).toUpperCase()}]\n\n`;
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
