/**
 * Math Engine — Convergence Prover (Gap 1)
 *
 * Addresses the convergence proof gap: S_{t+1} = U(S_t, V(D(S_t)))
 * Strategies: contraction mapping, Jacobian spectral radius, Lyapunov functions.
 */

import type { Finding, LLMProvider, Problem, SessionState } from "./types.js";

const CONVERGENCE_STRATEGIES = [
  {
    name: "Contraction Mapping",
    description: `Attempt to show the composed operator T = U ∘ V ∘ D is a contraction
on a complete metric space (X, d). Need: d(T(x), T(y)) ≤ k·d(x,y) for some k < 1.
Check: Lipschitz constants of each component compose multiplicatively.`,
    systemPrompt: `You are analyzing a self-referential system S_{t+1} = U(S_t, V(D(S_t)))
for contraction mapping properties. Determine if the composed operator is a contraction.
Consider: What metric space? What are the Lipschitz constants? Does Banach fixed-point apply?`,
  },
  {
    name: "Jacobian Spectral Radius",
    description: `Compute the Jacobian J of the map T at candidate fixed points.
If spectral radius ρ(J) < 1, the fixed point is locally asymptotically stable.
Check: eigenvalue computation, Gershgorin circles, matrix norm bounds.`,
    systemPrompt: `Analyze the Jacobian matrix of the operator T = U ∘ V ∘ D at candidate fixed points.
Compute or bound the spectral radius. Use chain rule for composed maps.
Consider: Is the linearization valid? What about non-differentiable points?`,
  },
  {
    name: "Lyapunov Function",
    description: `Construct a Lyapunov function V(S) that is:
(a) positive definite, (b) strictly decreasing: V(T(S)) < V(S) for S ≠ S*,
(c) V(S*) = 0 at the fixed point. Common choices: quadratic, entropy-based.`,
    systemPrompt: `Construct a Lyapunov function for the dynamical system S_{t+1} = T(S_t).
The function must be positive definite and strictly decrease along trajectories.
Consider: quadratic forms, entropy/KL-divergence, energy functions.`,
  },
];

export function getConvergenceStrategies(): Array<{ name: string; description: string }> {
  return CONVERGENCE_STRATEGIES.map((s) => ({ name: s.name, description: s.description }));
}

export async function analyzeConvergence(
  problem: Problem,
  session: SessionState,
  llm: LLMProvider,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const strategy of CONVERGENCE_STRATEGIES) {
    const priorFindings = session.findings
      .filter((f) => f.category === "proof_step" || f.category === "counterexample")
      .map((f) => `[${f.agentRole}] ${f.content}`)
      .join("\n");

    const response = await llm.complete({
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: strategy.systemPrompt,
      userPrompt: `Problem: ${problem.description}

Strategy: ${strategy.name} — ${strategy.description}

Prior findings:
${priorFindings || "None yet."}

Analyze whether this convergence strategy can work. Provide:
1. The precise mathematical setup
2. Whether the conditions are met (with justification)
3. Any obstacles or counterexamples
4. Confidence level (0-1)

Format findings as JSON:
\`\`\`json
[{"category": "proof_step|counterexample|gap|insight", "content": "...", "confidence": 0.0-1.0}]
\`\`\``,
    });

    const parsed = parseFindings(response, "constructor", session.iteration);
    findings.push(...parsed);
  }

  return findings;
}

function parseFindings(
  response: string,
  role: "analyst" | "constructor" | "adversary",
  iteration: number,
): Finding[] {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
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
    const jsonStr = jsonMatch[1];
    if (!jsonStr) throw new Error("empty");
    const parsed = JSON.parse(jsonStr) as Array<{
      category?: string;
      content?: string;
      confidence?: number;
    }>;
    return parsed.map((f) => ({
      agentRole: role,
      iteration,
      category: (f.category ?? "insight") as Finding["category"],
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
