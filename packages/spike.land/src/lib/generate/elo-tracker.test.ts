import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  agentReviewerElo: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  routeReview: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

// Mock the elo module's calculateEloChange
vi.mock("@/lib/arena/elo", () => ({
  calculateEloChange: vi.fn((playerElo: number, opponentElo: number, won: number) => {
    // Simplified ELO for testing
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    return Math.round(32 * (won - expected));
  }),
  expectedScore: vi.fn(),
}));

import { getOrCreateAgentElo, selectByElo, settleReviewElo } from "./elo-tracker";

describe("elo-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateAgentElo", () => {
    it("creates a new agent with default ELO", async () => {
      const agent = {
        id: "1",
        agentId: "test-agent",
        elo: 1200,
        bestElo: 1200,
        agentModel: "haiku",
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        totalReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.agentReviewerElo.upsert.mockResolvedValue(agent);

      const result = await getOrCreateAgentElo("test-agent");
      expect(result.elo).toBe(1200);
      expect(mockPrisma.agentReviewerElo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agentId: "test-agent" },
          create: expect.objectContaining({
            agentId: "test-agent",
            elo: 1200,
          }),
        }),
      );
    });
  });

  describe("selectByElo", () => {
    it("seeds default agents when none exist", async () => {
      mockPrisma.agentReviewerElo.findMany.mockResolvedValue([]);
      mockPrisma.agentReviewerElo.upsert.mockImplementation(
        ({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({
            ...create,
            id: "x",
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            totalReviews: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      );

      const result = await selectByElo(2);
      expect(result).toHaveLength(2);
    });

    it("returns all agents when count >= available", async () => {
      const agents = [
        {
          id: "1",
          agentId: "a1",
          elo: 1200,
          agentModel: "haiku",
          wins: 0,
          losses: 0,
          draws: 0,
          streak: 0,
          bestElo: 1200,
          totalReviews: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          agentId: "a2",
          elo: 1300,
          agentModel: "haiku",
          wins: 0,
          losses: 0,
          draws: 0,
          streak: 0,
          bestElo: 1300,
          totalReviews: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrisma.agentReviewerElo.findMany.mockResolvedValue(agents);

      const result = await selectByElo(3);
      expect(result).toHaveLength(2);
    });

    it("uses softmax selection for more agents than needed", async () => {
      const agents = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        agentId: `a${i}`,
        elo: 1200 + i * 100,
        agentModel: "haiku",
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        bestElo: 1200 + i * 100,
        totalReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      mockPrisma.agentReviewerElo.findMany.mockResolvedValue(agents);

      const result = await selectByElo(2);
      expect(result).toHaveLength(2);
      // Each selected agent should be unique
      const ids = result.map((a) => a.agentId);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe("settleReviewElo", () => {
    it("gives +win for APPROVED review when transpile succeeded", async () => {
      mockPrisma.routeReview.findUniqueOrThrow.mockResolvedValue({
        id: "r1",
        reviewerAgentId: "agent-1",
        decision: "APPROVED",
        eloSettled: false,
        eloAtReview: 1200,
      });
      mockPrisma.agentReviewerElo.upsert.mockResolvedValue({
        id: "1",
        agentId: "agent-1",
        elo: 1200,
        bestElo: 1200,
        agentModel: "haiku",
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        totalReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await settleReviewElo("r1", true);
      expect(result.eloChange).toBeGreaterThan(0);
    });

    it("gives +loss for APPROVED review when transpile failed", async () => {
      mockPrisma.routeReview.findUniqueOrThrow.mockResolvedValue({
        id: "r1",
        reviewerAgentId: "agent-1",
        decision: "APPROVED",
        eloSettled: false,
        eloAtReview: 1200,
      });
      mockPrisma.agentReviewerElo.upsert.mockResolvedValue({
        id: "1",
        agentId: "agent-1",
        elo: 1200,
        bestElo: 1200,
        agentModel: "haiku",
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        totalReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await settleReviewElo("r1", false);
      expect(result.eloChange).toBeLessThan(0);
    });

    it("skips settlement if already settled", async () => {
      mockPrisma.routeReview.findUniqueOrThrow.mockResolvedValue({
        id: "r1",
        reviewerAgentId: "agent-1",
        decision: "APPROVED",
        eloSettled: true,
        eloChange: 16,
        eloAtReview: 1200,
      });

      const result = await settleReviewElo("r1", true);
      expect(result.eloChange).toBe(16);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
