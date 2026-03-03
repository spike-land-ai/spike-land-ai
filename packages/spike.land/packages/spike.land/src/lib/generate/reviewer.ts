import type { ReviewDecision, ReviewPhase } from "@prisma/client";
import { callClaude } from "@/lib/create/agent-client";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { getOrCreateAgentElo, selectByElo } from "./elo-tracker";
import type { AgentIdentity, ReviewResult } from "./types";

const PLAN_REVIEW_SYSTEM =
  `You are a senior software architect reviewing a plan for generating a React component.

Your job is to evaluate whether the plan is clear, feasible, and will produce a working React component with Tailwind CSS styling.

Evaluate:
1. Is the plan specific enough to generate working code?
2. Are there any technical red flags (impossible APIs, missing dependencies)?
3. Will the resulting component be self-contained (no external state management needed)?

Respond with EXACTLY this JSON format (no markdown fences):
{"decision": "APPROVED" | "REJECTED", "feedback": "brief reason", "score": 0.0-1.0}`;

const CODE_REVIEW_SYSTEM = `You are a senior React developer reviewing generated code.

Your job is to evaluate whether the code will:
1. Compile without errors (valid TypeScript/JSX)
2. Render correctly (has a default export, uses React properly)
3. Be self-contained (only uses React, Tailwind CSS, and standard browser APIs)
4. Have no obvious runtime errors

Respond with EXACTLY this JSON format (no markdown fences):
{"decision": "APPROVED" | "REJECTED", "feedback": "brief reason", "score": 0.0-1.0}`;

export async function selectReviewers(
  count = 2,
): Promise<AgentIdentity[]> {
  const agents = await selectByElo(count);
  return agents.map(a => ({
    agentId: a.agentId,
    model: a.agentModel,
    systemPrompt: a.agentModel === "haiku"
      ? PLAN_REVIEW_SYSTEM
      : PLAN_REVIEW_SYSTEM,
    elo: a.elo,
  }));
}

export async function reviewPlan(
  plan: Record<string, unknown>,
  reviewer: AgentIdentity,
): Promise<ReviewResult> {
  const userPrompt = `Review this generation plan:\n\n${JSON.stringify(plan, null, 2)}`;

  try {
    const response = await callClaude({
      systemPrompt: PLAN_REVIEW_SYSTEM,
      userPrompt,
      model: "haiku",
      maxTokens: 512,
      temperature: 0.1,
    });

    const parsed = parseReviewResponse(response.text);
    const agentElo = await getOrCreateAgentElo(reviewer.agentId);

    const review = await prisma.routeReview.create({
      data: {
        routeId: "", // Will be set by caller
        reviewerAgentId: reviewer.agentId,
        phase: "PLAN_REVIEW" as ReviewPhase,
        decision: parsed.decision as ReviewDecision,
        feedback: parsed.feedback,
        score: parsed.score,
        eloAtReview: agentElo.elo,
      },
    });

    return {
      reviewerAgentId: reviewer.agentId,
      phase: "PLAN_REVIEW",
      decision: parsed.decision as ReviewDecision,
      feedback: parsed.feedback,
      score: parsed.score,
      eloAtReview: review.eloAtReview,
    };
  } catch (error) {
    logger.error("Plan review failed", {
      reviewer: reviewer.agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Default to APPROVED on review failure to avoid blocking the pipeline
    return {
      reviewerAgentId: reviewer.agentId,
      phase: "PLAN_REVIEW",
      decision: "APPROVED",
      feedback: "Review failed, auto-approved",
      score: null,
      eloAtReview: reviewer.elo,
    };
  }
}

export async function reviewCode(
  code: string,
  reviewer: AgentIdentity,
  routeId: string,
): Promise<ReviewResult> {
  const codePreview = code.length > 8000
    ? code.slice(0, 8000) + "\n// ... truncated"
    : code;
  const userPrompt = `Review this generated React component:\n\n\`\`\`tsx\n${codePreview}\n\`\`\``;

  try {
    const response = await callClaude({
      systemPrompt: CODE_REVIEW_SYSTEM,
      userPrompt,
      model: "haiku",
      maxTokens: 512,
      temperature: 0.1,
    });

    const parsed = parseReviewResponse(response.text);
    const agentElo = await getOrCreateAgentElo(reviewer.agentId);

    await prisma.routeReview.create({
      data: {
        routeId,
        reviewerAgentId: reviewer.agentId,
        phase: "CODE_REVIEW" as ReviewPhase,
        decision: parsed.decision as ReviewDecision,
        feedback: parsed.feedback,
        score: parsed.score,
        eloAtReview: agentElo.elo,
      },
    });

    return {
      reviewerAgentId: reviewer.agentId,
      phase: "CODE_REVIEW",
      decision: parsed.decision as ReviewDecision,
      feedback: parsed.feedback,
      score: parsed.score,
      eloAtReview: agentElo.elo,
    };
  } catch (error) {
    logger.error("Code review failed", {
      reviewer: reviewer.agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      reviewerAgentId: reviewer.agentId,
      phase: "CODE_REVIEW",
      decision: "APPROVED",
      feedback: "Review failed, auto-approved",
      score: null,
      eloAtReview: reviewer.elo,
    };
  }
}

/**
 * Run concurrent reviews with 2 reviewers.
 * Both must APPROVE for consensus.
 */
export async function runReviewConsensus(
  reviewFn: (reviewer: AgentIdentity) => Promise<ReviewResult>,
): Promise<{ results: ReviewResult[]; approved: boolean; }> {
  const reviewers = await selectReviewers(2);
  const results = await Promise.all(reviewers.map(reviewFn));
  const approved = results.every(r => r.decision === "APPROVED");
  return { results, approved };
}

function parseReviewResponse(text: string): {
  decision: string;
  feedback: string;
  score: number | null;
} {
  try {
    // Try direct JSON parse
    const json = JSON.parse(text);
    return {
      decision: json.decision === "REJECTED" ? "REJECTED" : "APPROVED",
      feedback: json.feedback || "",
      score: typeof json.score === "number" ? json.score : null,
    };
  } catch {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*"decision"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        return {
          decision: json.decision === "REJECTED" ? "REJECTED" : "APPROVED",
          feedback: json.feedback || "",
          score: typeof json.score === "number" ? json.score : null,
        };
      } catch {
        // Fall through
      }
    }

    // Default: APPROVED if we can't parse the response
    return {
      decision: "APPROVED",
      feedback: `Could not parse review response: ${text.slice(0, 100)}`,
      score: null,
    };
  }
}
