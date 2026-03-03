import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Prisma mock — hoisted so dynamic imports resolve to the mock
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => {
  const avlUserProfile = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  };
  return { default: { avlUserProfile } };
});

vi.mock("@/lib/prisma", () => mockPrisma);

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAvlSocialTools } from "./avl-social";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user-abc";
const OTHER_USER_ID = "user-xyz";

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  userId: USER_ID,
  leafNodeId: "leaf-3-2-1",
  answerPath: [
    { question: "Do you code?", answer: true, questionTags: ["developer"] },
    { question: "Do you test?", answer: true, questionTags: ["tester", "quality"] },
    { question: "Do you ship at night?", answer: false, questionTags: ["night-owl"] },
  ],
  derivedTags: ["developer", "tester", "quality"],
  completedAt: new Date("2025-06-01"),
  createdAt: new Date("2025-05-30"),
  user: { name: "Alice", email: "alice@example.com" },
  ...overrides,
});

const makeOtherProfile = (overrides: Record<string, unknown> = {}) => ({
  userId: OTHER_USER_ID,
  leafNodeId: "leaf-3-2",
  answerPath: [
    { question: "Do you code?", answer: true, questionTags: ["developer"] },
    { question: "Do you test?", answer: false, questionTags: ["tester", "quality"] },
  ],
  derivedTags: ["developer"],
  completedAt: new Date("2025-06-02"),
  createdAt: new Date("2025-05-31"),
  user: { name: "Bob", email: "bob@example.com" },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("avl-social tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAvlSocialTools(registry, USER_ID);
  });

  it("registers exactly 4 avl-social tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("profile_get_leaderboard")).toBe(true);
    expect(registry.handlers.has("profile_share_result")).toBe(true);
    expect(registry.handlers.has("profile_compare")).toBe(true);
    expect(registry.handlers.has("profile_get_insights")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // profile_get_leaderboard
  // -------------------------------------------------------------------------

  describe("profile_get_leaderboard", () => {
    it("returns a ranked table of profiles sorted by depth by default", async () => {
      mockPrisma.default.avlUserProfile.findMany.mockResolvedValue([
        makeProfile({
          userId: "u1",
          leafNodeId: "leaf-3-2-1",
          user: { name: "Alice", email: null },
        }),
        makeProfile({ userId: "u2", leafNodeId: "leaf-2", user: { name: "Bob", email: null } }),
      ]);

      const handler = registry.handlers.get("profile_get_leaderboard")!;
      const result = await handler({ limit: 10, sort_by: "depth" });
      const text = getText(result);

      expect(text).toContain("beUniq Leaderboard");
      expect(text).toContain("sorted by: depth");
      expect(text).toContain("Alice");
      expect(text).toContain("Bob");
      // Alice has depth 3 (leaf-3-2-1 has 3 separators -> depth 3); ranks first
      expect(text.indexOf("Alice")).toBeLessThan(text.indexOf("Bob"));
    });

    it("returns message when no profiles exist", async () => {
      mockPrisma.default.avlUserProfile.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("profile_get_leaderboard")!;
      const result = await handler({ limit: 10, sort_by: "depth" });
      const text = getText(result);

      expect(text).toContain("No completed profiles yet");
    });

    it("sorts by questions_answered in descending order", async () => {
      mockPrisma.default.avlUserProfile.findMany.mockResolvedValue([
        makeProfile({
          userId: "u1",
          answerPath: [{ question: "Q1", answer: true, questionTags: [] }],
          user: { name: "Few", email: null },
        }),
        makeProfile({
          userId: "u2",
          answerPath: [
            { question: "Q1", answer: true, questionTags: [] },
            { question: "Q2", answer: false, questionTags: [] },
            { question: "Q3", answer: true, questionTags: [] },
          ],
          user: { name: "Many", email: null },
        }),
      ]);

      const handler = registry.handlers.get("profile_get_leaderboard")!;
      const result = await handler({ limit: 10, sort_by: "questions_answered" });
      const text = getText(result);

      // "Many" has 3 answers and should rank above "Few" (1 answer)
      expect(text.indexOf("Many")).toBeLessThan(text.indexOf("Few"));
    });

    it("sorts by speed (fewest questions first)", async () => {
      mockPrisma.default.avlUserProfile.findMany.mockResolvedValue([
        makeProfile({
          userId: "u1",
          answerPath: [
            { question: "Q1", answer: true, questionTags: [] },
            { question: "Q2", answer: false, questionTags: [] },
          ],
          user: { name: "Slow", email: null },
        }),
        makeProfile({
          userId: "u2",
          answerPath: [{ question: "Q1", answer: true, questionTags: [] }],
          user: { name: "Fast", email: null },
        }),
      ]);

      const handler = registry.handlers.get("profile_get_leaderboard")!;
      const result = await handler({ limit: 10, sort_by: "speed" });
      const text = getText(result);

      expect(text.indexOf("Fast")).toBeLessThan(text.indexOf("Slow"));
    });

    it("uses email-derived name when user.name is null", async () => {
      mockPrisma.default.avlUserProfile.findMany.mockResolvedValue([
        makeProfile({ user: { name: null, email: "charlie@spike.land" } }),
      ]);

      const handler = registry.handlers.get("profile_get_leaderboard")!;
      const result = await handler({ limit: 10, sort_by: "depth" });
      const text = getText(result);

      expect(text).toContain("charlie");
    });
  });

  // -------------------------------------------------------------------------
  // profile_share_result
  // -------------------------------------------------------------------------

  describe("profile_share_result", () => {
    it("returns plain text share by default", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(makeProfile());

      const handler = registry.handlers.get("profile_share_result")!;
      const result = await handler({ format: "text" });
      const text = getText(result);

      expect(text).toContain("Share Your Result");
      expect(text).toContain("depth");
      expect(text).toContain("spike.land/beuniq");
    });

    it("returns a visual card", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(makeProfile());

      const handler = registry.handlers.get("profile_share_result")!;
      const result = await handler({ format: "card" });
      const text = getText(result);

      expect(text).toContain("beUniq Profile Card");
      expect(text).toContain("Alice");
      expect(text).toContain("```");
    });

    it("returns a shareable link containing the user ID", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(makeProfile());

      const handler = registry.handlers.get("profile_share_result")!;
      const result = await handler({ format: "link" });
      const text = getText(result);

      expect(text).toContain("Share Your Profile");
      expect(text).toContain(USER_ID);
      expect(text).toContain("spike.land/beuniq/profile/");
    });

    it("returns error when no completed profile exists", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("profile_share_result")!;
      const result = await handler({ format: "text" });
      const text = getText(result);

      expect(text).toContain("No Completed Profile");
      expect(text).toContain("profile_start");
    });
  });

  // -------------------------------------------------------------------------
  // profile_compare
  // -------------------------------------------------------------------------

  describe("profile_compare", () => {
    it("returns comparison metrics between two profiles", async () => {
      mockPrisma.default.avlUserProfile.findUnique
        .mockResolvedValueOnce(makeProfile())
        .mockResolvedValueOnce(makeOtherProfile());

      const handler = registry.handlers.get("profile_compare")!;
      const result = await handler({ other_user_id: OTHER_USER_ID });
      const text = getText(result);

      expect(text).toContain("Profile Comparison");
      expect(text).toContain("Bob");
      expect(text).toContain("Common answers");
      expect(text).toContain("Divergence at question");
      expect(text).toContain("Personality overlap");
    });

    it("reports 100% overlap when profiles share all tags", async () => {
      const sameTagProfile = makeOtherProfile({
        derivedTags: ["developer", "tester", "quality"],
        answerPath: [
          { question: "Do you code?", answer: true, questionTags: ["developer"] },
          { question: "Do you test?", answer: true, questionTags: ["tester", "quality"] },
        ],
      });
      mockPrisma.default.avlUserProfile.findUnique
        .mockResolvedValueOnce(makeProfile())
        .mockResolvedValueOnce(sameTagProfile);

      const handler = registry.handlers.get("profile_compare")!;
      const result = await handler({ other_user_id: OTHER_USER_ID });
      const text = getText(result);

      expect(text).toContain("100%");
    });

    it("returns error when current user has no profile", async () => {
      mockPrisma.default.avlUserProfile.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeOtherProfile());

      const handler = registry.handlers.get("profile_compare")!;
      const result = await handler({ other_user_id: OTHER_USER_ID });
      const text = getText(result);

      expect(text).toContain("No Profile");
      expect(text).toContain("profile_start");
    });

    it("returns error when other player has no profile", async () => {
      mockPrisma.default.avlUserProfile.findUnique
        .mockResolvedValueOnce(makeProfile())
        .mockResolvedValueOnce(null);

      const handler = registry.handlers.get("profile_compare")!;
      const result = await handler({ other_user_id: OTHER_USER_ID });
      const text = getText(result);

      expect(text).toContain("Other Player Not Found");
      expect(text).toContain(OTHER_USER_ID);
    });

    it("handles identical answer paths with no divergence", async () => {
      const identicalProfile = makeOtherProfile({
        answerPath: makeProfile().answerPath,
        derivedTags: makeProfile().derivedTags,
      });
      mockPrisma.default.avlUserProfile.findUnique
        .mockResolvedValueOnce(makeProfile())
        .mockResolvedValueOnce(identicalProfile);

      const handler = registry.handlers.get("profile_compare")!;
      const result = await handler({ other_user_id: OTHER_USER_ID });
      const text = getText(result);

      expect(text).toContain("Paths are identical");
    });
  });

  // -------------------------------------------------------------------------
  // profile_get_insights
  // -------------------------------------------------------------------------

  describe("profile_get_insights", () => {
    it("returns personality insights with confidence scores", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(makeProfile());
      mockPrisma.default.avlUserProfile.count.mockResolvedValue(42);

      const handler = registry.handlers.get("profile_get_insights")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("Personality Insights");
      expect(text).toContain("Dominant Traits");
      expect(text).toContain("Tag Confidence Scores");
      expect(text).toContain("developer");
      expect(text).toContain("Fun Fact");
      expect(text).toContain("1 in 42");
    });

    it("shows 'uniquely you' when no other users exist", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(makeProfile());
      mockPrisma.default.avlUserProfile.count.mockResolvedValue(0);

      const handler = registry.handlers.get("profile_get_insights")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("uniquely you");
    });

    it("returns error when no profile exists", async () => {
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("profile_get_insights")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("No Profile");
      expect(text).toContain("profile_start");
    });

    it("shows none for rare combinations when all tags are confident", async () => {
      const highConfidenceProfile = makeProfile({
        derivedTags: ["developer"],
        answerPath: [
          { question: "Do you code?", answer: true, questionTags: ["developer"] },
          { question: "Do you ship?", answer: true, questionTags: ["developer"] },
          { question: "Do you review?", answer: true, questionTags: ["developer"] },
        ],
      });
      mockPrisma.default.avlUserProfile.findUnique.mockResolvedValue(highConfidenceProfile);
      mockPrisma.default.avlUserProfile.count.mockResolvedValue(10);

      const handler = registry.handlers.get("profile_get_insights")!;
      const result = await handler({});
      const text = getText(result);

      expect(text).toContain("Rare Combinations");
      // developer has 100% confidence, so no rare combos
      expect(text).toContain("none identified");
    });
  });
});
