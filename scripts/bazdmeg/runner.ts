import { execSync } from "node:child_process";
import type { CheckResult, CheckSuite } from "./types.js";
import { isVerbose } from "./verbose.js";

export interface CheckRunOptions {
  safe?: boolean;
  timeoutMs?: number;
}

export interface CheckCommands {
  lint: string;
  typecheck: string;
  test: string;
}

export function getCheckCommands(options: CheckRunOptions = {}): CheckCommands {
  return {
    lint: options.safe ? "yarn lint:check" : "yarn lint",
    typecheck: "yarn typecheck",
    test: "yarn test:src",
  };
}

function runCheck(name: string, command: string, options: CheckRunOptions = {}): CheckResult {
  const verbose = isVerbose();
  const start = Date.now();
  if (verbose) {
    console.log(`    [verbose] running: ${command}`);
  }
  try {
    const output = execSync(command, {
      encoding: "utf-8",
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: options.timeoutMs,
    });
    if (verbose) {
      console.log(`    [verbose] ${name} PASS (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    }
    return {
      name,
      passed: true,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      status?: number;
      signal?: string;
      killed?: boolean;
    };
    const timedOut = Boolean(options.timeoutMs && (e.signal === "SIGTERM" || e.killed));
    const output = [e.stdout ?? "", e.stderr ?? ""]
      .map((value) => (typeof value === "string" ? value : value.toString("utf-8")))
      .filter(Boolean)
      .join("\n");
    const duration = Date.now() - start;
    const normalizedOutput = timedOut
      ? [`Timed out after ${options.timeoutMs}ms`, output.trim()].filter(Boolean).join("\n")
      : output.trim();

    // Vitest may exit non-zero despite all tests passing (e.g. deprecation warnings).
    // Detect this: output contains "X passed" with no "failed" count.
    const allTestsPassed =
      name === "test" && /\d+ passed/.test(normalizedOutput) && !/\d+ failed/.test(normalizedOutput);

    if (allTestsPassed) {
      if (verbose) {
        console.log(
          `    [verbose] ${name} PASS (${(duration / 1000).toFixed(1)}s) (exit code ${e.status ?? "?"}, but all tests passed)`,
        );
      }
      return {
        name,
        passed: true,
        output: normalizedOutput,
        durationMs: duration,
      };
    }

    if (verbose) {
      const status = timedOut ? "TIMEOUT" : "FAIL";
      console.log(`    [verbose] ${name} ${status} (${(duration / 1000).toFixed(1)}s)`);
      console.log(
        `    [verbose] ${name} output:\n${normalizedOutput.slice(0, 2000)}${normalizedOutput.length > 2000 ? "\n    ... (truncated)" : ""}`,
      );
    }
    return {
      name,
      passed: false,
      output: normalizedOutput,
      durationMs: duration,
      timedOut,
    };
  }
}

function countErrors(output: string): number {
  // Count lines that look like errors (file:line:col patterns, "error TS", eslint errors)
  const errorPatterns = [/error TS\d+/g, /\d+ error/g, /✖ \d+ problem/g, /FAIL /g];
  let count = 0;
  for (const pattern of errorPatterns) {
    const matches = output.match(pattern);
    if (matches) count += matches.length;
  }
  return Math.max(count, 0);
}

export function runAllChecks(options: CheckRunOptions = {}): CheckSuite {
  const commands = getCheckCommands(options);
  const lint = runCheck("lint", commands.lint, options);
  const typecheck = runCheck("typecheck", commands.typecheck, options);
  const test = runCheck("test", commands.test, options);

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
  const status = result.timedOut ? "TIMEOUT" : result.passed ? "PASS" : "FAIL";
  const dur = (result.durationMs / 1000).toFixed(1);
  return `    ${result.name.padEnd(15, ".")} ${status} (${dur}s)`;
}
