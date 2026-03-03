import { execSync } from "node:child_process";
import type { CheckResult, CheckSuite } from "./types.js";

function runCheck(name: string, command: string): CheckResult {
  const start = Date.now();
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      name,
      passed: true,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    const output = [e.stdout ?? "", e.stderr ?? ""].filter(Boolean).join("\n");
    return {
      name,
      passed: false,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  }
}

function countErrors(output: string): number {
  // Count lines that look like errors (file:line:col patterns, "error TS", eslint errors)
  const errorPatterns = [
    /error TS\d+/g,
    /\d+ error/g,
    /✖ \d+ problem/g,
    /FAIL /g,
  ];
  let count = 0;
  for (const pattern of errorPatterns) {
    const matches = output.match(pattern);
    if (matches) count += matches.length;
  }
  return Math.max(count, 0);
}

export function runAllChecks(): CheckSuite {
  const lint = runCheck("lint", "yarn lint");
  const typecheck = runCheck("typecheck", "yarn typecheck");
  const test = runCheck("test", "yarn test:src");

  const allPassed = lint.passed && typecheck.passed && test.passed;
  const errorCount =
    (lint.passed ? 0 : countErrors(lint.output)) +
    (typecheck.passed ? 0 : countErrors(typecheck.output)) +
    (test.passed ? 0 : countErrors(test.output));

  return { lint, typecheck, test, allPassed, errorCount };
}

export function getFailureOutput(suite: CheckSuite): string {
  const parts: string[] = [];
  if (!suite.lint.passed) {
    parts.push(`=== LINT ERRORS ===\n${suite.lint.output}`);
  }
  if (!suite.typecheck.passed) {
    parts.push(`=== TYPECHECK ERRORS ===\n${suite.typecheck.output}`);
  }
  if (!suite.test.passed) {
    parts.push(`=== TEST FAILURES ===\n${suite.test.output}`);
  }
  return parts.join("\n\n");
}

export function formatCheckLine(result: CheckResult): string {
  const status = result.passed ? "PASS" : "FAIL";
  const dur = (result.durationMs / 1000).toFixed(1);
  return `    ${result.name.padEnd(15, ".")} ${status} (${dur}s)`;
}
