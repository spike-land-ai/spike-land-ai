/**
 * Math Engine — Curry Resolver (Gap 3)
 *
 * Detects and resolves Curry's paradox in self-referential proof attempts.
 * Injects grounding constraints, distinguishes natural vs injected fixed points.
 */

import type { Finding, LLMProvider, ProofAttempt, SessionState } from "./types.js";

interface CurryDetectionResult {
  hasCurryPattern: boolean;
  selfReferentialSteps: number[];
  severity: "none" | "mild" | "critical";
  explanation: string;
  groundingFix?: string | undefined;
}

const CURRY_DETECTION_PROMPT = `You are a logic expert detecting Curry's paradox patterns.

Curry's paradox: Given a self-referential sentence C = "If C is true, then P",
we can prove any proposition P:
1. Assume C is true
2. Then "If C is true, then P" is true (by definition of C)
3. C is true (assumption) and C → P, so P follows by modus ponens
4. We proved: if C is true, then P
5. But that's exactly what C says, so C is true
6. Therefore P

In proof attempts, Curry patterns appear as:
- Self-validating claims: "This system proves its own correctness"
- Circular justification: step N references step N's conclusion
- Bootstrapped truth: assuming the conclusion to derive the conclusion
- Value self-assertion: V(x) is defined in terms of V(x) being valid

Your job: detect these patterns and propose grounding constraints.`;

export async function detectCurryPatterns(
  proofAttempt: ProofAttempt,
  _session: SessionState,
  llm: LLMProvider,
): Promise<CurryDetectionResult> {
  const response = await llm.complete({
    temperature: 0.1,
    maxTokens: 1500,
    systemPrompt: CURRY_DETECTION_PROMPT,
    userPrompt: `Analyze this proof attempt for Curry's paradox patterns:

Method: ${proofAttempt.method}
Steps:
${proofAttempt.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Check for:
1. Self-referential steps (does any step reference its own truth/validity?)
2. Circular justification chains
3. Bootstrapped conclusions
4. Self-validating value assertions

Format as JSON:
\`\`\`json
{
  "hasCurryPattern": true/false,
  "selfReferentialSteps": [step numbers],
  "severity": "none|mild|critical",
  "explanation": "...",
  "groundingFix": "proposed fix (if pattern found)"
}
\`\`\``,
  });

  return parseCurryResult(response);
}

function parseCurryResult(response: string): CurryDetectionResult {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1];
      if (!jsonStr) throw new Error("empty");
      const parsed = JSON.parse(jsonStr) as CurryDetectionResult;
      return {
        hasCurryPattern: Boolean(parsed.hasCurryPattern),
        selfReferentialSteps: Array.isArray(parsed.selfReferentialSteps)
          ? parsed.selfReferentialSteps
          : [],
        severity: parsed.severity ?? "none",
        explanation: String(parsed.explanation ?? ""),
        groundingFix: parsed.groundingFix ? String(parsed.groundingFix) : undefined,
      };
    } catch {
      // fall through
    }
  }

  return {
    hasCurryPattern: false,
    selfReferentialSteps: [],
    severity: "none",
    explanation: "Could not parse LLM response for Curry detection.",
  };
}

export async function resolveGap(session: SessionState, llm: LLMProvider): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check all proof attempts for Curry patterns
  for (const attempt of session.proofAttempts) {
    const result = await detectCurryPatterns(attempt, session, llm);

    if (result.hasCurryPattern) {
      findings.push({
        agentRole: "adversary",
        iteration: session.iteration,
        category: "counterexample",
        content: `Curry pattern detected in proof "${attempt.method}" (severity: ${result.severity}). Steps ${result.selfReferentialSteps.join(", ")} are self-referential. ${result.explanation}`,
        confidence: result.severity === "critical" ? 0.95 : 0.7,
        timestamp: Date.now(),
      });

      if (result.groundingFix) {
        findings.push({
          agentRole: "adversary",
          iteration: session.iteration,
          category: "insight",
          content: `Grounding fix for Curry pattern: ${result.groundingFix}`,
          confidence: 0.6,
          timestamp: Date.now(),
        });
      }
    }
  }

  // General grounding analysis
  const groundingResponse = await llm.complete({
    temperature: 0.2,
    maxTokens: 1500,
    systemPrompt: CURRY_DETECTION_PROMPT,
    userPrompt: `For the self-referential system under analysis, propose grounding constraints that prevent Curry's paradox:

Current findings:
${session.findings.map((f) => `[${f.agentRole}|${f.category}] ${f.content}`).join("\n")}

Propose:
1. External observable constraints (things that must be checked against reality, not self-assertion)
2. Type-theoretic restrictions (stratification that prevents self-reference)
3. How to distinguish natural fixed points (arising from dynamics) vs injected ones (arbitrary)

Format findings as JSON array:
\`\`\`json
[{"category": "structure|insight", "content": "...", "confidence": 0.0-1.0}]
\`\`\``,
  });

  const parsed = parseGroundingFindings(groundingResponse, session.iteration);
  findings.push(...parsed);

  return findings;
}

function parseGroundingFindings(response: string, iteration: number): Finding[] {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    return [
      {
        agentRole: "adversary",
        iteration,
        category: "insight",
        content: response.slice(0, 500),
        confidence: 0.3,
        timestamp: Date.now(),
      },
    ];
  }

  try {
    const jsonStr = jsonMatch[1];
    if (!jsonStr) throw new Error("empty");
    const parsed = JSON.parse(jsonStr) as Array<{
      category?: string;
      content?: string;
      confidence?: number;
    }>;
    return parsed.map((f) => ({
      agentRole: "adversary" as const,
      iteration,
      category: (f.category ?? "insight") as Finding["category"],
      content: String(f.content ?? ""),
      confidence: Number(f.confidence ?? 0.5),
      timestamp: Date.now(),
    }));
  } catch {
    return [
      {
        agentRole: "adversary",
        iteration,
        category: "insight",
        content: response.slice(0, 500),
        confidence: 0.3,
        timestamp: Date.now(),
      },
    ];
  }
}

export { type CurryDetectionResult };
