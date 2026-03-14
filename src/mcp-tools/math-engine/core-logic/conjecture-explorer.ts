/**
 * Math Engine — Conjecture Explorer
 *
 * AI-assisted exploration of Erdos conjectures and open problems.
 */

import type { Finding, LLMProvider, Problem, SessionState } from "./types.js";

interface ExplorationStrategy {
  name: string;
  description: string;
  applicableTo: string[];
}

const STRATEGIES: ExplorationStrategy[] = [
  {
    name: "Parametric Family Search",
    description: "Search for parametric families of solutions that cover special cases",
    applicableTo: ["erdos-straus", "erdos-ginzburg-ziv"],
  },
  {
    name: "Modular Arithmetic",
    description: "Analyze the problem modulo small primes and residue classes",
    applicableTo: ["erdos-straus", "covering-systems"],
  },
  {
    name: "Algebraic Geometry",
    description: "Translate to algebraic curves/varieties and use intersection theory",
    applicableTo: ["unit-distance", "erdos-straus"],
  },
  {
    name: "Probabilistic Method",
    description: "Use random constructions to prove existence bounds",
    applicableTo: ["covering-systems", "erdos-ginzburg-ziv", "unit-distance"],
  },
  {
    name: "Computational Verification",
    description: "Verify conjecture for specific cases and look for patterns",
    applicableTo: ["erdos-straus", "erdos-ginzburg-ziv", "covering-systems", "unit-distance"],
  },
];

export function getApplicableStrategies(problemId: string): ExplorationStrategy[] {
  return STRATEGIES.filter((s) => s.applicableTo.includes(problemId));
}

export async function exploreConjecture(
  problem: Problem,
  session: SessionState,
  llm: LLMProvider,
): Promise<Finding[]> {
  const strategies = getApplicableStrategies(problem.id);
  const findings: Finding[] = [];

  for (const strategy of strategies) {
    const response = await llm.complete({
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: `You are a research mathematician exploring open conjectures.
Use the ${strategy.name} approach to make progress on the given conjecture.
Be creative but mathematically rigorous. Identify partial results, patterns, and new angles of attack.`,
      userPrompt: `## Conjecture: ${problem.title}

${problem.description}

## Strategy: ${strategy.name}
${strategy.description}

## Prior findings from this session:
${session.findings.map((f) => `[${f.agentRole}|${f.category}] ${f.content}`).join("\n") || "None yet."}

Apply this strategy to the conjecture. Report:
1. Setup: How does this strategy apply?
2. Observations: What patterns emerge?
3. Partial results: Any provable special cases?
4. Obstacles: What blocks further progress?
5. New directions: What should be explored next?

Format key findings as JSON:
\`\`\`json
[
  {"category": "structure|proof_step|gap|insight", "content": "...", "confidence": 0.0-1.0}
]
\`\`\``,
    });

    const parsed = parseExplorationFindings(response, session.iteration, strategy.name);
    findings.push(...parsed);
  }

  return findings;
}

function parseExplorationFindings(
  response: string,
  iteration: number,
  strategyName: string,
): Finding[] {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    return [
      {
        agentRole: "constructor",
        iteration,
        category: "insight",
        content: `[${strategyName}] ${response.slice(0, 500)}`,
        confidence: 0.4,
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
      agentRole: "constructor" as const,
      iteration,
      category: (f.category ?? "insight") as Finding["category"],
      content: `[${strategyName}] ${String(f.content ?? "")}`,
      confidence: Number(f.confidence ?? 0.5),
      timestamp: Date.now(),
    }));
  } catch {
    return [
      {
        agentRole: "constructor",
        iteration,
        category: "insight",
        content: `[${strategyName}] ${response.slice(0, 500)}`,
        confidence: 0.4,
        timestamp: Date.now(),
      },
    ];
  }
}
