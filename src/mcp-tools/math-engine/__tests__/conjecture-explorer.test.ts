import { describe, expect, it, vi } from "vitest";
import { exploreConjecture, getApplicableStrategies } from "../core-logic/conjecture-explorer.js";
import { createSessionState } from "../core-logic/types.js";
import { getProblemById } from "../core-logic/problem-registry.js";
import type { LLMProvider } from "../core-logic/types.js";

describe("conjecture-explorer", () => {
  it("should return applicable strategies for erdos-straus", () => {
    const strategies = getApplicableStrategies("erdos-straus");
    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies.map((s) => s.name)).toContain("Parametric Family Search");
    expect(strategies.map((s) => s.name)).toContain("Modular Arithmetic");
  });

  it("should return applicable strategies for unit-distance", () => {
    const strategies = getApplicableStrategies("unit-distance");
    expect(strategies.length).toBeGreaterThan(0);
    expect(strategies.map((s) => s.name)).toContain("Algebraic Geometry");
  });

  it("should produce findings from exploration", async () => {
    const llm: LLMProvider = {
      complete: vi.fn().mockResolvedValue(`Exploration result:
\`\`\`json
[
  {"category": "insight", "content": "For n ≡ 0 (mod 4), decomposition is trivial", "confidence": 0.95},
  {"category": "proof_step", "content": "Parametric family covers 60% of residue classes", "confidence": 0.7}
]
\`\`\``),
    };

    const problem = getProblemById("erdos-straus")!;
    const session = createSessionState("test-explore", "erdos-straus", 3);

    const findings = await exploreConjecture(problem, session, llm);

    expect(findings.length).toBeGreaterThan(0);
    // Each strategy should produce findings
    const strategies = getApplicableStrategies("erdos-straus");
    expect(llm.complete).toHaveBeenCalledTimes(strategies.length);
  });

  it("should handle non-JSON LLM response", async () => {
    const llm: LLMProvider = {
      complete: vi.fn().mockResolvedValue("Interesting conjecture, but no structured output."),
    };

    const problem = getProblemById("erdos-straus")!;
    const session = createSessionState("test-explore", "erdos-straus", 3);

    const findings = await exploreConjecture(problem, session, llm);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.confidence === 0.4)).toBe(true);
  });
});
