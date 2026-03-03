/**
 * CI/CD Pipeline MCP Tools
 *
 * Agent-invocable tools for self-verification: run tests, build,
 * type-check, lint, deploy preview, and execute named pipeline sequences.
 *
 * These tools do NOT replace GitHub Actions — they let agents
 * verify their work locally before pushing.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { execSync } from "node:child_process";

const CATEGORY = "pipeline";
const TIER = "workspace" as const;

/** Validate a path-like string to prevent command injection. */
function isValidScope(scope: string): boolean {
  return /^[a-zA-Z0-9._/\-]+$/.test(scope) && scope.length <= 200
    && !scope.includes("..");
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

function runCommand(cmd: string, timeoutMs = 120_000): CommandResult {
  const start = Date.now();
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return {
      stdout: stdout.trim(),
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number; };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? "").trim(),
      exitCode: e.status ?? 1,
      durationMs: Date.now() - start,
    };
  }
}

/** Truncate output to fit within response limits. */
function truncate(text: string, maxLen = 6000): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n...(truncated)";
}

// ── Schema definitions ─────────────────────────────────────────

const RunTestsSchema = z.object({
  scope: z.string().optional().describe(
    "Directory scope (e.g., 'src/lib/mcp')",
  ),
  pattern: z.string().optional().describe(
    "Test file name pattern (e.g., 'pipeline')",
  ),
  coverage: z.boolean().optional().describe(
    "Enable coverage reporting (default: false)",
  ),
});

const BuildSchema = z.object({});

const CheckTypesSchema = z.object({});

const LintSchema = z.object({
  fix: z.boolean().optional().describe("Auto-fix issues (default: false)"),
  scope: z.string().optional().describe("Path scope (e.g., 'src/lib/mcp')"),
});

const PIPELINE_NAMES = ["quick", "ci", "full"] as const;

const RunPipelineSchema = z.object({
  name: z.enum(PIPELINE_NAMES).describe(
    "Pipeline: 'quick' (lint + types), 'ci' (lint + types + tests), 'full' (lint + types + tests + build)",
  ),
  fail_fast: z.boolean().optional().describe(
    "Stop on first failure (default: true)",
  ),
});

// ── Step runner for pipeline_run ────────────────────────────────

interface StepResult {
  name: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  summary: string;
}

function runStep(name: string, cmd: string, timeoutMs?: number): StepResult {
  const result = runCommand(cmd, timeoutMs);
  const output = result.stdout || result.stderr;
  const lastLines = output.split("\n").slice(-5).join("\n");
  return {
    name,
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    summary: lastLines,
  };
}

const PIPELINE_SEQUENCES: Record<
  string,
  Array<{ name: string; cmd: string; timeoutMs: number; }>
> = {
  quick: [
    { name: "lint", cmd: "yarn lint 2>&1", timeoutMs: 60_000 },
    { name: "typecheck", cmd: "yarn typecheck 2>&1", timeoutMs: 120_000 },
  ],
  ci: [
    { name: "lint", cmd: "yarn lint 2>&1", timeoutMs: 60_000 },
    { name: "typecheck", cmd: "yarn typecheck 2>&1", timeoutMs: 120_000 },
    { name: "tests", cmd: "yarn vitest run 2>&1", timeoutMs: 300_000 },
  ],
  full: [
    { name: "lint", cmd: "yarn lint 2>&1", timeoutMs: 60_000 },
    { name: "typecheck", cmd: "yarn typecheck 2>&1", timeoutMs: 120_000 },
    { name: "tests", cmd: "yarn vitest run 2>&1", timeoutMs: 300_000 },
    { name: "build", cmd: "yarn build 2>&1", timeoutMs: 600_000 },
  ],
};

// ── Tool registration ──────────────────────────────────────────

export function registerPipelineTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── pipeline_run_tests ─────────────────────────────────────
  registry.register({
    name: "pipeline_run_tests",
    description:
      "Execute the test suite and return structured results. Optionally scope to a directory or file pattern.",
    category: CATEGORY,
    tier: TIER,
    inputSchema: RunTestsSchema.shape,
    handler: async (
      args: z.infer<typeof RunTestsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipeline_run_tests", async () => {
        const parts = ["yarn vitest run"];

        if (args.coverage) parts.push("--coverage");
        if (args.pattern) {
          if (!isValidScope(args.pattern)) {
            return textResult(
              "**Error: VALIDATION_ERROR**\nInvalid pattern format.\n**Retryable:** false",
            );
          }
          parts.push(args.pattern);
        }
        if (args.scope) {
          if (!isValidScope(args.scope)) {
            return textResult(
              "**Error: VALIDATION_ERROR**\nInvalid scope format.\n**Retryable:** false",
            );
          }
          parts.push(args.scope);
        }

        parts.push("2>&1");

        const result = runCommand(parts.join(" "), 300_000);
        const passed = result.exitCode === 0;
        const icon = passed ? "PASS" : "FAIL";

        return textResult(
          `## Pipeline: Run Tests — ${icon}\n\n`
            + `- **Exit code:** ${result.exitCode}\n`
            + `- **Duration:** ${result.durationMs}ms\n`
            + (args.scope ? `- **Scope:** ${args.scope}\n` : "")
            + (args.pattern ? `- **Pattern:** ${args.pattern}\n` : "")
            + (args.coverage ? `- **Coverage:** enabled\n` : "")
            + `\n**Output:**\n\`\`\`\n${truncate(result.stdout || result.stderr)}\n\`\`\``,
        );
      }),
  });

  // ── pipeline_build ─────────────────────────────────────────
  registry.register({
    name: "pipeline_build",
    description:
      "Trigger the Next.js production build and return the result. Long-running — timeout is 10 minutes.",
    category: CATEGORY,
    tier: TIER,
    inputSchema: BuildSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("pipeline_build", async () => {
        const result = runCommand("yarn build 2>&1", 600_000);
        const passed = result.exitCode === 0;
        const icon = passed ? "PASS" : "FAIL";

        return textResult(
          `## Pipeline: Build — ${icon}\n\n`
            + `- **Exit code:** ${result.exitCode}\n`
            + `- **Duration:** ${result.durationMs}ms\n`
            + `\n**Output:**\n\`\`\`\n${truncate(result.stdout || result.stderr)}\n\`\`\``,
        );
      }),
  });

  // ── pipeline_check_types ───────────────────────────────────
  registry.register({
    name: "pipeline_check_types",
    description:
      "Run TypeScript type checking (tsc --noEmit). Returns structured error list with file:line locations.",
    category: CATEGORY,
    tier: TIER,
    inputSchema: CheckTypesSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("pipeline_check_types", async () => {
        const result = runCommand("yarn typecheck 2>&1", 120_000);
        const passed = result.exitCode === 0;
        const icon = passed ? "PASS" : "FAIL";

        // Count TypeScript errors from output (pattern: "file.ts(line,col): error TS...")
        const errorLines = (result.stdout || result.stderr)
          .split("\n")
          .filter(line => line.includes("error TS"));
        const errorCount = errorLines.length;

        return textResult(
          `## Pipeline: Type Check — ${icon}\n\n`
            + `- **Exit code:** ${result.exitCode}\n`
            + `- **Duration:** ${result.durationMs}ms\n`
            + `- **Errors:** ${errorCount}\n`
            + (errorCount > 0
              ? `\n**Errors:**\n\`\`\`\n${truncate(errorLines.join("\n"))}\n\`\`\``
              : "\nNo type errors found.")
            + `\n\n**Full output:**\n\`\`\`\n${truncate(result.stdout || result.stderr)}\n\`\`\``,
        );
      }),
  });

  // ── pipeline_lint ──────────────────────────────────────────
  registry.register({
    name: "pipeline_lint",
    description:
      "Run ESLint and return violations with file:line locations. Optionally auto-fix or scope to a path.",
    category: CATEGORY,
    tier: TIER,
    inputSchema: LintSchema.shape,
    handler: async (
      args: z.infer<typeof LintSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipeline_lint", async () => {
        const parts = ["yarn lint"];

        if (args.fix) parts.push("--fix");
        if (args.scope) {
          if (!isValidScope(args.scope)) {
            return textResult(
              "**Error: VALIDATION_ERROR**\nInvalid scope format.\n**Retryable:** false",
            );
          }
          parts.push(args.scope);
        }

        parts.push("2>&1");

        const result = runCommand(parts.join(" "), 60_000);
        const passed = result.exitCode === 0;
        const icon = passed ? "PASS" : "FAIL";

        // Count warnings and errors from ESLint output
        const output = result.stdout || result.stderr;
        const warningMatch = output.match(/(\d+)\s+warning/);
        const errorMatch = output.match(/(\d+)\s+error/);
        const warnings = parseInt(warningMatch?.[1] ?? "0", 10);
        const errors = parseInt(errorMatch?.[1] ?? "0", 10);

        return textResult(
          `## Pipeline: Lint — ${icon}\n\n`
            + `- **Exit code:** ${result.exitCode}\n`
            + `- **Duration:** ${result.durationMs}ms\n`
            + `- **Errors:** ${errors}\n`
            + `- **Warnings:** ${warnings}\n`
            + (args.fix ? `- **Auto-fix:** enabled\n` : "")
            + (args.scope ? `- **Scope:** ${args.scope}\n` : "")
            + `\n**Output:**\n\`\`\`\n${truncate(output)}\n\`\`\``,
        );
      }),
  });

  // ── pipeline_run ───────────────────────────────────────────
  registry.register({
    name: "pipeline_run",
    description:
      "Execute a named pipeline sequence. 'quick' = lint + types, 'ci' = lint + types + tests, 'full' = lint + types + tests + build.",
    category: CATEGORY,
    tier: TIER,
    inputSchema: RunPipelineSchema.shape,
    handler: async (
      args: z.infer<typeof RunPipelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipeline_run", async () => {
        const sequence = PIPELINE_SEQUENCES[args.name];
        if (!sequence) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nUnknown pipeline: '${args.name}'. Use: ${
              PIPELINE_NAMES.join(", ")
            }.\n**Retryable:** false`,
          );
        }

        const failFast = args.fail_fast !== false;
        const results: StepResult[] = [];
        let allPassed = true;

        for (const step of sequence) {
          const stepResult = runStep(step.name, step.cmd, step.timeoutMs);
          results.push(stepResult);

          if (!stepResult.passed) {
            allPassed = false;
            if (failFast) break;
          }
        }

        const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
        const icon = allPassed ? "PASS" : "FAIL";

        let text = `## Pipeline: ${args.name} — ${icon}\n\n`
          + `- **Steps:** ${results.length}/${sequence.length}\n`
          + `- **Total duration:** ${totalDuration}ms\n`
          + `- **Fail fast:** ${failFast}\n\n`
          + `### Steps\n\n`;

        for (const r of results) {
          const stepIcon = r.passed ? "PASS" : "FAIL";
          text += `**${r.name}** — ${stepIcon} (${r.durationMs}ms, exit ${r.exitCode})\n`;
          if (!r.passed && r.summary) {
            text += `\`\`\`\n${r.summary}\n\`\`\`\n`;
          }
          text += "\n";
        }

        return textResult(text);
      }),
  });
}
