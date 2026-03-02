import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  routeReview: {
    create: vi.fn(),
  },
  agentReviewerElo: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

const mockCallClaude = vi.hoisted(() => vi.fn());
const mockSelectByElo = vi.hoisted(() => vi.fn());
const mockGetOrCreateAgentElo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/create/agent-client", () => ({
  callClaude: mockCallClaude,
}));
vi.mock("./elo-tracker", () => ({
  selectByElo: mockSelectByElo,
  getOrCreateAgentElo: mockGetOrCreateAgentElo,
}));

import { reviewCode, reviewPlan, runReviewConsensus, selectReviewers } from "./reviewer";

describe("reviewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("selectReviewers", () => {
    it("returns agent identities from ELO selection", async () => {
      mockSelectByElo.mockResolvedValue([
        { agentId: "r-01", agentModel: "haiku", elo: 1200 },
        { agentId: "r-02", agentModel: "haiku", elo: 1250 },
      ]);

      const reviewers = await selectReviewers(2);
      expect(reviewers).toHaveLength(2);
      expect(reviewers[0]!.agentId).toBe("r-01");
      expect(reviewers[1]!.elo).toBe(1250);
    });
  });

  describe("reviewPlan", () => {
    const reviewer = {
      agentId: "r-01",
      model: "haiku",
      systemPrompt: "test",
      elo: 1200,
    };

    it("parses APPROVED response", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"decision": "APPROVED", "feedback": "Looks good", "score": 0.9}',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        truncated: false,
      });
      mockGetOrCreateAgentElo.mockResolvedValue({ elo: 1200 });
      mockPrisma.routeReview.create.mockResolvedValue({
        eloAtReview: 1200,
      });

      const result = await reviewPlan({ slug: "test" }, reviewer);
      expect(result.decision).toBe("APPROVED");
      expect(result.feedback).toBe("Looks good");
      expect(result.score).toBe(0.9);
    });

    it("parses REJECTED response", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"decision": "REJECTED", "feedback": "Too vague", "score": 0.3}',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        truncated: false,
      });
      mockGetOrCreateAgentElo.mockResolvedValue({ elo: 1200 });
      mockPrisma.routeReview.create.mockResolvedValue({
        eloAtReview: 1200,
      });

      const result = await reviewPlan({ slug: "test" }, reviewer);
      expect(result.decision).toBe("REJECTED");
    });

    it("auto-approves on API failure", async () => {
      mockCallClaude.mockRejectedValue(new Error("API error"));

      const result = await reviewPlan({ slug: "test" }, reviewer);
      expect(result.decision).toBe("APPROVED");
      expect(result.feedback).toContain("failed");
    });
  });

  describe("reviewCode", () => {
    const reviewer = {
      agentId: "r-01",
      model: "haiku",
      systemPrompt: "test",
      elo: 1200,
    };

    it("reviews code and returns decision", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"decision": "APPROVED", "feedback": "Clean code", "score": 0.85}',
        inputTokens: 200,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        truncated: false,
      });
      mockGetOrCreateAgentElo.mockResolvedValue({ elo: 1200 });
      mockPrisma.routeReview.create.mockResolvedValue({
        eloAtReview: 1200,
      });

      const result = await reviewCode(
        "export default function App() { return <div>Hello</div> }",
        reviewer,
        "route-1",
      );
      expect(result.decision).toBe("APPROVED");
      expect(result.phase).toBe("CODE_REVIEW");
    });
  });

  describe("runReviewConsensus", () => {
    it("returns approved=true when all approve", async () => {
      mockSelectByElo.mockResolvedValue([
        { agentId: "r-01", agentModel: "haiku", elo: 1200 },
        { agentId: "r-02", agentModel: "haiku", elo: 1200 },
      ]);

      const { results, approved } = await runReviewConsensus(async () => ({
        reviewerAgentId: "r-01",
        phase: "PLAN_REVIEW" as const,
        decision: "APPROVED" as const,
        feedback: "OK",
        score: 0.9,
        eloAtReview: 1200,
      }));

      expect(approved).toBe(true);
      expect(results).toHaveLength(2);
    });

    it("returns approved=false when any reject", async () => {
      mockSelectByElo.mockResolvedValue([
        { agentId: "r-01", agentModel: "haiku", elo: 1200 },
        { agentId: "r-02", agentModel: "haiku", elo: 1200 },
      ]);

      let callCount = 0;
      const { approved } = await runReviewConsensus(async () => {
        callCount++;
        return {
          reviewerAgentId: `r-0${callCount}`,
          phase: "PLAN_REVIEW" as const,
          decision: callCount === 1 ? ("APPROVED" as const) : ("REJECTED" as const),
          feedback: callCount === 1 ? "OK" : "Bad",
          score: callCount === 1 ? 0.9 : 0.2,
          eloAtReview: 1200,
        };
      });

      expect(approved).toBe(false);
    });
  });
});
