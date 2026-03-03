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

const mockQuestionGenerator = vi.hoisted(() => ({
  generateDifferentiatingQuestion: vi.fn().mockResolvedValue({
    question: "root Q?",
    tags: ["tag"],
  }),
}));
vi.mock("./question-generator", () => mockQuestionGenerator);

import { continueTraversal, startTraversal } from "./traversal";

describe("multi-visit integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("first visit assigns profile at round 0", async () => {
    mockPrisma.avlUserProfile.findUnique.mockResolvedValue(null);
    mockTreeManager.getOrCreateTree.mockResolvedValue({
      id: "tree-1",
      rootNodeId: null,
    });
    mockPrisma.avlProfileNode.create.mockResolvedValue({
      id: "root-1",
      treeId: "tree-1",
      questionTags: [],
    });
    mockPrisma.avlProfileNode.update.mockResolvedValue({});
    mockPrisma.avlProfileTree.update.mockResolvedValue({});
    mockPrisma.avlTraversalSession.create.mockResolvedValue({ id: "sess-1" });

    const result = await startTraversal("user-1");
    expect(result.status).toBe("QUESTION");
    expect(result.round).toBe(0);
    expect(result.sessionId).toBe("sess-1");
  });

  it("second visit on deeper tree returns new question", async () => {
    mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      treeId: "tree-1",
      leafNodeId: "leaf-1",
      answerPath: [{
        nodeId: "n1",
        question: "Q1?",
        questionTags: ["t1"],
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
    mockPrisma.avlProfileNode.findFirst.mockResolvedValue({ depth: 5 });
    mockPrisma.avlProfileNode.findUnique.mockResolvedValue({
      id: "leaf-1",
      nodeType: "INTERNAL",
      question: "New deeper question?",
      questionTags: ["new"],
    });
    mockPrisma.avlTraversalSession.create.mockResolvedValue({ id: "sess-2" });

    const result = await continueTraversal("user-1");
    expect(result.status).toBe("QUESTION");
    expect(result.round).toBe(1);
    expect(result.question).toBe("New deeper question?");
  });

  it("second visit on unchanged tree returns ALREADY_PROFILED", async () => {
    mockPrisma.avlUserProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      treeId: "tree-1",
      leafNodeId: "leaf-1",
      answerPath: [{
        nodeId: "n1",
        question: "Q1?",
        questionTags: ["t1"],
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
  });
});
