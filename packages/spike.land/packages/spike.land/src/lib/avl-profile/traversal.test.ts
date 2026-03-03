import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  avlProfileTree: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  avlProfileNode: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  avlTraversalSession: {
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  avlUserProfile: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockTreeManager = vi.hoisted(() => ({
  getOrCreateTree: vi.fn(),
}));
vi.mock("./tree-manager", () => mockTreeManager);

const mockPersonalization = vi.hoisted(() => ({
  deriveTagsFromAnswerPath: vi.fn().mockReturnValue(["developer"]),
  buildProfileVector: vi.fn().mockReturnValue({}),
}));
vi.mock("./personalization", () => mockPersonalization);

const mockInsertion = vi.hoisted(() => ({
  handleCollision: vi.fn(),
}));
vi.mock("./insertion", () => mockInsertion);

const mockQuestionGenerator = vi.hoisted(() => ({
  generateDifferentiatingQuestion: vi.fn().mockResolvedValue({
    question: "root Q?",
    tags: ["tag"],
  }),
}));
vi.mock("./question-generator", () => mockQuestionGenerator);

import {
  answerQuestion,
  continueTraversal,
  getUserProfile,
  resetUserProfile,
  startTraversal,
} from "./traversal";

describe("traversal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersonalization.deriveTagsFromAnswerPath.mockReturnValue(["developer"]);
    mockPersonalization.buildProfileVector.mockReturnValue({});
  });

  describe("startTraversal", () => {
    it("returns ALREADY_PROFILED when user has profile", async () => {
      const existingProfile = {
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
        answerPath: [],
        derivedTags: ["developer"],
        profileVector: {},
        profileRound: 0,
        completedAt: new Date("2025-01-01"),
      };
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(existingProfile);

      const result = await startTraversal("user-1");
      expect(result.status).toBe("ALREADY_PROFILED");
      expect(result.profile).toBeDefined();
      expect(result.profile?.userId).toBe("user-1");
    });

    it("creates first user when tree has no root", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: null,
      });
      mockPrisma.avlProfileNode.create.mockResolvedValue({
        id: "root-1",
        treeId: "tree-1",
      });
      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      mockPrisma.avlProfileTree.update.mockResolvedValue({});
      mockPrisma.avlTraversalSession.create.mockResolvedValue({
        id: "session-1",
      });

      const result = await startTraversal("user-1");
      expect(result.status).toBe("QUESTION");
      expect(result.sessionId).toBe("session-1");
    });

    it("returns first question when tree has internal root", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: "root-1",
      });
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockResolvedValue({
        id: "root-1",
        nodeType: "INTERNAL",
        question: "Do you write code?",
        questionTags: ["developer"],
        assignedUserId: null,
      });
      mockPrisma.avlTraversalSession.create.mockResolvedValue({
        id: "session-1",
      });

      const result = await startTraversal("user-1");
      expect(result.status).toBe("QUESTION");
      expect(result.question).toBe("Do you write code?");
      expect(result.sessionId).toBe("session-1");
    });

    it("resolves collision inline when root is occupied leaf", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: "root-1",
      });
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockResolvedValue({
        id: "root-1",
        nodeType: "LEAF",
        assignedUserId: "other-user",
        question: null,
        questionTags: [],
      });
      mockPrisma.avlTraversalSession.create.mockResolvedValue({
        id: "session-1",
      });
      mockInsertion.handleCollision.mockResolvedValue({
        newQuestionNodeId: "root-1",
        occupantLeafId: "yes-leaf",
        newUserLeafId: "no-leaf",
        question: "Generated question?",
      });
      mockPrisma.avlUserProfile.findUniqueOrThrow.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "no-leaf",
        answerPath: [],
        derivedTags: ["developer"],
        profileVector: {},
        completedAt: null,
        profileRound: 0,
      });

      const result = await startTraversal("user-1");
      expect(result.status).toBe("QUESTION");
      expect(result.question).toBe("Generated question?");
      expect(result.nodeId).toBe("root-1");
      expect(mockInsertion.handleCollision).toHaveBeenCalledWith(
        "session-1",
        "other-user",
        "user-1",
      );
    });
  });

  describe("answerQuestion", () => {
    it("navigates to next internal node", async () => {
      mockPrisma.avlTraversalSession.findUniqueOrThrow.mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        treeId: "tree-1",
        currentNodeId: "node-1",
        answers: [],
        status: "IN_PROGRESS",
      });

      mockPrisma.avlProfileNode.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "node-1",
          nodeType: "INTERNAL",
          question: "Q1?",
          questionTags: ["tag1"],
          yesChildId: "node-2",
          noChildId: "node-3",
        })
        .mockResolvedValueOnce({
          id: "node-2",
          nodeType: "INTERNAL",
          question: "Q2?",
          questionTags: ["tag2"],
          assignedUserId: null,
        });

      mockPrisma.avlTraversalSession.update.mockResolvedValue({});

      const result = await answerQuestion("user-1", "session-1", true);
      expect(result.status).toBe("QUESTION");
      expect(result.question).toBe("Q2?");
      expect(result.nodeId).toBe("node-2");
    });

    it("assigns to empty leaf", async () => {
      mockPrisma.avlTraversalSession.findUniqueOrThrow.mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        treeId: "tree-1",
        currentNodeId: "node-1",
        answers: [],
        status: "IN_PROGRESS",
      });

      mockPrisma.avlProfileNode.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "node-1",
          nodeType: "INTERNAL",
          question: "Q1?",
          questionTags: ["tag1"],
          yesChildId: "leaf-1",
          noChildId: "leaf-2",
        })
        .mockResolvedValueOnce({
          id: "leaf-2",
          nodeType: "LEAF",
          assignedUserId: null,
        });

      mockPrisma.avlTraversalSession.update.mockResolvedValue({});
      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      mockPrisma.avlUserProfile.create.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-2",
        answerPath: [],
        derivedTags: ["developer"],
        profileVector: {},
        completedAt: null,
      });
      mockPrisma.avlProfileTree.update.mockResolvedValue({});

      const result = await answerQuestion("user-1", "session-1", false);
      expect(result.status).toBe("ASSIGNED");
      expect(result.profile).toBeDefined();
    });

    it("resolves collision inline at occupied leaf", async () => {
      mockPrisma.avlTraversalSession.findUniqueOrThrow.mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        treeId: "tree-1",
        currentNodeId: "node-1",
        answers: [],
        status: "IN_PROGRESS",
      });

      mockPrisma.avlProfileNode.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "node-1",
          nodeType: "INTERNAL",
          question: "Q1?",
          questionTags: ["tag1"],
          yesChildId: "leaf-1",
          noChildId: "leaf-2",
        })
        .mockResolvedValueOnce({
          id: "leaf-1",
          nodeType: "LEAF",
          assignedUserId: "other-user",
        });

      mockPrisma.avlTraversalSession.update.mockResolvedValue({});
      mockInsertion.handleCollision.mockResolvedValue({
        newQuestionNodeId: "leaf-1",
        occupantLeafId: "yes-leaf",
        newUserLeafId: "no-leaf",
        question: "Generated question?",
      });
      mockPrisma.avlUserProfile.findUniqueOrThrow.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "no-leaf",
        answerPath: [],
        derivedTags: ["developer"],
        profileVector: {},
        completedAt: null,
        profileRound: 0,
      });

      const result = await answerQuestion("user-1", "session-1", true);
      expect(result.status).toBe("QUESTION");
      expect(result.question).toBe("Generated question?");
      expect(result.nodeId).toBe("leaf-1");
      expect(mockInsertion.handleCollision).toHaveBeenCalledWith(
        "session-1",
        "other-user",
        "user-1",
      );
    });

    it("rejects wrong user", async () => {
      mockPrisma.avlTraversalSession.findUniqueOrThrow.mockResolvedValue({
        id: "session-1",
        userId: "user-other",
        treeId: "tree-1",
        currentNodeId: "node-1",
        answers: [],
        status: "IN_PROGRESS",
      });

      await expect(
        answerQuestion("user-1", "session-1", true),
      ).rejects.toThrow("Session does not belong to this user");
    });
  });

  describe("getUserProfile", () => {
    it("returns null when not found", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      const result = await getUserProfile("user-1");
      expect(result).toBeNull();
    });

    it("returns profile when found", async () => {
      const profile = {
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
        answerPath: [],
        derivedTags: ["developer"],
        profileVector: { developer: 1.0 },
        completedAt: new Date("2025-01-01"),
      };
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(profile);

      const result = await getUserProfile("user-1");
      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-1");
      expect(result?.derivedTags).toEqual(["developer"]);
    });
  });

  describe("resetUserProfile", () => {
    it("frees leaf and deletes profile", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
      });
      mockPrisma.$transaction.mockImplementation(async (
        fn: (tx: typeof mockPrisma) => Promise<unknown>,
      ) => fn(mockPrisma));
      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      mockPrisma.avlUserProfile.delete.mockResolvedValue({});
      mockPrisma.avlTraversalSession.deleteMany.mockResolvedValue({});
      mockPrisma.avlProfileTree.update.mockResolvedValue({});

      await resetUserProfile("user-1");

      expect(mockPrisma.avlProfileNode.updateMany).toHaveBeenCalledWith({
        where: { assignedUserId: "user-1" },
        data: { assignedUserId: null },
      });
      expect(mockPrisma.avlUserProfile.delete).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(mockPrisma.avlTraversalSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("does nothing when profile not found", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      await resetUserProfile("user-1");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("continueTraversal", () => {
    it("returns QUESTION when tree grew deeper and leaf became internal", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
        answerPath: [{
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["tag1"],
          answer: true,
        }],
        derivedTags: ["developer"],
        profileVector: {},
        completedAt: new Date(),
        profileRound: 0,
      });

      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: "root-1",
      });

      // Tree has deeper nodes now
      mockPrisma.avlProfileNode.findFirst.mockResolvedValue({ depth: 3 });

      // User's leaf became an internal node (tree restructured)
      mockPrisma.avlProfileNode.findUnique.mockResolvedValue({
        id: "leaf-1",
        nodeType: "INTERNAL",
        question: "New question?",
        questionTags: ["new-tag"],
      });

      mockPrisma.avlTraversalSession.create.mockResolvedValue({
        id: "session-new",
      });

      const result = await continueTraversal("user-1");
      expect(result.status).toBe("QUESTION");
      expect(result.question).toBe("New question?");
      expect(result.round).toBe(1);
    });

    it("returns ALREADY_PROFILED when tree unchanged", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        treeId: "tree-1",
        leafNodeId: "leaf-1",
        answerPath: [{
          nodeId: "n1",
          question: "Q1?",
          questionTags: ["tag1"],
          answer: true,
        }],
        derivedTags: ["developer"],
        profileVector: {},
        completedAt: new Date(),
        profileRound: 0,
      });

      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: "root-1",
      });
      mockPrisma.avlProfileNode.findFirst.mockResolvedValue({ depth: 1 });

      const result = await continueTraversal("user-1");
      expect(result.status).toBe("ALREADY_PROFILED");
      expect(result.round).toBe(0);
    });

    it("delegates to startTraversal when no profile exists", async () => {
      mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
      mockTreeManager.getOrCreateTree.mockResolvedValue({
        id: "tree-1",
        rootNodeId: null,
      });
      mockPrisma.avlProfileNode.create.mockResolvedValue({
        id: "root-1",
        treeId: "tree-1",
      });
      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      mockPrisma.avlProfileTree.update.mockResolvedValue({});
      mockPrisma.avlTraversalSession.create.mockResolvedValue({ id: "sess-1" });

      const result = await continueTraversal("user-1");
      expect(result.status).toBe("QUESTION");
      expect(result.sessionId).toBe("sess-1");
    });
  });
});
