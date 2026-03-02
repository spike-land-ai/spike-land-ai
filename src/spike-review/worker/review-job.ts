/**
 * Review Job
 *
 * Orchestrates the full review pipeline:
 * 1. Create check run (in_progress)
 * 2. Fetch PR diff + details
 * 3. Run BAZDMEG quality gates
 * 4. Call Claude API for AI review
 * 5. Post review + update check run
 */

import { GitHubClient } from "../github/client.js";
import {
  computeOverallStatus,
  formatGateResults,
  getBuiltinRules,
  runGates,
} from "../rules/engine.js";
import type { RuleContext } from "../rules/engine.js";
import { buildReviewPrompt } from "../ai/prompts.js";
import type { PRContext } from "./webhook-handler.js";
import type { Env } from "./env.js";

const REVIEW_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

async function callClaude(prompt: string, token: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: REVIEW_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error ${response.status}: ${text}`);
  }

  const data: ClaudeResponse = await response.json();
  const textBlock = data.content.find((c) => c.type === "text");
  return textBlock?.text ?? "";
}

export async function runReviewJob(
  ctx: PRContext,
  env: Env,
): Promise<{ success: boolean; summary: string }> {
  const github = new GitHubClient({ token: env.GITHUB_TOKEN });

  // 1. Create check run
  const checkRun = await github.createCheckRun(ctx.owner, ctx.repo, {
    name: "Spike Review",
    headSha: ctx.headSha,
    status: "in_progress",
    summary: "Running BAZDMEG quality gates and AI review...",
  });

  try {
    // 2. Fetch PR data
    const [prDetails, diff, files] = await Promise.all([
      github.getPRDetails(ctx.owner, ctx.repo, ctx.prNumber),
      github.getPRDiff(ctx.owner, ctx.repo, ctx.prNumber),
      github.getPRFiles(ctx.owner, ctx.repo, ctx.prNumber),
    ]);

    // 3. Run BAZDMEG gates
    const ruleContext: RuleContext = {
      diff,
      files: files.map((f) => f.filename),
      additions: prDetails.additions,
      deletions: prDetails.deletions,
      prTitle: prDetails.title,
      prBody: prDetails.body,
      claudeMdRules: [],
    };

    const rules = getBuiltinRules();
    const gateResults = runGates(rules, ruleContext);
    const gateOutput = formatGateResults(gateResults);
    const overallStatus = computeOverallStatus(gateResults);

    // 4. Build prompt and call Claude
    const reviewPrompt = buildReviewPrompt(prDetails, diff);
    const aiReview = await callClaude(reviewPrompt, env.CLAUDE_CODE_OAUTH_TOKEN);

    // 5. Determine verdict
    // Conservative: automated review never auto-approves. Human approval is
    // always required. RED → REQUEST_CHANGES, anything else → COMMENT.
    const event: "REQUEST_CHANGES" | "COMMENT" =
      overallStatus === "RED" ? "REQUEST_CHANGES" : "COMMENT";

    const reviewBody = `${gateOutput}\n\n---\n\n## AI Review\n\n${aiReview}`;

    // 6. Post review
    await github.submitReview(ctx.owner, ctx.repo, ctx.prNumber, {
      body: reviewBody,
      event,
      commitId: ctx.headSha,
    });

    // 7. Update check run
    const conclusion = overallStatus === "RED" ? "action_required" : "success";

    await github.updateCheckRun(ctx.owner, ctx.repo, checkRun.id, {
      status: "completed",
      conclusion,
      summary: `Quality gates: ${overallStatus}`,
      details: gateOutput,
    });

    return { success: true, summary: `Review posted. Gates: ${overallStatus}` };
  } catch (error) {
    // Update check run with failure
    const message = error instanceof Error ? error.message : String(error);
    await github.updateCheckRun(ctx.owner, ctx.repo, checkRun.id, {
      status: "completed",
      conclusion: "failure",
      summary: `Review failed: ${message}`,
    });

    return { success: false, summary: message };
  }
}
