/**
 * Lie Detector Tools (Server-Side)
 *
 * Quality verification layer — syntax checking, test output parsing,
 * and spec-matching tools for validating code and outputs.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

interface SyntaxIssue {
    line: number;
    message: string;
    severity: "error" | "warning";
}

interface TestFailure {
    name: string;
    error: string;
    expected?: string;
    received?: string;
}

interface TestReport {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: string;
    passRate: string;
    failures: TestFailure[];
}

interface SpecResult {
    matchScore: number;
    metRequirements: string[];
    unmetRequirements: string[];
    suggestions: string[];
}

export function registerLieDetectorTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    // verify_syntax
    registry.registerBuilt(
        freeTool(_userId)
            .tool("verify_syntax", "Check code for syntax errors using heuristic pattern analysis. Detects unbalanced brackets, unterminated strings, and common issues.", {
                code: z.string().min(1).describe("Source code to verify"),
                language: z
                    .enum(["typescript", "javascript"])
                    .optional()
                    .default("typescript")
                    .describe("Programming language"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    code,
                    language,
                } = input;

                const errors = checkSyntax(code, language);
                if (errors.length === 0) {
                    return textResult("**Syntax check passed.** No issues found.");
                }
                const errorCount = errors.filter(e => e.severity === "error").length;
                const warningCount = errors.filter(e => e.severity === "warning").length;
                let text =
                    `**Syntax check found ${errors.length} issue(s)** (${errorCount} error(s), ${warningCount} warning(s)):\n\n`;
                for (const e of errors) {
                    text += `- Line ${e.line}: ${e.message} (${e.severity})\n`;
                }
                return textResult(text);
            })
    );

    // verify_tests
    registry.registerBuilt(
        freeTool(_userId)
            .tool("verify_tests", "Parse test runner output and extract structured results including pass/fail counts, duration, and failure details.", {
                test_output: z
                    .string()
                    .min(1)
                    .describe("Raw output from vitest or jest"),
                format: z
                    .enum(["vitest", "jest"])
                    .optional()
                    .default("vitest")
                    .describe("Test runner format"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    test_output,
                    format,
                } = input;

                const report = parseTestOutput(test_output, format);

                let text = `**Test Report:**\n\n`;
                text += `| Metric | Value |\n`;
                text += `|--------|-------|\n`;
                text += `| Total | ${report.total} |\n`;
                text += `| Passed | ${report.passed} |\n`;
                text += `| Failed | ${report.failed} |\n`;
                text += `| Skipped | ${report.skipped} |\n`;
                text += `| Pass Rate | ${report.passRate} |\n`;
                text += `| Duration | ${report.duration} |\n`;

                if (report.failures.length > 0) {
                    text += `\n**Failures (${report.failures.length}):**\n\n`;
                    for (const f of report.failures) {
                        text += `### ${f.name}\n`;
                        text += `- **Error:** ${f.error}\n`;
                        if (f.expected) text += `- **Expected:** ${f.expected}\n`;
                        if (f.received) text += `- **Received:** ${f.received}\n`;
                        text += `\n`;
                    }
                }

                if (report.failed === 0) {
                    text += `\n**All tests passed!**`;
                }

                return textResult(text);
            })
    );

    // verify_spec_match
    registry.registerBuilt(
        freeTool(_userId)
            .tool("verify_spec_match", "Compare code or output against a structured specification. Checks each requirement for keyword/pattern matches and returns a match score.", {
                spec: z
                    .object({
                        requirements: z
                            .array(z.string())
                            .min(1)
                            .describe("List of requirements to check"),
                    })
                    .describe("Specification with requirements"),
                output: z
                    .string()
                    .min(1)
                    .describe("The code or result to verify against the spec"),
                strict: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("If true, require stronger matches"),
            })
            .meta({ category: "orchestration", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    spec,
                    output,
                    strict,
                } = input;

                const result = matchSpec(spec.requirements, output, strict);

                let text = `**Spec Match Report:**\n\n`;
                text += `- **Match Score:** ${(result.matchScore * 100).toFixed(0)}%\n`;
                text += `- **Mode:** ${strict ? "Strict" : "Relaxed"}\n\n`;

                if (result.metRequirements.length > 0) {
                    text += `**Met Requirements (${result.metRequirements.length}):**\n`;
                    for (const r of result.metRequirements) {
                        text += `- [x] ${r}\n`;
                    }
                    text += `\n`;
                }

                if (result.unmetRequirements.length > 0) {
                    text += `**Unmet Requirements (${result.unmetRequirements.length}):**\n`;
                    for (const r of result.unmetRequirements) {
                        text += `- [ ] ${r}\n`;
                    }
                    text += `\n`;
                }

                if (result.suggestions.length > 0) {
                    text += `**Suggestions:**\n`;
                    for (const s of result.suggestions) {
                        text += `- ${s}\n`;
                    }
                }

                return textResult(text);
            })
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Heuristic syntax checker. Not a real parser — checks for common issues
 * like unbalanced brackets, unterminated strings, and template literals.
 */
function checkSyntax(code: string, _language: string): SyntaxIssue[] {
    const issues: SyntaxIssue[] = [];
    const lines = code.split("\n");

    // Track bracket balance
    const brackets: Array<{ char: string; line: number; }> = [];
    const matchingClose: Record<string, string> = {
        "{": "}",
        "[": "]",
        "(": ")",
    };
    const matchingOpen: Record<string, string> = { "}": "{", "]": "[", ")": "(" };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const lineNum = i + 1;

        // Skip single-line comments
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) continue;

        // Check for unterminated strings (simple heuristic)
        let inString: string | null = null;
        let escaped = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j]!;

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === "\\") {
                escaped = true;
                continue;
            }

            // Skip rest of line if we hit a comment outside a string
            if (
                !inString && ch === "/" && j + 1 < line.length && line[j + 1] === "/"
            ) {
                break;
            }

            if (!inString) {
                if (ch === "\"" || ch === "'" || ch === "`") {
                    inString = ch;
                } else if (ch in matchingClose) {
                    brackets.push({ char: ch, line: lineNum });
                } else if (ch in matchingOpen) {
                    const expected = matchingOpen[ch]!;
                    if (
                        brackets.length === 0
                        || brackets[brackets.length - 1]!.char !== expected
                    ) {
                        issues.push({
                            line: lineNum,
                            message: `Unexpected closing '${ch}' — no matching '${expected}'`,
                            severity: "error",
                        });
                    } else {
                        brackets.pop();
                    }
                }
            } else {
                // Template literals can span multiple lines
                if (ch === inString && inString !== "`") {
                    inString = null;
                } else if (ch === inString && inString === "`") {
                    inString = null;
                }
            }
        }

        // Unterminated single/double quote on this line (template literals can span lines)
        if (inString && inString !== "`") {
            issues.push({
                line: lineNum,
                message: `Unterminated string literal (${inString === "\"" ? "double" : "single"} quote)`,
                severity: "error",
            });
            inString = null;
        }
    }

    // Report unmatched opening brackets
    for (const b of brackets) {
        issues.push({
            line: b.line,
            message: `Unclosed '${b.char}' — missing '${matchingClose[b.char]}'`,
            severity: "error",
        });
    }

    return issues;
}

/**
 * Parse test runner output into a structured report.
 */
function parseTestOutput(output: string, format: string): TestReport {
    const failures: TestFailure[] = [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let duration = "unknown";

    if (format === "vitest") {
        // Parse vitest summary line: "Tests  2 passed | 1 failed (3)"
        const testsLine = output.match(
            /Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*)?(?:(\d+)\s+failed)?(?:\s*\|\s*)?(?:(\d+)\s+skipped)?\s*\((\d+)\)/,
        );
        if (testsLine) {
            passed = parseInt(testsLine[1] || "0", 10);
            failed = parseInt(testsLine[2] || "0", 10);
            skipped = parseInt(testsLine[3] || "0", 10);
            total = parseInt(testsLine[4] || "0", 10);
        }

        // Parse duration
        const durationMatch = output.match(/Duration\s+([\d.]+\s*\w+)/);
        if (durationMatch) {
            duration = durationMatch[1]!;
        }

        // Parse individual failures: lines starting with x or ×
        const failureLines = output.split("\n").filter(
            line => line.trim().startsWith("\u00D7") || line.trim().startsWith("x "),
        );
        for (const line of failureLines) {
            const name = line.trim().replace(/^[x\u00D7]\s*/, "");
            failures.push({ name, error: "Test failed" });
        }

        // Parse FAIL blocks with expected/received
        const failBlocks = output.matchAll(
            /FAIL\s+(.+?)(?:\n|$)[\s\S]*?Expected:?\s*(.+?)(?:\n|$)[\s\S]*?Received:?\s*(.+?)(?:\n|$)/g,
        );
        for (const match of failBlocks) {
            const expectedVal = match[2]?.trim();
            const receivedVal = match[3]?.trim();
            failures.push({
                name: match[1]?.trim() || "Unknown test",
                error: "Assertion failed",
                ...(expectedVal !== undefined ? { expected: expectedVal } : {}),
                ...(receivedVal !== undefined ? { received: receivedVal } : {}),
            });
        }
    } else {
        // Jest format
        // "Tests:       2 passed, 1 failed, 3 total"
        const testsLine = output.match(
            /Tests:\s+(?:(\d+)\s+passed)?(?:,\s*)?(?:(\d+)\s+failed)?(?:,\s*)?(?:(\d+)\s+skipped)?(?:,\s*)?(\d+)\s+total/,
        );
        if (testsLine) {
            passed = parseInt(testsLine[1] || "0", 10);
            failed = parseInt(testsLine[2] || "0", 10);
            skipped = parseInt(testsLine[3] || "0", 10);
            total = parseInt(testsLine[4] || "0", 10);
        }

        // "Time:        1.23 s"
        const durationMatch = output.match(/Time:\s+([\d.]+\s*\w+)/);
        if (durationMatch) {
            duration = durationMatch[1]!;
        }

        // Parse "FAIL" sections
        const failMatches = output.matchAll(/\u25CF\s+(.+?)(?:\n|$)/g);
        for (const match of failMatches) {
            failures.push({
                name: match[1]?.trim() || "Unknown test",
                error: "Test failed",
            });
        }
    }

    const passRate = total > 0
        ? `${((passed / total) * 100).toFixed(0)}%`
        : "N/A";

    return { total, passed, failed, skipped, duration, passRate, failures };
}

/**
 * Compare output against spec requirements using keyword extraction.
 */
function matchSpec(
    requirements: string[],
    output: string,
    strict: boolean,
): SpecResult {
    const metRequirements: string[] = [];
    const unmetRequirements: string[] = [];
    const suggestions: string[] = [];
    const outputLower = output.toLowerCase();

    for (const req of requirements) {
        const keywords = extractKeywords(req);
        const threshold = strict ? 0.7 : 0.4;

        if (keywords.length === 0) {
            // No keywords extracted — can't verify
            unmetRequirements.push(req);
            suggestions.push(
                `Could not extract keywords from: "${req}". Rewrite as a more specific requirement.`,
            );
            continue;
        }

        const matchedCount = keywords.filter(kw => outputLower.includes(kw.toLowerCase())).length;
        const matchRatio = matchedCount / keywords.length;

        if (matchRatio >= threshold) {
            metRequirements.push(req);
        } else {
            unmetRequirements.push(req);
            const missing = keywords.filter(kw => !outputLower.includes(kw.toLowerCase()));
            suggestions.push(
                `Requirement "${req.slice(0, 60)}${req.length > 60 ? "..." : ""}" — missing keywords: ${missing.join(", ")
                }`,
            );
        }
    }

    const matchScore = requirements.length > 0
        ? metRequirements.length / requirements.length
        : 0;

    return { matchScore, metRequirements, unmetRequirements, suggestions };
}

/**
 * Extract meaningful keywords from a requirement string.
 * Filters out common stop words and short words.
 */
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "shall",
        "can",
        "need",
        "must",
        "ought",
        "to",
        "of",
        "in",
        "for",
        "on",
        "with",
        "at",
        "by",
        "from",
        "as",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "between",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "all",
        "each",
        "every",
        "both",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "just",
        "because",
        "but",
        "and",
        "or",
        "if",
        "while",
        "that",
        "this",
        "it",
        "its",
        "which",
        "what",
        "who",
        "whom",
        "whose",
        "about",
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, " ")
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}
