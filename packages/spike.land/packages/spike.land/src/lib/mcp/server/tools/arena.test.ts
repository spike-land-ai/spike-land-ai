import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  arenaChallenge: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  arenaSubmission: {
    create: vi.fn(),
  },
  arenaElo: {
    findMany: vi.fn(),
  },
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/arena/arena-generator", () => ({
  arenaGenerateFromPrompt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/arena/review", () => ({
  submitReview: vi.fn().mockResolvedValue({
    reviewId: "rev1",
    scoringTriggered: false,
  }),
}));

import { registerArenaTools } from "./arena";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

// Create a mock registry that captures tool registrations
function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();

  return {
    tools,
    register: vi.fn(
      (
        { name, handler, inputSchema }: {
          name: string;
          handler: (...args: unknown[]) => Promise<ToolResult>;
          inputSchema: Record<string, unknown>;
        },
      ) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

describe("Arena MCP Tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerArenaTools(
      registry as unknown as Parameters<typeof registerArenaTools>[0],
      "user123",
    );
  });

  it("registers 5 arena tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.tools.has("arena_list_challenges")).toBe(true);
    expect(registry.tools.has("arena_get_challenge_details")).toBe(true);
    expect(registry.tools.has("arena_submit_prompt")).toBe(true);
    expect(registry.tools.has("arena_review_submission")).toBe(true);
    expect(registry.tools.has("arena_get_leaderboard")).toBe(true);
  });

  describe("arena_list_challenges", () => {
    it("returns challenges list", async () => {
      mockPrisma.arenaChallenge.findMany.mockResolvedValue([
        {
          id: "ch1",
          title: "Counter App",
          description: "Build a counter",
          category: "basics",
          difficulty: "BEGINNER",
          _count: { submissions: 3 },
        },
      ] as never);

      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({ status: "OPEN", limit: 20 });

      expect(result.content[0]!.text).toContain("Counter App");
      expect(result.content[0]!.text).toContain("ch1");
    });

    it("returns empty message when no challenges", async () => {
      mockPrisma.arenaChallenge.findMany.mockResolvedValue([]);

      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({ status: "OPEN", limit: 20 });

      expect(result.content[0]!.text).toContain("No open challenges");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.arenaChallenge.findMany.mockRejectedValue(
        new Error("DB error"),
      );
      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({ status: "OPEN", limit: 20 });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error listing challenges");
    });

    it("should filter by category", async () => {
      mockPrisma.arenaChallenge.findMany.mockResolvedValue([]);
      const handler = registry.tools.get("arena_list_challenges")!.handler;
      await handler({ status: "OPEN", category: "basics", limit: 20 });
      expect(mockPrisma.arenaChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "OPEN", category: "basics" },
        }),
      );
    });

    it("should show category in empty message when category filter used", async () => {
      mockPrisma.arenaChallenge.findMany.mockResolvedValue([]);
      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({
        status: "OPEN",
        category: "advanced",
        limit: 20,
      });
      expect(result.content[0]!.text).toContain("in category \"advanced\"");
    });

    it("should handle non-Error thrown from database", async () => {
      mockPrisma.arenaChallenge.findMany.mockRejectedValue("string error");
      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({ status: "OPEN", limit: 20 });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Unknown error");
    });

    it("should truncate long descriptions", async () => {
      mockPrisma.arenaChallenge.findMany.mockResolvedValue([{
        id: "ch1",
        title: "Test",
        description: "A".repeat(250),
        category: "cat",
        difficulty: "EASY",
        _count: { submissions: 0 },
      }] as never);
      const handler = registry.tools.get("arena_list_challenges")!.handler;
      const result = await handler({ status: "OPEN", limit: 20 });
      expect(result.content[0]!.text).toContain("...");
    });
  });

  describe("arena_get_challenge_details", () => {
    it("returns challenge details with submissions", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        title: "Counter App",
        description: "Build a counter",
        category: "basics",
        difficulty: "BEGINNER",
        status: "OPEN",
        createdBy: { name: "Admin" },
        _count: { submissions: 1 },
        submissions: [
          {
            id: "sub1",
            status: "SCORED",
            codespaceUrl: "https://example.com",
            reviewScore: 0.85,
            eloChange: 12,
            iterations: 1,
            createdAt: new Date(),
            user: { name: "Player1" },
            _count: { reviews: 2 },
          },
        ],
      } as never);

      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });

      expect(result.content[0]!.text).toContain("Counter App");
      expect(result.content[0]!.text).toContain("Player1");
      expect(result.content[0]!.text).toContain("85%");
    });

    it("returns error for non-existent challenge", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue(null);

      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "nonexistent" });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("not found");
    });

    it("should handle database error", async () => {
      mockPrisma.arenaChallenge.findUnique.mockRejectedValue(
        new Error("DB error"),
      );
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error getting challenge");
    });

    it("should handle non-Error thrown from get_challenge_details", async () => {
      mockPrisma.arenaChallenge.findUnique.mockRejectedValue("string error");
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Unknown error");
    });

    it("should handle challenge with no submissions", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        title: "Empty",
        description: "desc",
        category: "cat",
        difficulty: "EASY",
        status: "OPEN",
        createdBy: { name: "Admin" },
        _count: { submissions: 0 },
        submissions: [],
      } as never);
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.content[0]!.text).toContain("Empty");
      expect(result.content[0]!.text).not.toContain("Top Submissions");
    });

    it("should show positive ELO change with + sign", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        title: "Test",
        description: "desc",
        category: "cat",
        difficulty: "EASY",
        status: "OPEN",
        createdBy: { name: "Admin" },
        _count: { submissions: 1 },
        submissions: [{
          id: "s1",
          status: "SCORED",
          codespaceUrl: null,
          reviewScore: 0.9,
          eloChange: 15,
          iterations: 1,
          createdAt: new Date(),
          user: { name: "Player" },
          _count: { reviews: 2 },
        }],
      } as never);
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.content[0]!.text).toContain("+15");
    });

    it("should show negative ELO change", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        title: "Test",
        description: "desc",
        category: "cat",
        difficulty: "EASY",
        status: "OPEN",
        createdBy: { name: "Admin" },
        _count: { submissions: 1 },
        submissions: [{
          id: "s1",
          status: "SCORED",
          codespaceUrl: null,
          reviewScore: 0.3,
          eloChange: -10,
          iterations: 1,
          createdAt: new Date(),
          user: { name: "Player" },
          _count: { reviews: 2 },
        }],
      } as never);
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.content[0]!.text).toContain("-10");
    });

    it("should handle submission with null reviewScore and eloChange", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        title: "Test",
        description: "desc",
        category: "cat",
        difficulty: "EASY",
        status: "OPEN",
        createdBy: { name: null },
        _count: { submissions: 1 },
        submissions: [{
          id: "s1",
          status: "PENDING",
          codespaceUrl: null,
          reviewScore: null,
          eloChange: null,
          iterations: 1,
          createdAt: new Date(),
          user: { name: null },
          _count: { reviews: 0 },
        }],
      } as never);
      const handler = registry.tools.get("arena_get_challenge_details")!.handler;
      const result = await handler({ challenge_id: "ch1" });
      expect(result.content[0]!.text).toContain("Unknown");
      expect(result.content[0]!.text).toContain("Anonymous");
      expect(result.content[0]!.text).toContain("Status: PENDING");
    });
  });

  describe("arena_submit_prompt", () => {
    it("creates submission and starts generation", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        status: "OPEN",
        title: "Counter App",
      } as never);

      mockPrisma.arenaSubmission.create.mockResolvedValue({
        id: "sub1",
      } as never);

      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "ch1",
        prompt: "Create a beautiful counter app with animations",
      });

      expect(result.content[0]!.text).toContain("Submission created");
      expect(result.content[0]!.text).toContain("sub1");
    });

    it("rejects submission to closed challenge", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue({
        id: "ch1",
        status: "CLOSED",
        title: "Old Challenge",
      } as never);

      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "ch1",
        prompt: "Create something cool",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("closed");
    });

    it("should handle submit error", async () => {
      mockPrisma.arenaChallenge.findUnique.mockRejectedValue(
        new Error("DB error"),
      );
      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "ch1",
        prompt: "Create something cool",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error submitting prompt");
    });

    it("should handle non-Error thrown from submit_prompt", async () => {
      mockPrisma.arenaChallenge.findUnique.mockRejectedValue("string error");
      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "ch1",
        prompt: "Create something cool",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Unknown error");
    });

    it("should return error for non-existent challenge when submitting", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue(null);
      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "nope",
        prompt: "Create something cool",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("not found");
    });

    it("should handle arenaGenerateFromPrompt async failure gracefully", async () => {
      const { arenaGenerateFromPrompt } = await import(
        "@/lib/arena/arena-generator"
      );
      (arenaGenerateFromPrompt as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("Generation failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(
        () => {},
      );

      mockPrisma.arenaChallenge.findUnique.mockResolvedValue(
        { id: "ch1", status: "OPEN", title: "Test" } as never,
      );
      mockPrisma.arenaSubmission.create.mockResolvedValue(
        { id: "sub-gen-fail" } as never,
      );

      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      const result = await handler({
        challenge_id: "ch1",
        prompt: "Create something cool",
      });
      expect(result.content[0]!.text).toContain("Submission created");

      // Wait for the async catch to fire
      await new Promise(r => setTimeout(r, 10));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Arena generation failed"),
      );
      consoleSpy.mockRestore();
    });

    it("should pass system_prompt to submission", async () => {
      mockPrisma.arenaChallenge.findUnique.mockResolvedValue(
        { id: "ch1", status: "OPEN", title: "Test" } as never,
      );
      mockPrisma.arenaSubmission.create.mockResolvedValue(
        { id: "sub-sys" } as never,
      );
      const handler = registry.tools.get("arena_submit_prompt")!.handler;
      await handler({
        challenge_id: "ch1",
        prompt: "Create something",
        system_prompt: "Be creative",
      });
      expect(mockPrisma.arenaSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ systemPrompt: "Be creative" }),
        }),
      );
    });
  });

  describe("arena_review_submission", () => {
    it("should submit review successfully without scoring triggered", async () => {
      const handler = registry.tools.get("arena_review_submission")!.handler;
      const result = await handler({
        submission_id: "sub1",
        bugs: [{ description: "Missing error handling", severity: "medium" }],
        score: 0.7,
        approved: false,
        comment: "Needs improvement",
      });
      expect(result.content[0]!.text).toContain("Review submitted");
      expect(result.content[0]!.text).toContain("70%");
      expect(result.content[0]!.text).toContain("No");
      expect(result.content[0]!.text).toContain("Bugs reported:**");
      expect(result.content[0]!.text).not.toContain("Scoring triggered");
    });

    it("should show scoring triggered message", async () => {
      const { submitReview } = await import("@/lib/arena/review");
      (submitReview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        reviewId: "rev2",
        scoringTriggered: true,
      });
      const handler = registry.tools.get("arena_review_submission")!.handler;
      const result = await handler({
        submission_id: "sub1",
        bugs: [],
        score: 0.9,
        approved: true,
        comment: "Great",
      });
      expect(result.content[0]!.text).toContain("Scoring triggered");
    });

    it("should handle review error", async () => {
      const { submitReview } = await import("@/lib/arena/review");
      (submitReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Review failed"),
      );
      const handler = registry.tools.get("arena_review_submission")!.handler;
      const result = await handler({
        submission_id: "sub1",
        bugs: [],
        score: 0.5,
        approved: false,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error submitting review");
    });

    it("should handle non-Error thrown from review_submission", async () => {
      const { submitReview } = await import("@/lib/arena/review");
      (submitReview as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        "string error",
      );
      const handler = registry.tools.get("arena_review_submission")!.handler;
      const result = await handler({
        submission_id: "sub1",
        bugs: [],
        score: 0.5,
        approved: false,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Unknown error");
    });
  });

  describe("arena_get_leaderboard", () => {
    it("returns formatted leaderboard", async () => {
      mockPrisma.arenaElo.findMany.mockResolvedValue([
        {
          userId: "u1",
          elo: 1450,
          wins: 10,
          losses: 3,
          draws: 1,
          streak: 5,
          bestElo: 1460,
          user: { name: "TopPlayer" },
        },
      ] as never);

      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });

      expect(result.content[0]!.text).toContain("TopPlayer");
      expect(result.content[0]!.text).toContain("1450");
      expect(result.content[0]!.text).toContain("10/3/1");
    });

    it("returns empty message when no entries", async () => {
      mockPrisma.arenaElo.findMany.mockResolvedValue([]);

      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });

      expect(result.content[0]!.text).toContain("No leaderboard entries");
    });

    it("should handle leaderboard error", async () => {
      mockPrisma.arenaElo.findMany.mockRejectedValue(new Error("DB error"));
      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Error getting leaderboard");
    });

    it("should handle non-Error thrown from get_leaderboard", async () => {
      mockPrisma.arenaElo.findMany.mockRejectedValue("string error");
      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("Unknown error");
    });

    it("should show Anonymous for null user name", async () => {
      mockPrisma.arenaElo.findMany.mockResolvedValue([
        {
          userId: "u1",
          elo: 1100,
          wins: 1,
          losses: 0,
          draws: 0,
          streak: 1,
          bestElo: 1100,
          user: { name: null },
        },
      ] as never);
      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });
      expect(result.content[0]!.text).toContain("Anonymous");
    });

    it("should show negative and zero streaks correctly", async () => {
      mockPrisma.arenaElo.findMany.mockResolvedValue([
        {
          userId: "u1",
          elo: 1200,
          wins: 2,
          losses: 5,
          draws: 0,
          streak: -3,
          bestElo: 1300,
          user: { name: "Loser" },
        },
        {
          userId: "u2",
          elo: 1000,
          wins: 0,
          losses: 0,
          draws: 1,
          streak: 0,
          bestElo: 1000,
          user: { name: "Tied" },
        },
      ] as never);
      const handler = registry.tools.get("arena_get_leaderboard")!.handler;
      const result = await handler({ limit: 20 });
      expect(result.content[0]!.text).toContain("-3");
      expect(result.content[0]!.text).toContain("| 0 |");
    });
  });
});
