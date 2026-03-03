import type { ConventionRule, ReviewFinding } from "./types";

export function checkConventions(
  files: Array<{ path: string; content: string; }>,
  rules: ConventionRule[],
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const file of files) {
    for (const rule of rules) {
      const regex = new RegExp(rule.pattern, "g");
      let match;
      while ((match = regex.exec(file.content)) !== null) {
        // Calculate line number
        const line = file.content.substring(0, match.index).split("\n").length;
        findings.push({
          path: file.path,
          line,
          severity: rule.severity,
          message: rule.message,
          ruleId: rule.id,
        });
        // Guard against zero-width matches causing infinite loops
        if (match[0]!.length === 0) {
          regex.lastIndex++;
        }
      }
    }
  }

  return findings;
}

export function analyzeComplexity(
  content: string,
  path: string,
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const lines = content.split("\n");

  // Simple heuristic: nested depth
  let maxDepth = 0;
  let currentDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    currentDepth += (line.match(/\{/g) || []).length;
    currentDepth -= (line.match(/\}/g) || []).length;
    if (currentDepth > maxDepth) maxDepth = currentDepth;

    if (currentDepth > 5) {
      findings.push({
        path,
        line: i + 1,
        severity: "warning",
        message: `High nesting depth detected (${currentDepth})`,
        ruleId: "complexity-nesting",
      });
    }
  }

  // Length check
  if (lines.length > 300) {
    findings.push({
      path,
      severity: "info",
      message: `File has ${lines.length} lines, consider splitting into smaller modules`,
      ruleId: "complexity-length",
    });
  }

  return findings;
}

export function getBuiltInRules(projectType: string): ConventionRule[] {
  const rules: ConventionRule[] = [
    {
      id: "no-any",
      name: "No any type",
      description: "Avoid using the 'any' type in TypeScript",
      pattern: ":\\s*any",
      severity: "error",
      message: "Explicit 'any' type detected. Use proper types or 'unknown' instead.",
    },
    {
      id: "no-console-log",
      name: "No console.log",
      description: "Avoid leaving console.log statements in production code",
      pattern: "console\\.log\\(",
      severity: "warning",
      message: "console.log detected. Use a proper logger or remove it.",
    },
  ];

  if (projectType === "nextjs") {
    rules.push({
      id: "next-use-client",
      name: "Use client directive",
      description: "Ensure 'use client' is at the top for client components",
      pattern: "^(?!\\s*['\"]use client['\"])", // Simplified placeholder
      severity: "info",
      message: "Check if this component needs 'use client' directive",
    });
  }

  return rules;
}
