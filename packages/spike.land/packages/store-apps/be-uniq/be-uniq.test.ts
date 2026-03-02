/**
 * beUniq — Standalone Tool Tests
 */

import { describe, expect, it, vi } from "vitest";
import { beUniqTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

// Mock AVL profile traversal
vi.mock("@/lib/avl-profile/traversal", () => ({
  startTraversal: vi.fn().mockResolvedValue({
    status: "QUESTION",
    sessionId: "sess-1",
    question: "Do you prefer mornings?",
    questionTags: ["lifestyle", "schedule"],
  }),
  continueTraversal: vi.fn().mockResolvedValue({
    status: "ALREADY_PROFILED",
    round: 1,
    profile: {
      derivedTags: ["morning-person", "introvert"],
      leafNodeId: "leaf-3-2-1",
      answerPath: [
        { question: "Do you prefer mornings?", answer: true, questionTags: ["lifestyle"] },
      ],
    },
  }),
  answerQuestion: vi.fn().mockResolvedValue({
    status: "ASSIGNED",
    round: 1,
    profile: {
      derivedTags: ["morning-person"],
      leafNodeId: "leaf-3-2",
      answerPath: [
        { question: "Do you prefer mornings?", answer: true, questionTags: ["lifestyle"] },
      ],
    },
  }),
  getUserProfile: vi.fn().mockResolvedValue({
    derivedTags: ["morning-person", "introvert"],
    leafNodeId: "leaf-3-2-1",
    treeId: "default",
    profileRound: 1,
    answerPath: [
      { question: "Do you prefer mornings?", answer: true, questionTags: ["lifestyle"] },
    ],
  }),
  resetUserProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/avl-profile/tree-manager", () => ({
  getTreeStats: vi.fn().mockResolvedValue({
    name: "default",
    nodeCount: 15,
    internalNodes: 7,
    leafNodes: 8,
    occupiedLeaves: 5,
    emptyLeaves: 3,
    userCount: 5,
    maxDepth: 4,
  }),
}));

vi.mock("@/lib/avl-profile/question-generator", () => ({
  generateDifferentiatingQuestion: vi.fn().mockResolvedValue({
    question: "Do you enjoy outdoor activities?",
    tags: ["lifestyle", "outdoors"],
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    avlUserProfile: {
      findMany: vi.fn().mockResolvedValue([
        {
          userId: "user-1",
          user: { name: "Alice", email: null },
          leafNodeId: "leaf-4-3-2-1",
          answerPath: [
            { question: "Q1", answer: true, questionTags: ["t1"] },
            { question: "Q2", answer: false, questionTags: ["t2"] },
          ],
          derivedTags: ["tag1", "tag2"],
          completedAt: new Date("2026-01-15"),
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        userId: "test-user-id",
        user: { name: "TestUser", email: null },
        leafNodeId: "leaf-3-2-1",
        answerPath: [
          { question: "Do you prefer mornings?", answer: true, questionTags: ["lifestyle"] },
        ],
        derivedTags: ["morning-person", "introvert"],
        completedAt: new Date("2026-01-10"),
      }),
      count: vi.fn().mockResolvedValue(42),
    },
  },
}));

describe("beUniqTools", () => {
  const registry = createMockRegistry(beUniqTools);
  const ctx = createMockContext();

  it("exports the correct number of tools", () => {
    expect(beUniqTools.length).toBe(11);
  });

  it("registers tools in expected categories", () => {
    const categories = new Set(beUniqTools.map((t) => t.category));
    expect(categories).toContain("avl-profile");
    expect(categories).toContain("avl-social");
  });

  it("profile_start begins profiling", async () => {
    const result = await registry.call("profile_start", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Profiling Started");
    expect(text).toContain("Do you prefer mornings?");
  });

  it("profile_continue returns existing profile", async () => {
    const result = await registry.call("profile_continue", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Already Profiled");
  });

  it("profile_answer assigns profile on completion", async () => {
    const result = await registry.call(
      "profile_answer",
      { session_id: "sess-1", answer: true },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Profile Assigned");
    expect(text).toContain("morning-person");
  });

  it("profile_get returns user profile", async () => {
    const result = await registry.call("profile_get", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("User Profile");
    expect(text).toContain("morning-person");
  });

  it("profile_tree_stats returns tree statistics", async () => {
    const result = await registry.call("profile_tree_stats", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("AVL Profile Tree");
    expect(text).toContain("15");
  });

  it("profile_generate_question generates a question", async () => {
    const result = await registry.call("profile_generate_question", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Generated Question");
    expect(text).toContain("outdoor activities");
  });

  it("profile_reset removes the profile", async () => {
    const result = await registry.call("profile_reset", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Profile Reset");
  });

  it("profile_get_leaderboard returns rankings", async () => {
    const result = await registry.call("profile_get_leaderboard", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("beUniq Leaderboard");
    expect(text).toContain("Alice");
  });

  it("profile_share_result returns text format", async () => {
    const result = await registry.call("profile_share_result", { format: "text" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Share Your Result");
    expect(text).toContain("spike.land/beuniq");
  });

  it("profile_get_insights returns personality data", async () => {
    const result = await registry.call("profile_get_insights", {}, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Personality Insights");
    expect(text).toContain("Dominant Traits");
  });

  it("all tools have valid tier", () => {
    for (const tool of beUniqTools) {
      expect(["free", "workspace"]).toContain(tool.tier);
    }
  });
});
