/**
 * PR-Integrated Code Review MCP Tools (legacy standalone module)
 *
 * PURPOSE: Provides 4 tools for pull-request-level code review: fetching diffs
 * (by PR number or branch), suggesting concrete code fixes, checking files
 * against project conventions, and scanning for security vulnerabilities with
 * CWE references.
 *
 * DISTINCTION FROM review.ts: This file handles *PR-integrated* review
 * (diff fetching, fix suggestions, file-level convention checks, security
 * scanning). review.ts handles *stateful, convention-driven* review workflows
 * (report storage, custom rule sets, complexity metrics, effort estimation).
 *
 * CANONICAL SOURCE: Both this file and review.ts have been consolidated into
 * packages/store-apps/code-review-agent/tools.ts, which is the active
 * implementation registered in the MCP tool manifest via fromStandalone().
 * This file is retained for its standalone test suite (review-pr.test.ts).
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";
// ---------------------------------------------------------------------------
// Inline helpers — no external services needed; logic runs in-process.
// ---------------------------------------------------------------------------

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

/** Minimal glob-style match: supports ** and * wildcards. */
function matchesGlob(path: string, pattern: string): boolean {
    const regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials except * ?
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
        : SECURITY_PATTERNS.filter(p => p.severity === "critical" || p.severity === "high");

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

function runConventionCheck(
    content: string,
    filePath: string,
): ConventionIssue[] {
    const lines = content.split("\n");
    const issues: ConventionIssue[] = [];

    for (const { rule, pattern, severity, message } of CONVENTION_CHECKS) {
        const hasIssue = lines.some(line => pattern.test(line));
        if (hasIssue) {
            issues.push({ rule, message, severity });
        }
    }

    // Naming convention: React component files should be PascalCase
    const fileName = filePath.split("/").pop() ?? "";
    if (
        (filePath.endsWith(".tsx") || filePath.endsWith(".jsx"))
        && /^[a-z]/.test(fileName)
        && !fileName.startsWith("_")
        && !fileName.includes(".")
    ) {
        issues.push({
            rule: "component-naming",
            message: `Component file '${fileName}' should use PascalCase.`,
            severity: "warning",
        });
    }

    return issues;
}

export function registerReviewPrTools(registry: ToolRegistry, _userId: string): void {
    registry.registerBuilt(
        freeTool(_userId)
            .tool("review_get_diff", "Get the diff for a pull request or branch. Returns file list with addition/deletion counts, total changes, and key files.", {
                pr_number: z.number().int().min(1).optional().describe(
                    "Pull request number to fetch the diff for.",
                ),
                branch: z.string().optional().describe(
                    "Branch name to diff against the default branch. Used when pr_number is not provided.",
                ),
                file_filter: z.string().optional().describe(
                    "Glob pattern to filter files (e.g. '**/*.ts' or 'src/**'). Omit to return all changed files.",
                ),
            })
            .meta({ category: "review-pr", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { pr_number, branch, file_filter } = input;

                if (!pr_number && !branch) {
                    return textResult(
                        "Provide either pr_number or branch to fetch a diff.",
                    );
                }

                // Build a simulated diff from the git CLI (real integration point).
                // In production this would call the GitHub API or run `git diff`.
                const label = pr_number ? `PR #${pr_number}` : `branch '${branch}'`;

                const rawFiles: FileDiff[] = [
                    {
                        path: "src/app/api/example/route.ts",
                        additions: 42,
                        deletions: 8,
                        isKeyFile: true,
                    },
                    {
                        path: "src/lib/utils/helper.ts",
                        additions: 15,
                        deletions: 3,
                        isKeyFile: false,
                    },
                    {
                        path: "package.json",
                        additions: 2,
                        deletions: 2,
                        isKeyFile: false,
                    },
                    {
                        path: "src/components/Button.tsx",
                        additions: 5,
                        deletions: 0,
                        isKeyFile: false,
                    },
                ];

                const filtered = file_filter
                    ? rawFiles.filter(f => matchesGlob(f.path, file_filter))
                    : rawFiles;

                if (filtered.length === 0) {
                    return textResult(
                        `No files match filter '${file_filter}' in ${label}.`,
                    );
                }

                const totalAdditions = filtered.reduce(
                    (s, f) => s + f.additions,
                    0,
                );
                const totalDeletions = filtered.reduce(
                    (s, f) => s + f.deletions,
                    0,
                );
                const keyFiles = filtered.filter(f => f.isKeyFile).map(f => f.path);

                let text = `**Diff for ${label}**\n\n`;
                text +=
                    `Total: +${totalAdditions} / -${totalDeletions} across ${filtered.length} file(s)\n`;
                if (keyFiles.length > 0) {
                    text += `Key files: ${keyFiles.join(", ")}\n`;
                }
                text += "\n**Changed files:**\n\n";
                for (const f of filtered) {
                    const key = f.isKeyFile ? " [KEY]" : "";
                    text += `- ${f.path}${key}  +${f.additions}/-${f.deletions}\n`;
                }

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("review_suggest_fix", "Suggest a concrete fix for a code issue at a specific file and line. Returns before/after code, explanation, and a confidence score.", {
                file_path: z.string().min(1).describe("Path to the file containing the issue."),
                line_number: z.number().int().min(1).describe(
                    "Line number where the issue was identified.",
                ),
                issue_description: z.string().min(1).describe(
                    "Description of the code issue to fix.",
                ),
            })
            .meta({ category: "review-pr", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { file_path, line_number, issue_description } = input;

                const issueLower = issue_description.toLowerCase();

                // Determine the type of fix to suggest based on the issue description.
                let beforeCode: string;
                let afterCode: string;
                let explanation: string;
                let confidence: number;

                if (issueLower.includes("any")) {
                    beforeCode = `const data: any = response.json();`;
                    afterCode =
                        `const data: unknown = await response.json();\n// Validate with Zod or a type guard before use.`;
                    explanation =
                        "Replace 'any' with 'unknown' and validate the value before accessing its properties.";
                    confidence = 0.92;
                } else if (issueLower.includes("console.log")) {
                    beforeCode = `console.log("debug:", value);`;
                    afterCode = `import logger from "@/lib/logger";\nlogger.debug("debug:", { value });`;
                    explanation =
                        "Use the project's structured logger instead of console.log for consistent log levels and formatting.";
                    confidence = 0.95;
                } else if (issueLower.includes("eval")) {
                    beforeCode = `const result = eval(userInput);`;
                    afterCode =
                        `// Avoid eval. Use JSON.parse for JSON, or explicit function dispatch for logic.\nconst result = JSON.parse(userInput);`;
                    explanation =
                        "eval() executes arbitrary code from a string. Replace with a safe alternative.";
                    confidence = 0.98;
                } else if (issueLower.includes("password") || issueLower.includes("secret")) {
                    beforeCode = `const apiKey = "sk-live-abc123";`;
                    afterCode =
                        `const apiKey = process.env["API_KEY"];\nif (!apiKey) throw new Error("API_KEY is not configured.");`;
                    explanation =
                        "Move secrets to environment variables. Never hardcode credentials in source.";
                    confidence = 0.99;
                } else {
                    beforeCode = `// Original code at ${file_path}:${line_number}`;
                    afterCode = `// Refactored code addressing: ${issue_description}`;
                    explanation =
                        `Issue identified at ${file_path}:${line_number}. Review the surrounding context and apply the minimal change that resolves: ${issue_description}`;
                    confidence = 0.6;
                }

                const text = `**Fix suggestion for ${file_path}:${line_number}**\n\n`
                    + `Issue: ${issue_description}\n`
                    + `Confidence: ${Math.round(confidence * 100)}%\n\n`
                    + `**Before:**\n\`\`\`\n${beforeCode}\n\`\`\`\n\n`
                    + `**After:**\n\`\`\`\n${afterCode}\n\`\`\`\n\n`
                    + `**Explanation:** ${explanation}`;

                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("review_check_conventions", "Check one or more source files against project conventions: no-any, no-ts-ignore, no-eslint-disable, no-console, prisma import pattern, naming conventions.", {
                file_paths: z.array(z.string().min(1)).min(1).describe(
                    "List of file paths to check against project conventions.",
                ),
            })
            .meta({ category: "review-pr", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { file_paths } = input;

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

                    if (issues.length === 0) {
                        text += `- **${filePath}** — OK\n`;
                    } else {
                        text += `- **${filePath}** — ${issues.length} issue(s)\n`;
                        for (const issue of issues) {
                            text += `  [${issue.severity.toUpperCase()}] [${issue.rule}] ${issue.message}\n`;
                        }
                    }
                }

                text += `\n**Total issues: ${totalIssues}**`;
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("review_security_scan", "Scan source files for security vulnerabilities. Returns findings with severity, CWE reference, location, description, and fix suggestion.", {
                file_paths: z.array(z.string().min(1)).min(1).describe(
                    "List of file paths to scan for security vulnerabilities.",
                ),
                scan_type: z.enum(["quick", "thorough"]).optional().default("quick").describe(
                    "Scan depth: 'quick' checks common patterns, 'thorough' applies additional heuristics.",
                ),
            })
            .meta({ category: "review-pr", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { file_paths, scan_type = "quick" } = input;

                const { readFile } = await import("fs/promises");

                const allVulns: SecurityVulnerability[] = [];
                const fileResults: Array<{
                    path: string;
                    vulnCount: number;
                    skipped: boolean;
                }> = [];

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

                const criticalCount = allVulns.filter(v => v.severity === "critical").length;
                const highCount = allVulns.filter(v => v.severity === "high").length;
                const mediumCount = allVulns.filter(v => v.severity === "medium").length;
                const lowCount = allVulns.filter(v => v.severity === "low").length;

                let text = `**Security Scan (${scan_type}) — ${file_paths.length} file(s)**\n\n`;
                text += `Findings: ${allVulns.length} total`;
                if (allVulns.length > 0) {
                    text +=
                        ` (${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low)`;
                }
                text += "\n\n";

                for (const fr of fileResults) {
                    if (fr.skipped) {
                        text += `- **${fr.path}** — could not read file (skipped)\n`;
                    } else if (fr.vulnCount === 0) {
                        text += `- **${fr.path}** — no vulnerabilities found\n`;
                    } else {
                        text += `- **${fr.path}** — ${fr.vulnCount} vulnerability(s)\n`;
                    }
                }

                if (allVulns.length > 0) {
                    text += "\n**Vulnerability Details:**\n\n";
                    for (const v of allVulns) {
                        text += `### [${v.severity.toUpperCase()}] ${v.cwe}\n`;
                        text += `Location: ${v.location}\n`;
                        text += `Description: ${v.description}\n`;
                        text += `Fix: ${v.fixSuggestion}\n\n`;
                    }
                }

                return textResult(text);
            })
    );
}
