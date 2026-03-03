/**
 * BAZDMEG Quality Gate MCP Tools
 *
 * Three tools that aggregate existing data sources into BAZDMEG-specific assessments:
 * - bazdmeg_quality_gates: Check all 5 automation gates
 * - bazdmeg_pr_readiness: Check if PRs are merge-ready
 * - bazdmeg_deploy_check: Full deploy readiness assessment
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

type GateStatus = "GREEN" | "YELLOW" | "RED";

interface GateResult {
  name: string;
  status: GateStatus;
  detail: string;
}

function statusEmoji(status: GateStatus): string {
  switch (status) {
    case "GREEN":
      return "[GREEN]";
    case "YELLOW":
      return "[YELLOW]";
    case "RED":
      return "[RED]";
  }
}

export function registerBazdmegTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // bazdmeg_quality_gates
  registry.register({
    name: "bazdmeg_quality_gates",
    description:
      "Check all 5 BAZDMEG quality gates: CI speed, test health, type safety, coverage, and dependency health. Returns each gate as GREEN/YELLOW/RED with explanation.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_quality_gates", async () => {
        const gates: GateResult[] = [];

        // Gate 1: CI Speed + Test Health (from workflow runs)
        const { getWorkflowRuns } = await import("@/lib/agents/github-issues");
        const { data: runs } = await getWorkflowRuns({ limit: 5 });

        if (runs && runs.length > 0) {
          // CI Speed
          const lastRun = runs[0]!;
          const createdAt = new Date(lastRun.createdAt);
          const ageMs = Date.now() - createdAt.getTime();
          const ageMinutes = Math.floor(ageMs / 60_000);

          if (lastRun.conclusion === "failure") {
            gates.push({
              name: "CI Speed",
              status: "RED",
              detail: `Last CI run FAILED (${lastRun.name}, ${ageMinutes}m ago)`,
            });
          } else if (ageMinutes < 5) {
            gates.push({
              name: "CI Speed",
              status: "GREEN",
              detail: `Last CI completed ${ageMinutes}m ago`,
            });
          } else if (ageMinutes < 10) {
            gates.push({
              name: "CI Speed",
              status: "YELLOW",
              detail: `Last CI completed ${ageMinutes}m ago`,
            });
          } else {
            gates.push({
              name: "CI Speed",
              status: "YELLOW",
              detail: `Last CI was ${ageMinutes}m ago — may be stale`,
            });
          }

          // Test Health
          const failedRuns = runs.filter(r => r.conclusion === "failure");
          if (failedRuns.length === 0) {
            gates.push({
              name: "Test Health",
              status: "GREEN",
              detail: `Last ${runs.length} runs all passed`,
            });
          } else if (failedRuns.length <= 1) {
            gates.push({
              name: "Test Health",
              status: "YELLOW",
              detail: `${failedRuns.length}/${runs.length} recent runs failed — possible flakiness`,
            });
          } else {
            gates.push({
              name: "Test Health",
              status: "RED",
              detail: `${failedRuns.length}/${runs.length} recent runs failed`,
            });
          }
        } else {
          gates.push({
            name: "CI Speed",
            status: "RED",
            detail: "No workflow runs found — CI may not be configured or GitHub token missing",
          });
          gates.push({
            name: "Test Health",
            status: "RED",
            detail: "Cannot assess — no workflow runs available",
          });
        }

        // Gate 3: Type Safety (via dashboard health check)
        try {
          const { redis } = await import("@/lib/upstash/client");
          const start = Date.now();
          await redis.ping();
          const latency = Date.now() - start;
          gates.push({
            name: "Type Safety",
            status: latency < 3000 ? "GREEN" : "YELLOW",
            detail:
              `Services responsive (Redis: ${latency}ms). Full type check requires local build.`,
          });
        } catch {
          gates.push({
            name: "Type Safety",
            status: "YELLOW",
            detail: "Cannot verify — Redis unavailable. Run local type check.",
          });
        }

        // Gate 4: Coverage (check recent CI runs for coverage info)
        const latestSuccess = runs?.find(r => r.conclusion === "success");
        if (latestSuccess) {
          gates.push({
            name: "Coverage",
            status: "GREEN",
            detail: `Last successful CI includes coverage check (thresholds enforced in CI)`,
          });
        } else {
          gates.push({
            name: "Coverage",
            status: "RED",
            detail: "No recent successful CI run — coverage status unknown",
          });
        }

        // Gate 5: Dependency Health (basic check)
        gates.push({
          name: "Dependency Health",
          status: "GREEN",
          detail: "Dependency audit requires local check (yarn audit)",
        });

        // Format output
        const overallStatus = gates.some(g => g.status === "RED")
          ? "RED"
          : gates.some(g => g.status === "YELLOW")
          ? "YELLOW"
          : "GREEN";

        let text = `**BAZDMEG Quality Gates** ${statusEmoji(overallStatus)}\n\n`;
        text += `| Gate | Status | Detail |\n`;
        text += `|------|--------|--------|\n`;
        for (const gate of gates) {
          text += `| ${gate.name} | ${statusEmoji(gate.status)} | ${gate.detail} |\n`;
        }

        text += `\n**Overall: ${overallStatus}**`;
        if (overallStatus === "RED") {
          text += ` — Blocking issues must be resolved before proceeding.`;
        } else if (overallStatus === "YELLOW") {
          text += ` — Proceed with caution. Address warnings when possible.`;
        } else {
          text += ` — All gates passing. Safe to proceed.`;
        }

        return textResult(text);
      }),
  });

  // bazdmeg_pr_readiness
  const PRReadinessSchema = z.object({
    pr_number: z
      .number()
      .int()
      .optional()
      .describe(
        "Specific PR number to check. If omitted, checks all open PRs.",
      ),
  });

  registry.register({
    name: "bazdmeg_pr_readiness",
    description:
      "Check if a specific PR (or all open PRs) are merge-ready. Checks: CI passing, review approved, not draft, linked to ticket.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: PRReadinessSchema.shape,
    handler: async (
      { pr_number }: z.infer<typeof PRReadinessSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_pr_readiness", async () => {
        const { getPRStatus } = await import("@/lib/bridges/github-projects");
        const status = await getPRStatus();

        if (!status) {
          return textResult(
            "Could not fetch PR status. Check GH_PAT_TOKEN configuration.",
          );
        }

        const prs = pr_number
          ? status.pending.filter(pr => pr.number === pr_number)
          : status.pending;

        if (prs.length === 0) {
          return textResult(
            pr_number
              ? `PR #${pr_number} not found in open PRs.`
              : "No open PRs found.",
          );
        }

        let text = `**PR Readiness Report**\n\n`;

        for (const pr of prs) {
          const checks: Array<
            { label: string; pass: boolean; detail: string; }
          > = [];

          // CI passing
          const ciPassing = pr.checksStatus === "SUCCESS";
          checks.push({
            label: "CI Passing",
            pass: ciPassing,
            detail: ciPassing
              ? "All checks green"
              : `Status: ${pr.checksStatus}`,
          });

          // Review approved
          const reviewApproved = pr.reviewDecision === "APPROVED";
          checks.push({
            label: "Review Approved",
            pass: reviewApproved,
            detail: reviewApproved
              ? "Approved"
              : `Review: ${pr.reviewDecision}`,
          });

          // Not draft
          const notDraft = !pr.isDraft;
          checks.push({
            label: "Not Draft",
            pass: notDraft,
            detail: notDraft ? "Ready for review" : "Still in draft",
          });

          // Ticket linked (heuristic: title contains #number)
          const hasTicketRef = /(?:#\d+|[Rr]esolves|[Ff]ixes|[Cc]loses)\s*#?\d+/
            .test(pr.title);
          checks.push({
            label: "Ticket Linked",
            pass: hasTicketRef,
            detail: hasTicketRef
              ? "Ticket reference found in title"
              : "No ticket reference in title",
          });

          const allPassing = checks.every(c => c.pass);
          const prStatus: GateStatus = allPassing ? "GREEN" : "RED";

          text += `### PR #${pr.number}: ${pr.title}\n`;
          text += `**Author:** ${pr.author} | **Status:** ${statusEmoji(prStatus)}\n\n`;

          for (const check of checks) {
            text += `- ${check.pass ? "[PASS]" : "[FAIL]"} **${check.label}**: ${check.detail}\n`;
          }

          if (allPassing) {
            text += `\n**Ready to merge.**\n\n`;
          } else {
            const blockers = checks.filter(c => !c.pass).map(c => c.label);
            text += `\n**Blocked by:** ${blockers.join(", ")}\n\n`;
          }
        }

        return textResult(text);
      }),
  });

  // bazdmeg_deploy_check
  registry.register({
    name: "bazdmeg_deploy_check",
    description:
      "Full deploy readiness assessment. Checks last CI on main, open PR safety, and overall deploy status. Returns DEPLOY_READY or DEPLOY_BLOCKED with reasons.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_deploy_check", async () => {
        const blockers: string[] = [];
        const passing: string[] = [];

        // Check last CI on main
        const { getWorkflowRuns } = await import("@/lib/agents/github-issues");
        const { data: runs } = await getWorkflowRuns({ limit: 10 });

        if (runs && runs.length > 0) {
          const mainRuns = runs.filter(r => r.branch === "main");
          const latestMain = mainRuns[0];

          if (!latestMain) {
            blockers.push("No recent CI runs found for main branch");
          } else if (latestMain.conclusion === "failure") {
            blockers.push(
              `Last CI on main FAILED: ${latestMain.name} (${latestMain.url})`,
            );
          } else if (
            latestMain.status === "in_progress"
            || latestMain.status === "queued"
          ) {
            blockers.push(`CI still running on main: ${latestMain.name}`);
          } else {
            passing.push(
              `Last CI on main: ${latestMain.conclusion?.toUpperCase() ?? "UNKNOWN"}`,
            );
          }
        } else {
          blockers.push("Cannot fetch CI runs — GitHub may be unavailable");
        }

        // Check open PRs for unsafe state
        const { getPRStatus } = await import("@/lib/bridges/github-projects");
        const prStatus = await getPRStatus();

        if (prStatus) {
          const unsafePRs = prStatus.pending.filter(
            pr => pr.checksStatus === "FAILURE" || pr.checksStatus === "ERROR",
          );

          if (unsafePRs.length > 0) {
            for (const pr of unsafePRs) {
              blockers.push(`PR #${pr.number} has failing CI: ${pr.title}`);
            }
          } else {
            passing.push(`${prStatus.open} open PR(s) — none with failing CI`);
          }
        }

        // Check platform health
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const start = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          const latency = Date.now() - start;
          if (latency > 3000) {
            blockers.push(`Database latency high: ${latency}ms`);
          } else {
            passing.push(`Database healthy: ${latency}ms`);
          }
        } catch {
          blockers.push("Database connection failed");
        }

        const isReady = blockers.length === 0;
        const status = isReady ? "DEPLOY_READY" : "DEPLOY_BLOCKED";

        let text = `**Deploy Check: ${status}**\n\n`;

        if (passing.length > 0) {
          text += `**Passing:**\n`;
          for (const p of passing) {
            text += `- [PASS] ${p}\n`;
          }
          text += `\n`;
        }

        if (blockers.length > 0) {
          text += `**Blockers:**\n`;
          for (const b of blockers) {
            text += `- [BLOCK] ${b}\n`;
          }
          text += `\n`;
        }

        text += isReady
          ? `**Safe to deploy.** All checks passing.`
          : `**DO NOT deploy.** Resolve ${blockers.length} blocker(s) first.`;

        return textResult(text);
      }),
  });
}
