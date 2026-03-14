/**
 * Math Engine — Agent Orchestrator
 *
 * Runs 3 parallel agents (Analyst, Constructor, Adversary) with cross-pollination.
 */

import type {
  AgentRole,
  Finding,
  LLMProvider,
  Problem,
  ProofAttempt,
  SessionState,
} from "./types.js";
import { createSessionState } from "./types.js";
import { getProblemById } from "./problem-registry.js";
import { getSystemPrompt, getUserPrompt } from "./prompt-templates.js";
import { verifyProof, verificationToFindings } from "./proof-verifier.js";

// Active sessions
const sessions = new Map<string, SessionState>();

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

export function listSessions(): SessionState[] {
  return [...sessions.values()];
}

export async function runMultiAgentSolve(
  problemId: string,
  maxIterations: number,
  llm: LLMProvider,
): Promise<SessionState> {
  const problem = getProblemById(problemId);
  if (!problem) {
    throw new Error(`Problem not found: ${problemId}`);
  }

  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session = createSessionState(sessionId, problemId, maxIterations);
  sessions.set(sessionId, session);

  try {
    for (let iter = 0; iter < maxIterations; iter++) {
      session.iteration = iter + 1;
      session.updatedAt = Date.now();

      // Run all 3 agents in parallel
      const roles: AgentRole[] = ["analyst", "constructor", "adversary"];
      const agentResults = await Promise.all(
        roles.map((role) => runAgent(role, problem, session, llm)),
      );

      // Merge findings and proof attempts
      for (const [i, role] of roles.entries()) {
        const result = agentResults[i];
        if (!result) continue;
        session.agents[role].lastOutput = result.rawOutput;
        session.agents[role].findings.push(...result.findings);
        session.findings.push(...result.findings);

        if (result.proofAttempts.length > 0) {
          session.agents[role].proofAttempts.push(...result.proofAttempts);
          session.proofAttempts.push(...result.proofAttempts);
        }
      }

      // Verify any new proof attempts
      const newProofs = session.proofAttempts.filter((p) => p.status === "pending");
      for (const proof of newProofs) {
        const verification = await verifyProof(proof, llm);
        proof.status =
          verification.overallStatus === "verified"
            ? "verified"
            : verification.overallStatus === "refuted"
              ? "refuted"
              : "incomplete";
        if (verification.overallStatus === "refuted") {
          proof.refutation = verification.summary;
        }
        const vFindings = verificationToFindings(verification, session.iteration);
        session.findings.push(...vFindings);
      }

      // Check halt conditions
      if (session.proofAttempts.some((p) => p.status === "verified")) {
        session.status = "converged";
        break;
      }

      // Check if all agents report blocking
      const allBlocked = roles.every((role) => {
        const lastFindings = session.agents[role].findings.filter(
          (f) => f.iteration === session.iteration,
        );
        return (
          lastFindings.length > 0 &&
          lastFindings.every((f) => f.category === "gap" && f.confidence > 0.8)
        );
      });

      if (allBlocked) {
        session.status = "blocked";
        break;
      }
    }

    if (session.status === "running") {
      session.status = session.proofAttempts.some((p) => p.status === "verified")
        ? "converged"
        : "failed";
    }
  } catch (error) {
    session.status = "failed";
    session.findings.push({
      agentRole: "analyst",
      iteration: session.iteration,
      category: "gap",
      content: `Orchestration error: ${error instanceof Error ? error.message : String(error)}`,
      confidence: 1.0,
      timestamp: Date.now(),
    });
  }

  session.updatedAt = Date.now();
  return session;
}

interface AgentResult {
  rawOutput: string;
  findings: Finding[];
  proofAttempts: ProofAttempt[];
}

async function runAgent(
  role: AgentRole,
  problem: Problem,
  session: SessionState,
  llm: LLMProvider,
): Promise<AgentResult> {
  const systemPrompt = getSystemPrompt(role);
  const userPrompt = getUserPrompt(role, problem, session);

  const response = await llm.complete({
    temperature: role === "constructor" ? 0.3 : 0.1,
    maxTokens: 2500,
    systemPrompt,
    userPrompt,
  });

  const findings = parseFindings(response, role, session.iteration);
  const proofAttempts = role === "constructor" ? parseProofAttempts(response, session) : [];

  return { rawOutput: response, findings, proofAttempts };
}

function parseFindings(response: string, role: AgentRole, iteration: number): Finding[] {
  const findingsMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!findingsMatch) {
    return [
      {
        agentRole: role,
        iteration,
        category: "insight",
        content: response.slice(0, 500),
        confidence: 0.3,
        timestamp: Date.now(),
      },
    ];
  }

  try {
    const jsonStr = findingsMatch[1];
    if (!jsonStr)
      return [
        {
          agentRole: role,
          iteration,
          category: "insight",
          content: response.slice(0, 500),
          confidence: 0.3,
          timestamp: Date.now(),
        },
      ];
    const parsed: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return [
        {
          agentRole: role,
          iteration,
          category: "insight",
          content: response.slice(0, 500),
          confidence: 0.3,
          timestamp: Date.now(),
        },
      ];
    }
    return parsed.map((f: Record<string, unknown>) => ({
      agentRole: role,
      iteration,
      category: String(f.category ?? "insight") as Finding["category"],
      content: String(f.content ?? ""),
      confidence: Number(f.confidence ?? 0.5),
      timestamp: Date.now(),
    }));
  } catch {
    return [
      {
        agentRole: role,
        iteration,
        category: "insight",
        content: response.slice(0, 500),
        confidence: 0.3,
        timestamp: Date.now(),
      },
    ];
  }
}

function parseProofAttempts(response: string, session: SessionState): ProofAttempt[] {
  // Look for the second JSON block (first is findings, second is proof attempts)
  const jsonBlocks = [...response.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (jsonBlocks.length < 2) return [];

  try {
    const block = jsonBlocks[1];
    if (!block?.[1]) return [];
    const parsed: unknown = JSON.parse(block[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: Record<string, unknown>, i: number) => ({
      id: `proof-${session.sessionId}-${session.iteration}-${i}`,
      problemId: session.problemId,
      agentRole: "constructor" as const,
      iteration: session.iteration,
      method: String(p.method ?? "unknown"),
      steps: Array.isArray(p.steps) ? p.steps.map(String) : [],
      status: String(p.status ?? "pending") as ProofAttempt["status"],
    }));
  } catch {
    return [];
  }
}
