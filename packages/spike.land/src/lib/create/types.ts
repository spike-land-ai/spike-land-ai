export type AgentPhase =
  | "PLANNING"
  | "GENERATING"
  | "TRANSPILING"
  | "VERIFYING"
  | "FIXING"
  | "LEARNING"
  | "AUTO_REVIEW"
  | "AI_REVIEW"
  | "PUBLISHED"
  | "FAILED";

export type StreamEvent =
  | { type: "agent"; name: string; model: string }
  | { type: "status"; message: string }
  | { type: "phase"; phase: AgentPhase; message: string; iteration?: number }
  | { type: "code_generated"; codePreview: string }
  | { type: "error_detected"; error: string; iteration: number }
  | { type: "error_fixed"; iteration: number }
  | { type: "learning"; notePreview: string }
  | {
      type: "complete";
      slug: string;
      url: string;
      title: string;
      description: string;
      relatedApps: string[];
      agent?: string;
    }
  | {
      type: "error";
      message: string;
      codespaceUrl?: string;
      generatedCode?: string;
    }
  | { type: "review_started"; phase: "AUTO_REVIEW" | "AI_REVIEW" }
  | {
      type: "review_complete";
      phase: "AUTO_REVIEW" | "AI_REVIEW";
      approved: boolean;
      score: number;
      feedback?: string;
    }
  | { type: "heartbeat"; timestamp: number }
  | {
      type: "timeout";
      message: string;
      codespaceUrl?: string;
      generatedCode?: string;
    };

export interface CreateGenerationResult {
  success: boolean;
  codeSpace: string;
  code?: string;
  title?: string;
  description?: string;
  error?: string;
  buildLog?: string[];
}
