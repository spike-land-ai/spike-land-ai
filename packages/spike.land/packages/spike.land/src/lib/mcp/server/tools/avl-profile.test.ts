import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTraversal = vi.hoisted(() => ({
  startTraversal: vi.fn(),
  continueTraversal: vi.fn(),
  answerQuestion: vi.fn(),
  getUserProfile: vi.fn(),
  resetUserProfile: vi.fn(),
}));

const mockTreeManager = vi.hoisted(() => ({
  getTreeStats: vi.fn(),
}));

const mockQuestionGenerator = vi.hoisted(() => ({
  generateDifferentiatingQuestion: vi.fn(),
}));

vi.mock("@/lib/avl-profile/traversal", () => mockTraversal);
vi.mock("@/lib/avl-profile/tree-manager", () => mockTreeManager);
vi.mock("@/lib/avl-profile/question-generator", () => mockQuestionGenerator);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAvlProfileTools } from "./avl-profile";

describe("avl-profile tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAvlProfileTools(registry, userId);
  });

  it("should register 6 AVL profile tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
    expect(registry.handlers.has("profile_start")).toBe(true);
    expect(registry.handlers.has("profile_continue")).toBe(true);
    expect(registry.handlers.has("profile_answer")).toBe(true);
    expect(registry.handlers.has("profile_get")).toBe(true);
    expect(registry.handlers.has("profile_tree_stats")).toBe(true);
    expect(registry.handlers.has("profile_generate_question")).toBe(true);
    expect(registry.handlers.has("profile_reset")).toBe(true);
  });

  describe("profile_start", () => {
    it("should return first question", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "QUESTION",
        sessionId: "sess-1",
        question: "Do you prefer backend work?",
        questionTags: ["backend", "preference"],
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Profiling Started");
      expect(text).toContain("sess-1");
      expect(text).toContain("Do you prefer backend work?");
      expect(text).toContain("backend, preference");
    });

    it("should show 'none' when QUESTION tags are empty", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "QUESTION",
        sessionId: "sess-empty",
        question: "Something?",
        questionTags: [],
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("none");
    });

    it("should show 'none' when ALREADY_PROFILED tags are empty", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "ALREADY_PROFILED",
        profile: {
          derivedTags: [],
          leafNodeId: "leaf-empty",
          answerPath: [],
        },
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Already Profiled");
      expect(text).toContain("none");
    });

    it("should show 'none' when ASSIGNED tags are empty", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "ASSIGNED",
        profile: {
          derivedTags: [],
          leafNodeId: "leaf-0",
        },
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Profile Created");
      expect(text).toContain("none");
    });

    it("should show existing profile", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "ALREADY_PROFILED",
        profile: {
          derivedTags: ["developer", "backend"],
          leafNodeId: "leaf-1",
          answerPath: [
            {
              nodeId: "n1",
              question: "Do you code?",
              questionTags: ["developer"],
              answer: true,
            },
          ],
        },
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Already Profiled");
      expect(text).toContain("developer, backend");
      expect(text).toContain("leaf-1");
      expect(text).toContain("1 questions answered");
    });

    it("should show assignment for first user", async () => {
      mockTraversal.startTraversal.mockResolvedValue({
        status: "ASSIGNED",
        profile: {
          derivedTags: ["newcomer"],
          leafNodeId: "leaf-root",
        },
      });
      const handler = registry.handlers.get("profile_start")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Profile Created");
      expect(text).toContain("newcomer");
      expect(text).toContain("leaf-root");
    });
  });

  describe("profile_continue", () => {
    it("should show new question when tree grew", async () => {
      mockTraversal.continueTraversal.mockResolvedValue({
        status: "QUESTION",
        sessionId: "sess-cont",
        question: "Do you prefer TypeScript?",
        questionTags: ["typescript", "preference"],
        round: 1,
      });
      const handler = registry.handlers.get("profile_continue")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("New Questions Available");
      expect(text).toContain("Round 1");
      expect(text).toContain("sess-cont");
      expect(text).toContain("Do you prefer TypeScript?");
    });

    it("should show already profiled when unchanged", async () => {
      mockTraversal.continueTraversal.mockResolvedValue({
        status: "ALREADY_PROFILED",
        round: 0,
        profile: {
          derivedTags: ["developer"],
          leafNodeId: "leaf-1",
          answerPath: [{
            nodeId: "n1",
            question: "Q?",
            questionTags: ["t"],
            answer: true,
          }],
        },
      });
      const handler = registry.handlers.get("profile_continue")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Already Profiled");
      expect(text).toContain("Round 0");
    });

    it("should handle first user assignment", async () => {
      mockTraversal.continueTraversal.mockResolvedValue({
        status: "ASSIGNED",
        profile: {
          derivedTags: ["newcomer"],
          leafNodeId: "leaf-root",
        },
      });
      const handler = registry.handlers.get("profile_continue")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("Profile Created");
    });
  });

  describe("profile_answer", () => {
    it("should show next question", async () => {
      mockTraversal.answerQuestion.mockResolvedValue({
        status: "QUESTION",
        sessionId: "sess-1",
        question: "Do you enjoy testing?",
        questionTags: ["testing"],
      });
      const handler = registry.handlers.get("profile_answer")!;
      const result = await handler({ session_id: "sess-1", answer: true });
      const text = getText(result);
      expect(text).toContain("Next Question");
      expect(text).toContain("sess-1");
      expect(text).toContain("Do you enjoy testing?");
      expect(text).toContain("testing");
    });

    it("should show collision detected", async () => {
      mockTraversal.answerQuestion.mockResolvedValue({
        status: "COLLISION",
        sessionId: "sess-collision",
        nodeId: "node-42",
      });
      const handler = registry.handlers.get("profile_answer")!;
      const result = await handler({ session_id: "sess-1", answer: false });
      const text = getText(result);
      expect(text).toContain("Collision Detected");
      expect(text).toContain("sess-collision");
      expect(text).toContain("node-42");
      expect(text).toContain("profile_generate_question");
    });

    it("should show profile assignment", async () => {
      mockTraversal.answerQuestion.mockResolvedValue({
        status: "ASSIGNED",
        profile: {
          derivedTags: ["developer", "tester"],
          leafNodeId: "leaf-5",
          answerPath: [
            {
              nodeId: "n1",
              question: "Do you code?",
              questionTags: ["developer"],
              answer: true,
            },
            {
              nodeId: "n2",
              question: "Do you test?",
              questionTags: ["tester"],
              answer: true,
            },
          ],
        },
      });
      const handler = registry.handlers.get("profile_answer")!;
      const result = await handler({ session_id: "sess-1", answer: true });
      const text = getText(result);
      expect(text).toContain("Profile Assigned");
      expect(text).toContain("developer, tester");
      expect(text).toContain("leaf-5");
      expect(text).toContain("2 questions answered");
    });
  });

  describe("profile_get", () => {
    it("should show profile", async () => {
      mockTraversal.getUserProfile.mockResolvedValue({
        id: "prof-1",
        userId: "test-user-123",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
        answerPath: [
          {
            nodeId: "n1",
            question: "Do you code?",
            questionTags: ["developer"],
            answer: true,
          },
        ],
        derivedTags: ["developer"],
        profileVector: { developer: 1.0 },
        completedAt: new Date(),
      });
      const handler = registry.handlers.get("profile_get")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("User Profile");
      expect(text).toContain("developer");
      expect(text).toContain("leaf-1");
      expect(text).toContain("tree-1");
      expect(text).toContain("Do you code?");
      expect(text).toContain("Yes");
    });

    it("should handle no profile", async () => {
      mockTraversal.getUserProfile.mockResolvedValue(null);
      const handler = registry.handlers.get("profile_get")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("No Profile Found");
    });
  });

  describe("profile_tree_stats", () => {
    it("should show tree statistics", async () => {
      mockTreeManager.getTreeStats.mockResolvedValue({
        name: "default",
        nodeCount: 15,
        internalNodes: 7,
        leafNodes: 8,
        occupiedLeaves: 5,
        emptyLeaves: 3,
        userCount: 5,
        maxDepth: 4,
      });
      const handler = registry.handlers.get("profile_tree_stats")!;
      const result = await handler({ tree_name: "default" });
      const text = getText(result);
      expect(text).toContain("AVL Profile Tree: default");
      expect(text).toContain("15");
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).toContain("5");
      expect(text).toContain("3");
      expect(text).toContain("4");
    });
  });

  describe("profile_generate_question", () => {
    it("should generate a question", async () => {
      mockQuestionGenerator.generateDifferentiatingQuestion.mockResolvedValue({
        question: "Do you prefer functional programming?",
        tags: ["functional", "paradigm"],
      });
      const handler = registry.handlers.get("profile_generate_question")!;
      const result = await handler({
        used_questions: ["Do you code?"],
        context_hint: "programming style",
      });
      const text = getText(result);
      expect(text).toContain("Generated Question");
      expect(text).toContain("Do you prefer functional programming?");
      expect(text).toContain("functional, paradigm");
    });
  });

  describe("profile_reset", () => {
    it("should reset profile", async () => {
      mockTraversal.resetUserProfile.mockResolvedValue(undefined);
      const handler = registry.handlers.get("profile_reset")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Profile Reset");
    });
  });
});
