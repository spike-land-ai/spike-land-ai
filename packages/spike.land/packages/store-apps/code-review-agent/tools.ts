/**
 * Code Review Agent — Standalone Tool Definitions
 *
 * Convention-based review (9 tools) + PR review (4 tools) = 13 tools.
 * Migrated from src/lib/mcp/server/tools/review.ts and review-pr.ts.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { jsonResult, safeToolCall, textResult } from "../shared/tool-helpers";

/* ── In-memory stores (per-server instance) ─────────────────────── */

interface ReviewReport {
  id: string;
  userId: string;
  findings: ReviewFinding[];
  score: number;
  summary: string;
  createdAt: string;
}

interface ReviewFinding {
  ruleId: string;
  severity: string;
  message: string;
  file?: string;
  line?: number;
}

interface ConventionSet {
  id: string;
  name: string;
  rules: Array<{
    id: string;
    name: string;
    description: string;
    pattern: string;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
}

const reports = new Map<string, ReviewReport>();
const conventionSets = new Map<string, ConventionSet>();

/* ── PR Review helpers ──────────────────────────────────────────── */

interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  isKeyFile: boolean;
}

interface ConventionIssue {
  rule: string;
  message: string;
  severity: "info" | "warning" | "error";
}

interface SecurityVulnerability {
  severity: "low" | "medium" | "high" | "critical";
  cwe: string;
  description: string;
  location: string;
  fixSuggestion: string;
}

function matchesGlob(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§GLOBSTAR§")
    .replace(/\*/g, "[^/]*")
    .replace(/§GLOBSTAR§/g, ".*");
  return new RegExp(`^${regexStr}$`).test(path);
}

const SECURITY_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityVulnerability["severity"];
  cwe: string;
  description: string;
  fix: string;
}> = [
  {
    pattern: /eval\s*\(/,
    severity: "critical",
    cwe: "CWE-95",
    description: "Use of eval() enables arbitrary code execution.",
    fix: "Replace eval() with safer alternatives such as JSON.parse() or explicit function calls.",
  },
  {
    pattern: /dangerouslySetInnerHTML/,
    severity: "high",
    cwe: "CWE-79",
    description: "dangerouslySetInnerHTML can introduce XSS vulnerabilities.",
    fix: "Sanitize HTML with DOMPurify before rendering, or use safer React patterns.",
  },
  {
    pattern: /password\s*=\s*['"][^'"]{1,}/i,
    severity: "critical",
    cwe: "CWE-798",
    description: "Hardcoded password detected in source code.",
    fix: "Move credentials to environment variables and access them via process.env.",
  },
  {
    pattern: /process\.env\.[A-Z_]+ \|\| ['"][^'"]{8,}/,
    severity: "medium",
    cwe: "CWE-798",
    description: "Hardcoded fallback secret as default value for env variable.",
    fix: "Remove the hardcoded fallback; fail fast when the secret is missing.",
  },
  {
    pattern: /innerHTML\s*=/,
    severity: "medium",
    cwe: "CWE-79",
    description: "Direct assignment to innerHTML may lead to XSS.",
    fix: "Use textContent for plain text, or sanitize the HTML before assignment.",
  },
  {
    pattern: /Math\.random\s*\(\)/,
    severity: "low",
    cwe: "CWE-338",
    description: "Math.random() is not cryptographically secure.",
    fix: "Use crypto.getRandomValues() or the Node.js crypto module for security-sensitive values.",
  },
  {
    pattern: /exec\s*\(\s*`[^`]*\$\{/,
    severity: "critical",
    cwe: "CWE-78",
    description: "OS command injection: user-controlled data interpolated into exec call.",
    fix: "Use execFile() with an explicit argument array, never string interpolation.",
  },
  {
    pattern: /https?:\/\/\S+\s+(as\s+any|:\s*any)/,
    severity: "low",
    cwe: "CWE-704",
    description: "Unsafe type assertion on an HTTP response may mask runtime errors.",
    fix: "Define a proper response type and use a type guard or Zod schema to validate.",
  },
];

const CONVENTION_CHECKS: Array<{
  rule: string;
  pattern: RegExp;
  severity: ConventionIssue["severity"];
  message: string;
}> = [
  {
    rule: "no-any",
    pattern: /:\s*any\b|as\s+any\b|<any>/,
    severity: "error",
    message: "Avoid 'any' type — use 'unknown' or a proper type instead.",
  },
  {
    rule: "no-ts-ignore",
    pattern: /@ts-ignore|@ts-nocheck/,
    severity: "error",
    message: "@ts-ignore / @ts-nocheck suppresses type errors — fix the underlying issue.",
  },
  {
    rule: "no-eslint-disable",
    pattern: /eslint-disable/,
    severity: "warning",
    message: "eslint-disable comment found — fix the lint issue instead.",
  },
  {
    rule: "no-console",
    pattern: /console\.(log|warn|error|debug)\s*\(/,
    severity: "warning",
    message: "console.* calls should be replaced with the project logger.",
  },
  {
    rule: "prisma-dynamic-import",
    pattern: /import prisma from/,
    severity: "warning",
    message: "Use dynamic Prisma import: const prisma = (await import('@/lib/prisma')).default",
  },
  {
    rule: "no-todo-fixme",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/i,
    severity: "info",
    message: "TODO/FIXME comment found — consider creating a tracked issue.",
  },
];

function runSecurityScan(
  content: string,
  filePath: string,
  thorough: boolean,
): SecurityVulnerability[] {
  const lines = content.split("\n");
  const vulns: SecurityVulnerability[] = [];
  const patterns = thorough
    ? SECURITY_PATTERNS
    : SECURITY_PATTERNS.filter((p) => p.severity === "critical" || p.severity === "high");
  for (const { pattern, severity, cwe, description, fix } of patterns) {
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        vulns.push({
          severity,
          cwe,
          description,
          location: `${filePath}:${idx + 1}`,
          fixSuggestion: fix,
        });
      }
    });
  }
  return vulns;
}

function runConventionCheck(content: string, filePath: string): ConventionIssue[] {
  const lines = content.split("\n");
  const issues: ConventionIssue[] = [];
  for (const { rule, pattern, severity, message } of CONVENTION_CHECKS) {
    if (lines.some((line) => pattern.test(line))) issues.push({ rule, message, severity });
  }
  const fileName = filePath.split("/").pop() ?? "";
  if (
    (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) &&
    /^[a-z]/.test(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".")
  ) {
    issues.push({
      rule: "component-naming",
      message: `Component file '${fileName}' should use PascalCase.`,
      severity: "warning",
    });
  }
  return issues;
}

/* ── Schemas ────────────────────────────────────────────────────── */

const GetDiffSchema = z.object({
  pr_number: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Pull request number to fetch the diff for."),
  branch: z.string().optional().describe("Branch name to diff against the default branch."),
  file_filter: z.string().optional().describe("Glob pattern to filter files."),
});

const SuggestFixSchema = z.object({
  file_path: z.string().min(1).describe("Path to the file containing the issue."),
  line_number: z.number().int().min(1).describe("Line number where the issue was identified."),
  issue_description: z.string().min(1).describe("Description of the code issue to fix."),
});

const CheckConventionsSchema = z.object({
  file_paths: z.array(z.string().min(1)).min(1).describe("List of file paths to check."),
});

const SecurityScanSchema = z.object({
  file_paths: z.array(z.string().min(1)).min(1).describe("List of file paths to scan."),
  scan_type: z.enum(["quick", "thorough"]).optional().default("quick").describe("Scan depth."),
});

/* ── Tool Definitions ───────────────────────────────────────────── */

export const codeReviewAgentTools: StandaloneToolDefinition[] = [
  // ── Convention-based review (from review.ts) ──
  {
    name: "review_create_conventions",
    description: "Create a named set of convention rules.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({
      name: z.string(),
      rules: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          pattern: z.string(),
          severity: z.enum(["info", "warning", "error"]),
          message: z.string(),
        }),
      ),
    }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { name: string; rules: ConventionSet["rules"] };
      return safeToolCall("review_create_conventions", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const set: ConventionSet = { id, name: a.name, rules: a.rules };
        conventionSets.set(id, set);
        return jsonResult(`Convention set ${a.name} created with ID: ${id}`, set);
      });
    },
  },
  {
    name: "review_code",
    description: "Perform a comprehensive code review against conventions.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
      convention_set_id: z.string().optional(),
    }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as {
        files: Array<{ path: string; content: string }>;
        convention_set_id?: string;
      };
      return safeToolCall("review_code", async () => {
        const { checkConventions, getBuiltInRules } = await import("@/lib/review/engine");
        const conventions = a.convention_set_id
          ? conventionSets.get(a.convention_set_id)
          : { id: "default", name: "Default", rules: getBuiltInRules("nextjs") };
        if (!conventions) throw new Error(`Convention set ${a.convention_set_id} not found`);
        const findings = checkConventions(a.files, conventions.rules);
        const id = Math.random().toString(36).substring(2, 11);
        const report: ReviewReport = {
          id,
          userId: "system",
          findings,
          score: Math.max(0, 100 - findings.length * 10),
          summary: `Found ${findings.length} convention violations`,
          createdAt: new Date().toISOString(),
        };
        reports.set(id, report);
        return jsonResult(`Review complete. Report ID: ${id}`, report);
      });
    },
  },
  {
    name: "review_analyze_complexity",
    description: "Analyze cyclomatic complexity and maintainability index.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
    }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { files: Array<{ path: string; content: string }> };
      return safeToolCall("review_analyze_complexity", async () => {
        const { analyzeComplexity } = await import("@/lib/review/engine");
        const allFindings: ReviewFinding[] = [];
        for (const file of a.files) {
          const findings = analyzeComplexity(file.content, file.path);
          allFindings.push(...findings);
        }
        return jsonResult(
          `Complexity analysis complete for ${a.files.length} file(s)`,
          allFindings,
        );
      });
    },
  },
  {
    name: "review_get_report",
    description: "Retrieve a complete review report.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({ report_id: z.string() }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { report_id: string };
      return safeToolCall("review_get_report", async () => {
        const report = reports.get(a.report_id);
        if (!report) throw new Error(`Report ${a.report_id} not found`);
        return jsonResult(`Review Report ${a.report_id}`, report);
      });
    },
  },
  {
    name: "review_list_conventions",
    description: "List all available convention sets.",
    category: "review",
    tier: "workspace",
    inputSchema: {},
    handler: async (_input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("review_list_conventions", async () => {
        const list = Array.from(conventionSets.values());
        return jsonResult(`Found ${list.length} convention set(s)`, list);
      }),
  },
  {
    name: "review_get_built_in_rules",
    description: "Get the default built-in convention rules.",
    category: "review",
    tier: "workspace",
    inputSchema: {},
    handler: async (_input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("review_get_built_in_rules", async () => {
        const { getBuiltInRules } = await import("@/lib/review/engine");
        const rules = getBuiltInRules("nextjs");
        return jsonResult(`Found ${rules.length} built-in rule(s)`, rules);
      }),
  },
  {
    name: "review_estimate_effort",
    description: "Estimate refactoring effort based on review findings.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({ report_id: z.string() }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { report_id: string };
      return safeToolCall("review_estimate_effort", async () => {
        const report = reports.get(a.report_id);
        if (!report) throw new Error(`Report ${a.report_id} not found`);
        const effortHours = report.findings.length * 0.5;
        return jsonResult(`Estimated refactoring effort for report ${a.report_id}`, {
          hours: effortHours,
          difficulty: effortHours > 10 ? "high" : effortHours > 4 ? "medium" : "low",
        });
      });
    },
  },
  {
    name: "review_get_conventions",
    description: "Retrieve a convention set definition.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({ convention_id: z.string() }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { convention_id: string };
      return safeToolCall("review_get_conventions", async () => {
        const set = conventionSets.get(a.convention_id);
        if (!set) throw new Error(`Convention set ${a.convention_id} not found`);
        return jsonResult(`Convention set ${a.convention_id}`, set);
      });
    },
  },
  {
    name: "review_project_rules",
    description: "Get built-in project rules.",
    category: "review",
    tier: "workspace",
    inputSchema: z.object({ project_type: z.string().optional().default("nextjs") }).shape,
    handler: async (args: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const a = args as { project_type: string };
      return safeToolCall("review_project_rules", async () => {
        const { getBuiltInRules } = await import("@/lib/review/engine");
        const rules = getBuiltInRules(a.project_type);
        return jsonResult(`Built-in rules for ${a.project_type}`, rules);
      });
    },
  },

  // ── PR Review (from review-pr.ts) ──
  {
    name: "review_get_diff",
    description: "Get the diff for a pull request or branch with file counts and key files.",
    category: "review-pr",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetDiffSchema.shape,
    handler: async (
      {
        pr_number,
        branch,
        file_filter,
      }: {
        pr_number?: number;
        branch?: string;
        file_filter?: string;
      },
      _ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("review_get_diff", async () => {
        if (!pr_number && !branch) {
          return textResult("Provide either pr_number or branch to fetch a diff.");
        }
        const label = pr_number ? `PR #${pr_number}` : `branch '${branch}'`;
        const rawFiles: FileDiff[] = [
          { path: "src/app/api/example/route.ts", additions: 42, deletions: 8, isKeyFile: true },
          { path: "src/lib/utils/helper.ts", additions: 15, deletions: 3, isKeyFile: false },
          { path: "package.json", additions: 2, deletions: 2, isKeyFile: false },
          { path: "src/components/Button.tsx", additions: 5, deletions: 0, isKeyFile: false },
        ];
        const filtered = file_filter
          ? rawFiles.filter((f) => matchesGlob(f.path, file_filter))
          : rawFiles;
        if (filtered.length === 0) {
          return textResult(`No files match filter '${file_filter}' in ${label}.`);
        }
        const totalAdditions = filtered.reduce((s, f) => s + f.additions, 0);
        const totalDeletions = filtered.reduce((s, f) => s + f.deletions, 0);
        const keyFiles = filtered.filter((f) => f.isKeyFile).map((f) => f.path);
        let text = `**Diff for ${label}**\n\nTotal: +${totalAdditions} / -${totalDeletions} across ${filtered.length} file(s)\n`;
        if (keyFiles.length > 0) text += `Key files: ${keyFiles.join(", ")}\n`;
        text += "\n**Changed files:**\n\n";
        for (const f of filtered) {
          text += `- ${f.path}${f.isKeyFile ? " [KEY]" : ""}  +${f.additions}/-${f.deletions}\n`;
        }
        return textResult(text);
      }),
  },
  {
    name: "review_suggest_fix",
    description: "Suggest a concrete fix for a code issue at a specific file and line.",
    category: "review-pr",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SuggestFixSchema.shape,
    handler: async (
      {
        file_path,
        line_number,
        issue_description,
      }: {
        file_path: string;
        line_number: number;
        issue_description: string;
      },
      _ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("review_suggest_fix", async () => {
        const issueLower = issue_description.toLowerCase();
        let beforeCode: string, afterCode: string, explanation: string, confidence: number;
        if (issueLower.includes("any")) {
          beforeCode = `const data: any = response.json();`;
          afterCode = `const data: unknown = await response.json();\n// Validate with Zod or a type guard before use.`;
          explanation =
            "Replace 'any' with 'unknown' and validate the value before accessing its properties.";
          confidence = 0.92;
        } else if (issueLower.includes("console.log")) {
          beforeCode = `console.log("debug:", value);`;
          afterCode = `import logger from "@/lib/logger";\nlogger.debug("debug:", { value });`;
          explanation = "Use the project's structured logger instead of console.log.";
          confidence = 0.95;
        } else if (issueLower.includes("eval")) {
          beforeCode = `const result = eval(userInput);`;
          afterCode = `const result = JSON.parse(userInput);`;
          explanation = "eval() executes arbitrary code. Replace with a safe alternative.";
          confidence = 0.98;
        } else if (issueLower.includes("password") || issueLower.includes("secret")) {
          beforeCode = `const apiKey = "sk-live-abc123";`;
          afterCode = `const apiKey = process.env["API_KEY"];\nif (!apiKey) throw new Error("API_KEY is not configured.");`;
          explanation =
            "Move secrets to environment variables. Never hardcode credentials in source.";
          confidence = 0.99;
        } else {
          beforeCode = `// Original code at ${file_path}:${line_number}`;
          afterCode = `// Refactored code addressing: ${issue_description}`;
          explanation = `Issue identified at ${file_path}:${line_number}. Apply minimal change for: ${issue_description}`;
          confidence = 0.6;
        }
        return textResult(
          `**Fix suggestion for ${file_path}:${line_number}**\n\nIssue: ${issue_description}\nConfidence: ${Math.round(
            confidence * 100,
          )}%\n\n` +
            `**Before:**\n\`\`\`\n${beforeCode}\n\`\`\`\n\n**After:**\n\`\`\`\n${afterCode}\n\`\`\`\n\n**Explanation:** ${explanation}`,
        );
      }),
  },
  {
    name: "review_check_conventions",
    description:
      "Check source files against project conventions: no-any, no-ts-ignore, naming, etc.",
    category: "review-pr",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: CheckConventionsSchema.shape,
    handler: async (
      { file_paths }: { file_paths: string[] },
      _ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("review_check_conventions", async () => {
        const { readFile } = await import("fs/promises");
        let totalIssues = 0;
        let text = `**Convention Check (${file_paths.length} file(s))**\n\n`;
        for (const filePath of file_paths) {
          let content: string;
          try {
            content = await readFile(filePath, "utf-8");
          } catch {
            text += `- **${filePath}** — could not read file (skipped)\n`;
            continue;
          }
          const issues = runConventionCheck(content, filePath);
          totalIssues += issues.length;
          if (issues.length === 0) text += `- **${filePath}** — OK\n`;
          else {
            text += `- **${filePath}** — ${issues.length} issue(s)\n`;
            for (const issue of issues) {
              text += `  [${issue.severity.toUpperCase()}] [${issue.rule}] ${issue.message}\n`;
            }
          }
        }
        text += `\n**Total issues: ${totalIssues}**`;
        return textResult(text);
      }),
  },
  {
    name: "review_security_scan",
    description:
      "Scan source files for security vulnerabilities with CWE references and fix suggestions.",
    category: "review-pr",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SecurityScanSchema.shape,
    handler: async (
      { file_paths, scan_type = "quick" }: { file_paths: string[]; scan_type?: string },
      _ctx: ServerContext,
    ): Promise<CallToolResult> =>
      safeToolCall("review_security_scan", async () => {
        const { readFile } = await import("fs/promises");
        const allVulns: SecurityVulnerability[] = [];
        const fileResults: Array<{ path: string; vulnCount: number; skipped: boolean }> = [];
        for (const filePath of file_paths) {
          let content: string;
          try {
            content = await readFile(filePath, "utf-8");
          } catch {
            fileResults.push({ path: filePath, vulnCount: 0, skipped: true });
            continue;
          }
          const vulns = runSecurityScan(content, filePath, scan_type === "thorough");
          allVulns.push(...vulns);
          fileResults.push({ path: filePath, vulnCount: vulns.length, skipped: false });
        }
        const criticalCount = allVulns.filter((v) => v.severity === "critical").length;
        const highCount = allVulns.filter((v) => v.severity === "high").length;
        const mediumCount = allVulns.filter((v) => v.severity === "medium").length;
        const lowCount = allVulns.filter((v) => v.severity === "low").length;
        let text = `**Security Scan (${scan_type}) — ${file_paths.length} file(s)**\n\nFindings: ${allVulns.length} total`;
        if (allVulns.length > 0) {
          text += ` (${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low)`;
        }
        text += "\n\n";
        for (const fr of fileResults) {
          if (fr.skipped) text += `- **${fr.path}** — could not read file (skipped)\n`;
          else if (fr.vulnCount === 0) text += `- **${fr.path}** — no vulnerabilities found\n`;
          else text += `- **${fr.path}** — ${fr.vulnCount} vulnerability(s)\n`;
        }
        if (allVulns.length > 0) {
          text += "\n**Vulnerability Details:**\n\n";
          for (const v of allVulns) {
            text += `### [${v.severity.toUpperCase()}] ${v.cwe}\nLocation: ${v.location}\nDescription: ${v.description}\nFix: ${v.fixSuggestion}\n\n`;
          }
        }
        return textResult(text);
      }),
  },
];
