import { describe, expect, it, vi } from "vitest";
import { runMultiAgentSolve, getSession, listSessions } from "../core-logic/agent-orchestrator.js";
import type { LLMProvider } from "../core-logic/types.js";

function createMockLLM(): LLMProvider {
  let callCount = 0;
  return {
    complete: vi.fn().mockImplementation(async () => {
      callCount++;
      // Alternate between findings and verification responses
      if (callCount % 4 === 0) {
        // Verification response
        return `\`\`\`json
[
  {"step": 1, "status": "valid", "reason": "OK"},
  {"step": 2, "status": "incomplete", "reason": "Needs more detail"}
]
\`\`\``;
      }
      // Agent response with findings
      return `Here is my analysis:
\`\`\`json
[
  {"category": "insight", "content": "Observation from iteration", "confidence": 0.6}
]
\`\`\``;
    }),
  };
}

describe("agent-orchestrator", () => {
  it("should run multi-agent solve and return session", async () => {
    const llm = createMockLLM();
    const session = await runMultiAgentSolve("convergence", 2, llm);

    expect(session.sessionId).toMatch(/^session-/);
    expect(session.problemId).toBe("convergence");
    expect(session.iteration).toBeGreaterThanOrEqual(1);
    expect(session.findings.length).toBeGreaterThan(0);
    expect(["running", "converged", "blocked", "failed"]).toContain(session.status);
  });

  it("should throw for unknown problem", async () => {
    const llm = createMockLLM();
    await expect(runMultiAgentSolve("nonexistent", 2, llm)).rejects.toThrow("Problem not found");
  });

  it("should store session for later retrieval", async () => {
    const llm = createMockLLM();
    const session = await runMultiAgentSolve("convergence", 1, llm);

    const retrieved = getSession(session.sessionId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe(session.sessionId);
  });

  it("should list all sessions", async () => {
    const sessions = listSessions();
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("should run all 3 agents per iteration", async () => {
    const llm = createMockLLM();
    const session = await runMultiAgentSolve("uncomputability", 1, llm);

    // 3 agents per iteration + verification calls
    expect((llm.complete as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(session.findings.length).toBeGreaterThanOrEqual(3);
  });
});
