import { describe, expect, it, vi } from "vitest";
import { analyzeConvergence, getConvergenceStrategies } from "../core-logic/convergence-prover.js";
import { createSessionState } from "../core-logic/types.js";
import { getProblemById } from "../core-logic/problem-registry.js";
import type { LLMProvider } from "../core-logic/types.js";

describe("convergence-prover", () => {
  it("should list 3 convergence strategies", () => {
    const strategies = getConvergenceStrategies();
    expect(strategies).toHaveLength(3);
    expect(strategies.map((s) => s.name)).toContain("Contraction Mapping");
    expect(strategies.map((s) => s.name)).toContain("Jacobian Spectral Radius");
    expect(strategies.map((s) => s.name)).toContain("Lyapunov Function");
  });

  it("should produce findings for each strategy", async () => {
    const llm: LLMProvider = {
      complete: vi.fn().mockResolvedValue(`Analysis result:
\`\`\`json
[{"category": "proof_step", "content": "Contraction exists with k=0.7", "confidence": 0.8}]
\`\`\``),
    };

    const problem = getProblemById("convergence")!;
    const session = createSessionState("test-session", "convergence", 5);

    const findings = await analyzeConvergence(problem, session, llm);

    expect(findings.length).toBeGreaterThanOrEqual(3); // One per strategy
    expect(llm.complete).toHaveBeenCalledTimes(3);
  });

  it("should handle LLM errors gracefully", async () => {
    const llm: LLMProvider = {
      complete: vi.fn().mockResolvedValue("No JSON output here, just text analysis."),
    };

    const problem = getProblemById("convergence")!;
    const session = createSessionState("test-session", "convergence", 5);

    const findings = await analyzeConvergence(problem, session, llm);

    expect(findings.length).toBeGreaterThanOrEqual(3);
    expect(findings.every((f) => f.category === "insight")).toBe(true);
    expect(findings.every((f) => f.confidence === 0.3)).toBe(true);
  });
});
