/**
 * Math Engine — Proof Verifier
 *
 * Structural validation of proof attempts using LLM-based step checking.
 */

import type { Finding, LLMProvider, ProofAttempt } from "./types.js";
import { getVerificationPrompt } from "./prompt-templates.js";

interface StepVerification {
  step: number;
  status: "valid" | "invalid" | "incomplete";
  reason: string;
}

interface VerificationResult {
  proofId: string;
  overallStatus: "verified" | "refuted" | "incomplete";
  stepResults: StepVerification[];
  summary: string;
}

export async function verifyProof(
  proof: ProofAttempt,
  llm: LLMProvider,
): Promise<VerificationResult> {
  const prompt = getVerificationPrompt(proof.steps);

  const response = await llm.complete({
    temperature: 0.0,
    maxTokens: 2000,
    systemPrompt: `You are a rigorous mathematical proof verifier. Check each step for logical validity.
Only mark a step as "valid" if it strictly follows from previous steps and known theorems.
Be especially vigilant for: hidden assumptions, scope errors, circular reasoning, and Curry patterns.`,
    userPrompt: prompt,
  });

  const stepResults = parseStepResults(response, proof.steps.length);
  const overallStatus = determineOverallStatus(stepResults);

  return {
    proofId: proof.id,
    overallStatus,
    stepResults,
    summary: generateSummary(stepResults, overallStatus),
  };
}

function parseStepResults(response: string, expectedSteps: number): StepVerification[] {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1];
      if (!jsonStr) throw new Error("empty");
      const parsed = JSON.parse(jsonStr) as StepVerification[];
      if (Array.isArray(parsed)) {
        return parsed.map((s, i) => ({
          step: s.step ?? i + 1,
          status: s.status ?? "incomplete",
          reason: String(s.reason ?? "No reason provided"),
        }));
      }
    } catch {
      // fall through
    }
  }

  // Fallback: mark all steps as incomplete
  return Array.from({ length: expectedSteps }, (_, i) => ({
    step: i + 1,
    status: "incomplete" as const,
    reason: "Could not verify — LLM response parsing failed",
  }));
}

function determineOverallStatus(steps: StepVerification[]): "verified" | "refuted" | "incomplete" {
  if (steps.some((s) => s.status === "invalid")) return "refuted";
  if (steps.every((s) => s.status === "valid")) return "verified";
  return "incomplete";
}

function generateSummary(steps: StepVerification[], status: string): string {
  const valid = steps.filter((s) => s.status === "valid").length;
  const invalid = steps.filter((s) => s.status === "invalid").length;
  const incomplete = steps.filter((s) => s.status === "incomplete").length;
  return `Proof ${status}: ${valid} valid, ${invalid} invalid, ${incomplete} incomplete steps out of ${steps.length} total.`;
}

export function verificationToFindings(result: VerificationResult, iteration: number): Finding[] {
  const findings: Finding[] = [];

  findings.push({
    agentRole: "analyst",
    iteration,
    category: result.overallStatus === "verified" ? "proof_step" : "gap",
    content: result.summary,
    confidence: result.overallStatus === "verified" ? 0.9 : 0.7,
    timestamp: Date.now(),
  });

  for (const step of result.stepResults) {
    if (step.status === "invalid") {
      findings.push({
        agentRole: "adversary",
        iteration,
        category: "counterexample",
        content: `Step ${step.step} invalid: ${step.reason}`,
        confidence: 0.85,
        timestamp: Date.now(),
      });
    }
  }

  return findings;
}

export { type StepVerification, type VerificationResult };
