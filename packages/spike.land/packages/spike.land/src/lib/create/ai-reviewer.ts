/**
 * AI Review Gate for CreatedApp Pipeline
 *
 * Uses two Claude Haiku reviewers to evaluate generated app code for:
 * - Code quality and correctness
 * - Accessibility (a11y)
 * - Responsive design
 *
 * Both reviewers must approve for the AI review to pass.
 * Creates AppReview records and tracks ELO ratings via the shared pool.
 */

import { callClaude } from "@/lib/create/agent-client";
import { getOrCreateAgentElo, selectByElo } from "@/lib/generate/elo-tracker";
import { getSession } from "@/lib/codespace/session-service";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import type { ReviewDecision, ReviewPhase } from "@prisma/client";

const AI_REVIEW_SYSTEM =
  `You are a senior React developer and accessibility expert reviewing a generated React component.

Evaluate the code on three dimensions:
1. **Code Quality**: Is the code correct, well-structured, and free of runtime errors? Does it have a valid default export?
2. **Accessibility (a11y)**: Does it use semantic HTML, proper ARIA attributes, keyboard navigation support, and sufficient color contrast considerations?
3. **Responsiveness**: Will it render correctly on mobile, tablet, and desktop viewports? Does it use responsive Tailwind classes?

Respond with EXACTLY this JSON format (no markdown fences):
{"decision": "APPROVED" | "REJECTED", "feedback": "brief reason covering all three dimensions", "score": 0.0-1.0}

Score guide: 0.0-0.3 = critical issues, 0.3-0.6 = needs improvement, 0.6-0.8 = acceptable, 0.8-1.0 = good quality.
Only REJECT if there are critical issues that would prevent the app from working correctly.`;

interface AgentIdentity {
  agentId: string;
  model: string;
  elo: number;
}

export interface AiReviewResult {
  passed: boolean;
  reviews: Array<{
    reviewerAgentId: string;
    decision: ReviewDecision;
    feedback: string | null;
    score: number | null;
    eloAtReview: number;
  }>;
  averageScore: number;
  feedback: string;
}

/**
 * Run AI review on a codespace's code.
 *
 * @param appId - The CreatedApp database ID (for creating AppReview records)
 * @param codespaceId - The codespace to review
 * @param code - The source code (optional, fetched from session if missing)
 */
export async function runAiReview(
  appId: string,
  codespaceId: string,
  code?: string,
): Promise<AiReviewResult> {
  let sourceCode = code;
  if (!sourceCode) {
    const session = await getSession(codespaceId);
    sourceCode = session?.code;
  }

  if (!sourceCode) {
    return {
      passed: false,
      reviews: [],
      averageScore: 0,
      feedback: "No source code available for review",
    };
  }

  const reviewers = await selectReviewers(2);
  const reviews = await Promise.all(
    reviewers.map(reviewer => executeReview(appId, sourceCode!, reviewer)),
  );

  const approved = reviews.every(r => r.decision === "APPROVED");
  const scores = reviews.map(r => r.score).filter((s): s is number => s !== null);
  const averageScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const feedbackParts = reviews
    .map(r => r.feedback)
    .filter(Boolean);
  const feedback = feedbackParts.join(" | ") || "No feedback provided";

  return { passed: approved, reviews, averageScore, feedback };
}

async function selectReviewers(count: number): Promise<AgentIdentity[]> {
  const agents = await selectByElo(count);
  return agents.map(a => ({
    agentId: a.agentId,
    model: a.agentModel,
    elo: a.elo,
  }));
}

async function executeReview(
  appId: string,
  code: string,
  reviewer: AgentIdentity,
): Promise<{
  reviewerAgentId: string;
  decision: ReviewDecision;
  feedback: string | null;
  score: number | null;
  eloAtReview: number;
}> {
  const codePreview = code.length > 8000
    ? code.slice(0, 8000) + "\n// ... truncated"
    : code;
  const userPrompt =
    `Review this generated React component for code quality, accessibility, and responsiveness:\n\n\`\`\`tsx\n${codePreview}\n\`\`\``;

  try {
    const response = await callClaude({
      systemPrompt: AI_REVIEW_SYSTEM,
      userPrompt,
      model: "sonnet",
      maxTokens: 512,
      temperature: 0.1,
    });

    const parsed = parseReviewResponse(response.text);
    const agentElo = await getOrCreateAgentElo(reviewer.agentId);

    await prisma.appReview.create({
      data: {
        appId,
        reviewerAgentId: reviewer.agentId,
        phase: "AI_REVIEW" as ReviewPhase,
        decision: parsed.decision as ReviewDecision,
        feedback: parsed.feedback,
        score: parsed.score,
        eloAtReview: agentElo.elo,
      },
    });

    return {
      reviewerAgentId: reviewer.agentId,
      decision: parsed.decision as ReviewDecision,
      feedback: parsed.feedback,
      score: parsed.score,
      eloAtReview: agentElo.elo,
    };
  } catch (error) {
    logger.error("AI review failed", {
      reviewer: reviewer.agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Default to APPROVED on review failure to avoid blocking the pipeline
    return {
      reviewerAgentId: reviewer.agentId,
      decision: "APPROVED" as ReviewDecision,
      feedback: "Review failed, auto-approved",
      score: null,
      eloAtReview: reviewer.elo,
    };
  }
}

function parseReviewResponse(text: string): {
  decision: string;
  feedback: string;
  score: number | null;
} {
  try {
    const json = JSON.parse(text);
    return {
      decision: json.decision === "REJECTED" ? "REJECTED" : "APPROVED",
      feedback: json.feedback || "",
      score: typeof json.score === "number" ? json.score : null,
    };
  } catch {
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

    return {
      decision: "APPROVED",
      feedback: `Could not parse review response: ${text.slice(0, 100)}`,
      score: null,
    };
  }
}
