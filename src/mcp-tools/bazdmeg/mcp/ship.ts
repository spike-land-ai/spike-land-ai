/**
 * Ship Tool
 *
 * MCP tool for auto-shipping: lint → typecheck → test → gates → commit → push.
 * Fail-fast on first failure.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import { AutoShipSchema } from "../core-logic/types.js";
import type { z } from "zod";
import { getWorkspace } from "../node-sys/workspace-state.js";
import { countChanges, getBuiltinRules, getChangedFiles, runGates } from "../core-logic/engine.js";
import { hasScript, runCommand } from "../node-sys/shell.js";

interface StepResult {
  step: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  detail: string;
}

function formatReport(steps: StepResult[], packageName: string): string {
  let text = `## Auto-Ship Report — ${packageName}\n\n`;
  text += `| Step | Status | Duration | Detail |\n`;
  text += `|------|--------|----------|--------|\n`;
  for (const s of steps) {
    const dur = s.durationMs > 0 ? `${(s.durationMs / 1000).toFixed(1)}s` : "—";
    text += `| ${s.step} | ${s.status} | ${dur} | ${s.detail} |\n`;
  }

  const failed = steps.find((s) => s.status === "fail");
  if (failed) {
    text += `\n**BLOCKED** at \`${failed.step}\`: ${failed.detail}`;
  } else {
    const shipped = steps.some((s) => s.step === "commit" && s.status === "pass");
    text += shipped
      ? `\n**SHIPPED** — all checks passed, committed and pushed.`
      : `\n**DRY RUN** — all checks passed, no commit made.`;
  }

  return text;
}

export function registerShipTools(server: McpServer): void {
  createZodTool(server, {
    name: "bazdmeg_auto_ship",
    description:
      "Auto-ship: lint → typecheck → test → quality gates → commit → push. Fail-fast on first failure.",
    schema: AutoShipSchema.shape,
    handler: async ({ commitMessage, packageName: explicitPkg, push = true, dryRun = false }: z.infer<typeof AutoShipSchema>) => {

      const workspace = getWorkspace();
      const pkgName = explicitPkg ?? workspace?.packageName;

      if (!pkgName) {
        return textResult(
          "**ERROR**: No active workspace and no `packageName` provided. " +
            "Enter a workspace first with `bazdmeg_enter_workspace` or pass `packageName`.",
        );
      }

      const repoRoot = process.cwd();
      const pkgDir = `${repoRoot}/packages/${pkgName}`;
      const steps: StepResult[] = [];

      // Helper: run an npm script step
      async function runScriptStep(stepName: string, scriptName: string): Promise<boolean> {
        const exists = await hasScript(pkgDir, scriptName);
        if (!exists) {
          steps.push({
            step: stepName,
            status: "skip",
            durationMs: 0,
            detail: `No \`${scriptName}\` script`,
          });
          return true;
        }

        const start = Date.now();
        const result = await runCommand("npm", ["run", scriptName], pkgDir);
        const durationMs = Date.now() - start;

        if (result.ok) {
          steps.push({
            step: stepName,
            status: "pass",
            durationMs,
            detail: "OK",
          });
          return true;
        }

        const output = (result.stderr || result.stdout).trim();
        const truncated = output.length > 200 ? output.slice(0, 200) + "…" : output;
        steps.push({
          step: stepName,
          status: "fail",
          durationMs,
          detail: truncated,
        });
        return false;
      }

      // 1. lint
      if (!(await runScriptStep("lint", "lint"))) {
        return textResult(formatReport(steps, pkgName));
      }

      // 2. typecheck
      if (!(await runScriptStep("typecheck", "typecheck"))) {
        return textResult(formatReport(steps, pkgName));
      }

      // 3. test
      if (!(await runScriptStep("test", "test"))) {
        return textResult(formatReport(steps, pkgName));
      }

      // 4. quality gates
      const gatesStart = Date.now();
      const diffResult = await runCommand(
        "git",
        ["diff", "HEAD", "--", `packages/${pkgName}/`],
        repoRoot,
      );
      const diff = diffResult.stdout;

      if (!diff.trim()) {
        steps.push({
          step: "gates",
          status: "skip",
          durationMs: Date.now() - gatesStart,
          detail: "No changes to check",
        });
        return textResult(
          `## Auto-Ship Report — ${pkgName}\n\n**No changes to ship.** The working tree is clean for \`packages/${pkgName}/\`.`,
        );
      }

      const files = getChangedFiles(diff);
      const { additions, deletions } = countChanges(diff);
      const rules = getBuiltinRules().filter((r) => r.name !== "PR Description Quality");
      const gateResults = runGates(rules, {
        diff,
        files,
        additions,
        deletions,
        prTitle: commitMessage ?? `chore(${pkgName}): auto-ship changes`,
        prBody: null,
        claudeMdRules: [],
        allowedPaths: workspace?.allowedPaths,
      });

      const hasRed = gateResults.some((r) => r.status === "RED");
      const gatesDuration = Date.now() - gatesStart;

      if (hasRed) {
        const redGates = gateResults
          .filter((r) => r.status === "RED")
          .map((r) => `${r.name}: ${r.detail}`);
        steps.push({
          step: "gates",
          status: "fail",
          durationMs: gatesDuration,
          detail: redGates.join("; "),
        });
        return textResult(formatReport(steps, pkgName));
      }

      steps.push({
        step: "gates",
        status: "pass",
        durationMs: gatesDuration,
        detail: `${gateResults.length} gates passed`,
      });

      // 5. commit
      if (dryRun) {
        steps.push({
          step: "commit",
          status: "skip",
          durationMs: 0,
          detail: "Dry run",
        });
        steps.push({
          step: "push",
          status: "skip",
          durationMs: 0,
          detail: "Dry run",
        });
        return textResult(formatReport(steps, pkgName));
      }

      const commitMsg = commitMessage ?? `chore(${pkgName}): auto-ship changes`;
      const commitStart = Date.now();

      const addResult = await runCommand("git", ["add", `packages/${pkgName}/`], repoRoot);
      if (!addResult.ok) {
        steps.push({
          step: "commit",
          status: "fail",
          durationMs: Date.now() - commitStart,
          detail: `git add failed: ${addResult.stderr.trim()}`,
        });
        return textResult(formatReport(steps, pkgName));
      }

      const commitResult = await runCommand("git", ["commit", "-m", commitMsg], repoRoot);
      const commitDuration = Date.now() - commitStart;

      if (!commitResult.ok) {
        steps.push({
          step: "commit",
          status: "fail",
          durationMs: commitDuration,
          detail: commitResult.stderr.trim() || commitResult.stdout.trim(),
        });
        return textResult(formatReport(steps, pkgName));
      }

      steps.push({
        step: "commit",
        status: "pass",
        durationMs: commitDuration,
        detail: commitMsg,
      });

      // 6. push
      if (!push) {
        steps.push({
          step: "push",
          status: "skip",
          durationMs: 0,
          detail: "Push disabled",
        });
        return textResult(formatReport(steps, pkgName));
      }

      const pushStart = Date.now();
      const pushResult = await runCommand("git", ["push"], repoRoot);
      const pushDuration = Date.now() - pushStart;

      if (!pushResult.ok) {
        steps.push({
          step: "push",
          status: "fail",
          durationMs: pushDuration,
          detail: pushResult.stderr.trim(),
        });
        return textResult(formatReport(steps, pkgName));
      }

      steps.push({
        step: "push",
        status: "pass",
        durationMs: pushDuration,
        detail: "OK",
      });
      return textResult(formatReport(steps, pkgName));
    },
  });
}
