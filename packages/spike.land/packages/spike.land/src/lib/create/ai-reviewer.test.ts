import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAiReview } from "./ai-reviewer";

vi.mock("@/lib/create/agent-client", () => ({
  callClaude: vi.fn(),
}));

vi.mock("@/lib/generate/elo-tracker", () => ({
  selectByElo: vi.fn(),
  getOrCreateAgentElo: vi.fn(),
}));

vi.mock("@/lib/codespace/session-service", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    appReview: { create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { callClaude } = await import("@/lib/create/agent-client");
const { selectByElo, getOrCreateAgentElo } = await import(
  "@/lib/generate/elo-tracker"
);
const { getSession } = await import("@/lib/codespace/session-service");

const mockCallClaude = vi.mocked(callClaude);
const mockSelectByElo = vi.mocked(selectByElo);
const mockGetOrCreateAgentElo = vi.mocked(getOrCreateAgentElo);
const mockGetSession = vi.mocked(getSession);

beforeEach(() => {
  vi.clearAllMocks();

  mockSelectByElo.mockResolvedValue([
    {
      id: "1",
      agentId: "reviewer-1",
      agentModel: "haiku",
      elo: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestElo: 1200,
    },
    {
      id: "2",
      agentId: "reviewer-2",
      agentModel: "haiku",
      elo: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestElo: 1200,
    },
  ] as Awaited<ReturnType<typeof selectByElo>>);

  mockGetOrCreateAgentElo.mockResolvedValue({
    id: "1",
    agentId: "reviewer-1",
    agentModel: "haiku",
    elo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestElo: 1200,
  } as Awaited<ReturnType<typeof getOrCreateAgentElo>>);
});

describe("runAiReview", () => {
  const sampleCode = `
    import React from 'react';
    export default function App() {
      return <div className="p-4"><h1>Hello</h1></div>;
    }
  `;

  it("approves when both reviewers approve", async () => {
    mockCallClaude.mockResolvedValue({
      text: JSON.stringify({
        decision: "APPROVED",
        feedback: "Good code",
        score: 0.85,
      }),
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      truncated: false,
    } as Awaited<ReturnType<typeof callClaude>>);

    const result = await runAiReview("app-123", "codespace-1", sampleCode);

    expect(result.passed).toBe(true);
    expect(result.reviews).toHaveLength(2);
    expect(result.averageScore).toBe(0.85);
  });

  it("rejects when any reviewer rejects", async () => {
    mockCallClaude
      .mockResolvedValueOnce({
        text: JSON.stringify({
          decision: "APPROVED",
          feedback: "Looks good",
          score: 0.8,
        }),
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        truncated: false,
      } as Awaited<ReturnType<typeof callClaude>>)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          decision: "REJECTED",
          feedback: "Missing a11y",
          score: 0.3,
        }),
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        truncated: false,
      } as Awaited<ReturnType<typeof callClaude>>);

    const result = await runAiReview("app-123", "codespace-1", sampleCode);

    expect(result.passed).toBe(false);
    expect(result.averageScore).toBeCloseTo(0.55, 5);
  });

  it("returns failure when no code available", async () => {
    mockGetSession.mockResolvedValue(
      null as Awaited<ReturnType<typeof getSession>>,
    );

    const result = await runAiReview("app-123", "codespace-1");

    expect(result.passed).toBe(false);
    expect(result.feedback).toContain("No source code");
  });

  it("auto-approves on review failure", async () => {
    mockCallClaude.mockRejectedValue(new Error("API error"));

    const result = await runAiReview("app-123", "codespace-1", sampleCode);

    // Both reviewers fail, both auto-approve
    expect(result.passed).toBe(true);
    expect(
      result.reviews.every(r => r.feedback === "Review failed, auto-approved"),
    ).toBe(true);
  });

  it("calls Claude with sonnet model", async () => {
    mockCallClaude.mockResolvedValue({
      text: JSON.stringify({
        decision: "APPROVED",
        feedback: "Good code",
        score: 0.85,
      }),
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      truncated: false,
    } as Awaited<ReturnType<typeof callClaude>>);

    await runAiReview("app-123", "codespace-1", sampleCode);

    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "sonnet",
      }),
    );
  });

  it("fetches code from session when not provided", async () => {
    mockGetSession.mockResolvedValue({
      code: sampleCode,
      transpiled: "transpiled",
      html: "",
      css: "",
    } as Awaited<ReturnType<typeof getSession>>);

    mockCallClaude.mockResolvedValue({
      text: JSON.stringify({
        decision: "APPROVED",
        feedback: "OK",
        score: 0.9,
      }),
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      truncated: false,
    } as Awaited<ReturnType<typeof callClaude>>);

    const result = await runAiReview("app-123", "codespace-1");

    expect(result.passed).toBe(true);
    expect(mockGetSession).toHaveBeenCalledWith("codespace-1");
  });
});
