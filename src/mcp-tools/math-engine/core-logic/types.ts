/**
 * Math Engine — Domain Types
 */

export type AgentRole = "analyst" | "constructor" | "adversary";

export type ProblemCategory = "audit_gap" | "erdos_conjecture" | "open_problem";

export type ProblemStatus = "open" | "in_progress" | "resolved" | "blocked";

export type FindingCategory = "structure" | "proof_step" | "counterexample" | "gap" | "insight";

export type SessionStatus = "running" | "converged" | "blocked" | "failed";

export interface Problem {
  id: string;
  title: string;
  category: ProblemCategory;
  description: string;
  status: ProblemStatus;
  references: string[];
}

export interface Finding {
  agentRole: AgentRole;
  iteration: number;
  category: FindingCategory;
  content: string;
  confidence: number; // 0-1
  timestamp: number;
}

export interface ProofAttempt {
  id: string;
  problemId: string;
  agentRole: AgentRole;
  iteration: number;
  method: string;
  steps: string[];
  status: "pending" | "verified" | "refuted" | "incomplete";
  refutation?: string;
}

export interface AgentState {
  role: AgentRole;
  lastOutput: string;
  findings: Finding[];
  proofAttempts: ProofAttempt[];
}

export interface SessionState {
  sessionId: string;
  problemId: string;
  iteration: number;
  maxIterations: number;
  status: SessionStatus;
  agents: Record<AgentRole, AgentState>;
  findings: Finding[];
  proofAttempts: ProofAttempt[];
  startedAt: number;
  updatedAt: number;
}

export interface LLMCallOptions {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMProvider {
  complete(options: LLMCallOptions): Promise<string>;
}

export function createEmptyAgentState(role: AgentRole): AgentState {
  return {
    role,
    lastOutput: "",
    findings: [],
    proofAttempts: [],
  };
}

export function createSessionState(
  sessionId: string,
  problemId: string,
  maxIterations: number,
): SessionState {
  return {
    sessionId,
    problemId,
    iteration: 0,
    maxIterations,
    status: "running",
    agents: {
      analyst: createEmptyAgentState("analyst"),
      constructor: createEmptyAgentState("constructor"),
      adversary: createEmptyAgentState("adversary"),
    },
    findings: [],
    proofAttempts: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
