/**
 * review_pr Tool
 *
 * Full PR review: fetches diff, runs BAZDMEG gates,
 * builds review prompt, and posts results to GitHub.
 */

import { GitHubClient } from "../github/client.js";
import { buildReviewPrompt } from "../ai/prompts.js";
import {
  computeOverallStatus,
  formatGateResults,
  getBuiltinRules,
  runGates,
} from "../rules/engine.js";
import type { RuleContext } from "../rules/engine.js";
import type { ReviewPRSchema } from "../types.js";
import type { z } from "zod";

export interface ReviewPRDeps {
  githubToken: string;
}

export async function reviewPR(
  params: z.infer<typeof ReviewPRSchema>,
  deps: ReviewPRDeps,
): Promise<{
  gateResults: string;
  reviewPrompt: string;
  decision: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
}> {
  const client = new GitHubClient({ token: deps.githubToken });

  // Fetch PR details and diff
  const [prDetails, diff, files] = await Promise.all([
    client.getPRDetails(params.owner, params.repo, params.prNumber),
    client.getPRDiff(params.owner, params.repo, params.prNumber),
    client.getPRFiles(params.owner, params.repo, params.prNumber),
  ]);

  // Run BAZDMEG quality gates
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
  const overallGateStatus = computeOverallStatus(gateResults);

  // Build review prompt for LLM
  const reviewPrompt = buildReviewPrompt(prDetails, diff, params.customPrompt);

  // Determine decision based on gates
  const decision: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" =
    overallGateStatus === "RED"
      ? "REQUEST_CHANGES"
      : overallGateStatus === "YELLOW"
        ? "COMMENT"
        : "APPROVE";

  return {
    gateResults: gateOutput,
    reviewPrompt,
    decision,
  };
}
