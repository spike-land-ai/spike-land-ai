import type { GeneratedRouteStatus, ReviewDecision, ReviewPhase } from "@prisma/client";

export type PipelinePhase =
  | "NEW"
  | "PLANNING"
  | "PLAN_REVIEW"
  | "CODING"
  | "TRANSPILING"
  | "CODE_REVIEW"
  | "PUBLISHED"
  | "FAILED";

export interface AgentIdentity {
  agentId: string;
  model: string;
  systemPrompt: string;
  elo: number;
}

export interface ReviewResult {
  reviewerAgentId: string;
  phase: ReviewPhase;
  decision: ReviewDecision;
  feedback: string | null;
  score: number | null;
  eloAtReview: number;
}

export interface PipelineContext {
  slug: string;
  originalUrl: string;
  path: string[];
  routeId: string;
  userId: string | undefined;
  category: string | null;
  planJson: Record<string, unknown> | null;
  generatedCode: string | null;
  codespaceId: string | null;
  codespaceUrl: string | null;
  githubIssueNumber: number | null;
  attempts: number;
  startTime: number;
}

export type GenerationEvent =
  | { type: "status"; phase: PipelinePhase; message: string }
  | { type: "plan_ready"; plan: Record<string, unknown> }
  | {
      type: "review_started";
      phase: ReviewPhase;
      reviewers: Array<{ agentId: string; elo: number }>;
    }
  | {
      type: "review_complete";
      phase: ReviewPhase;
      results: ReviewResult[];
      approved: boolean;
    }
  | { type: "code_generated"; codePreview: string }
  | { type: "transpile_result"; success: boolean; error?: string }
  | {
      type: "complete";
      slug: string;
      codespaceUrl: string;
      title: string;
      description: string;
    }
  | { type: "error"; message: string; phase: PipelinePhase }
  | { type: "heartbeat"; timestamp: number };

export type { GeneratedRouteStatus, ReviewDecision, ReviewPhase };
