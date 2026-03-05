/**
 * Spike Review — MCP Server
 *
 * Branded AI code review bot with BAZDMEG quality gates.
 * Exposes review tools via Model Context Protocol.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer, startMcpServer, registerFeedbackTool, createErrorShipper } from "@spike-land-ai/mcp-server-base";
import { GitHubClient } from "./github/client.js";
import type { DiffSide } from "./types.js";
import {
  CheckGatesSchema,
  PostCheckRunSchema,
  PRParamsSchema,
  ReviewDiffSchema,
  ReviewPRSchema,
  SubmitReviewSchema,
  ValidateCommentTargetSchema,
} from "./types.js";
import { reviewPR } from "./tools/review-pr.js";
import { checkBazdmegGates } from "./tools/check-gates.js";
import {
  computeOverallStatus,
  formatGateResults,
  getBuiltinRules,
  runGates,
} from "./rules/engine.js";
import type { RuleContext } from "./rules/engine.js";
import { buildReviewPrompt } from "./ai/prompts.js";

export function createServer(githubToken: string): McpServer {
  const server = createMcpServer({
    name: "Spike Review",
    version: "0.1.0",
  });

  const github = new GitHubClient({ token: githubToken });

  // ── review_pr ──────────────────────────────────────────────────────────────
  server.tool(
    "review_pr",
    "Full PR review: fetch diff, run BAZDMEG gates, build review prompt. Returns gate results and review prompt for LLM analysis.",
    ReviewPRSchema.shape,
    async (params) => {
      const { owner, repo, prNumber, customPrompt, rulesPath } = params;
      const result = await reviewPR(
        { owner, repo, prNumber, customPrompt, rulesPath },
        { githubToken },
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `${result.gateResults}\n\n---\n\n## Review Prompt\n\n${result.reviewPrompt}\n\n---\n\nSuggested decision: **${result.decision}**`,
          },
        ],
      };
    },
  );

  // ── check_bazdmeg_gates ────────────────────────────────────────────────────
  server.tool(
    "check_bazdmeg_gates",
    "Run BAZDMEG quality gates against a diff. Returns gate results without posting to GitHub. Use for pre-push validation.",
    CheckGatesSchema.shape,
    async (params) => {
      const { diff, claudeMdContent } = params;
      const result = checkBazdmegGates({ diff, claudeMdContent });
      return { content: [{ type: "text" as const, text: result }] };
    },
  );

  // ── get_pr_details ─────────────────────────────────────────────────────────
  server.tool(
    "get_pr_details",
    "Get full PR metadata including title, body, author, additions, deletions.",
    PRParamsSchema.shape,
    async (params) => {
      const { owner, repo, prNumber } = params;
      const details = await github.getPRDetails(owner, repo, prNumber);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    },
  );

  // ── get_pr_files ───────────────────────────────────────────────────────────
  server.tool(
    "get_pr_files",
    "List files changed in a PR with diff hunks parsed.",
    PRParamsSchema.shape,
    async (params) => {
      const { owner, repo, prNumber } = params;
      const files = await github.getPRFiles(owner, repo, prNumber);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    },
  );

  // ── submit_review ──────────────────────────────────────────────────────────
  server.tool(
    "submit_review",
    "Submit a review (APPROVE, REQUEST_CHANGES, or COMMENT) with optional inline comments to a GitHub PR.",
    SubmitReviewSchema.shape,
    async (params) => {
      const { owner, repo, prNumber, body, event, comments } = params;
      const prDetails = await github.getPRDetails(owner, repo, prNumber);
      const result = await github.submitReview(owner, repo, prNumber, {
        body,
        event,
        commitId: prDetails.headSha,
        comments,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Review submitted (ID: ${result.id}, event: ${event})`,
          },
        ],
      };
    },
  );

  // ── validate_comment_target ────────────────────────────────────────────────
  server.tool(
    "validate_comment_target",
    "Check if a file path + line number is a valid target for an inline review comment.",
    ValidateCommentTargetSchema.shape,
    async (params) => {
      const { owner, repo, prNumber, path, line, side } = params;
      const files = await github.getPRFiles(owner, repo, prNumber);
      const file = files.find((f) => f.filename === path);
      if (!file) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                valid: false,
                reason: `File ${path} not found in PR diff`,
              }),
            },
          ],
        };
      }
      const validation = github.validateCommentTarget(
        file.hunks,
        line,
        side as DiffSide | undefined,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(validation, null, 2),
          },
        ],
      };
    },
  );

  // ── post_check_run ─────────────────────────────────────────────────────────
  server.tool(
    "post_check_run",
    "Create or update a branded 'Spike Review' status check on a PR commit. Appears with your app's logo.",
    PostCheckRunSchema.shape,
    async (params) => {
      const { owner, repo, headSha, status, conclusion, summary, details } = params;
      const result = await github.createCheckRun(owner, repo, {
        name: "Spike Review",
        headSha,
        status,
        conclusion,
        summary,
        details,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Check run created (ID: ${result.id})`,
          },
        ],
      };
    },
  );

  // ── review_diff ────────────────────────────────────────────────────────────
  server.tool(
    "review_diff",
    "Review a local git diff without GitHub context. Runs BAZDMEG gates and returns a review prompt for LLM analysis.",
    ReviewDiffSchema.shape,
    async (params) => {
      const { diff, context, rules } = params;
      const diffLines = diff.split("\n");
      const addedFiles = new Set<string>();
      for (const line of diffLines) {
        if (line.startsWith("+++ b/")) {
          addedFiles.add(line.replace("+++ b/", ""));
        }
      }

      const additions = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
      const deletions = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

      const ruleContext: RuleContext = {
        diff,
        files: [...addedFiles],
        additions,
        deletions,
        prTitle: "(local diff)",
        prBody: context ?? null,
        claudeMdRules: rules ?? [],
      };

      const builtinRules = getBuiltinRules();
      const gateResults = runGates(builtinRules, ruleContext);
      const gateOutput = formatGateResults(gateResults);
      const overallStatus = computeOverallStatus(gateResults);

      const prompt = buildReviewPrompt(
        {
          title: "(local diff)",
          body: context ?? null,
          state: "open",
          author: "local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mergeable: null,
          merged: false,
          additions,
          deletions,
          changedFiles: addedFiles.size,
          headSha: "local",
          baseSha: "local",
          baseRef: "main",
          headRef: "local",
        },
        diff,
        undefined,
        rules,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${gateOutput}\n\n---\n\n## Review Prompt\n\n${prompt}\n\n---\n\nGate status: **${overallStatus}**`,
          },
        ],
      };
    },
  );

  registerFeedbackTool(server, { serviceName: "spike-review", toolName: "review_feedback" });

  return server;
}

// ── Server startup ───────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  const shipper = createErrorShipper();
  process.on('uncaughtException', (err) => shipper.shipError({ service_name: "spike-review", message: err.message, stack_trace: err.stack, severity: "high" }));
  process.on('unhandledRejection', (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack_trace = err instanceof Error ? err.stack : undefined;
    shipper.shipError({ service_name: "spike-review", message, stack_trace, severity: "high" });
  });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(
      "GITHUB_TOKEN environment variable is required. Set it to a GitHub PAT or App installation token.",
    );
    process.exit(1);
  }

  const server = createServer(token);
  await startMcpServer(server);
}

export { GitHubClient } from "./github/client.js";
export { parseDiffHunks } from "./github/client.js";
export type { GitHubClientOptions } from "./github/client.js";
export * from "./types.js";
export * from "./rules/engine.js";
export * from "./rules/claude-md-parser.js";
export * from "./ai/prompts.js";
export * from "./ai/confidence.js";
