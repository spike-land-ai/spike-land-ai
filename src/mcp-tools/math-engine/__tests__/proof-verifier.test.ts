import { describe, expect, it, vi } from "vitest";
import { verifyProof, verificationToFindings } from "../core-logic/proof-verifier.js";
import type { LLMProvider, ProofAttempt } from "../core-logic/types.js";

function createMockLLM(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
  };
}

const sampleProof: ProofAttempt = {
  id: "test-proof-1",
  problemId: "convergence",
  agentRole: "constructor",
  iteration: 1,
  method: "Contraction Mapping",
  steps: [
    "Define metric space (X, d) where X is the set of system states",
    "Show T = U ∘ V ∘ D is a self-map on X",
    "Compute Lipschitz constant: Lip(T) ≤ Lip(U) · Lip(V) · Lip(D)",
    "Verify Lip(T) < 1 under given assumptions",
    "Apply Banach fixed-point theorem to conclude convergence",
  ],
  status: "pending",
};

describe("proof-verifier", () => {
  it("should verify a valid proof", async () => {
    const llm = createMockLLM(`Analysis of proof steps:
\`\`\`json
[
  {"step": 1, "status": "valid", "reason": "Standard metric space definition"},
  {"step": 2, "status": "valid", "reason": "Composition of continuous maps"},
  {"step": 3, "status": "valid", "reason": "Chain rule for Lipschitz constants"},
  {"step": 4, "status": "valid", "reason": "Follows from bounds on components"},
  {"step": 5, "status": "valid", "reason": "Correct application of Banach theorem"}
]
\`\`\``);

    const result = await verifyProof(sampleProof, llm);

    expect(result.overallStatus).toBe("verified");
    expect(result.stepResults).toHaveLength(5);
    expect(result.stepResults.every((s) => s.status === "valid")).toBe(true);
    expect(result.proofId).toBe("test-proof-1");
  });

  it("should detect invalid steps", async () => {
    const llm = createMockLLM(`\`\`\`json
[
  {"step": 1, "status": "valid", "reason": "OK"},
  {"step": 2, "status": "valid", "reason": "OK"},
  {"step": 3, "status": "valid", "reason": "OK"},
  {"step": 4, "status": "invalid", "reason": "Lipschitz constant not proven to be < 1"},
  {"step": 5, "status": "incomplete", "reason": "Depends on step 4"}
]
\`\`\``);

    const result = await verifyProof(sampleProof, llm);

    expect(result.overallStatus).toBe("refuted");
    expect(result.stepResults[3].status).toBe("invalid");
  });

  it("should handle unparseable LLM response", async () => {
    const llm = createMockLLM("I cannot analyze this proof.");
    const result = await verifyProof(sampleProof, llm);

    expect(result.overallStatus).toBe("incomplete");
    expect(result.stepResults).toHaveLength(5);
    expect(result.stepResults.every((s) => s.status === "incomplete")).toBe(true);
  });

  it("should convert verification to findings", () => {
    const findings = verificationToFindings(
      {
        proofId: "test-1",
        overallStatus: "refuted",
        stepResults: [
          { step: 1, status: "valid", reason: "OK" },
          { step: 2, status: "invalid", reason: "Circular reasoning" },
        ],
        summary: "Proof refuted: 1 valid, 1 invalid, 0 incomplete steps out of 2 total.",
      },
      3,
    );

    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings[0].category).toBe("gap");
    expect(findings[1].category).toBe("counterexample");
    expect(findings[1].content).toContain("Circular reasoning");
  });
});
