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
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

import {
  DEFAULT_SEED_QUESTIONS,
  getOrCreateTree,
  getTreeStats,
  initializeTree,
} from "./tree-manager";

describe("tree-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DEFAULT_SEED_QUESTIONS", () => {
    it("has 7 entries", () => {
      expect(DEFAULT_SEED_QUESTIONS).toHaveLength(7);
    });
  });

  describe("getOrCreateTree", () => {
    it("returns existing tree if found", async () => {
      const existingTree = {
        id: "tree-1",
        name: "default",
        rootNodeId: "root-1",
        nodeCount: 15,
        userCount: 3,
        maxDepth: 4,
      };
      mockPrisma.avlProfileTree.findUnique.mockResolvedValue(existingTree);

      const result = await getOrCreateTree("default");
      expect(result).toEqual(existingTree);
      expect(mockPrisma.avlProfileTree.create).not.toHaveBeenCalled();
    });

    it("creates new tree if not found", async () => {
      const newTree = {
        id: "tree-new",
        name: "default",
        rootNodeId: null,
        nodeCount: 0,
        userCount: 0,
        maxDepth: 0,
        seedQuestions: DEFAULT_SEED_QUESTIONS,
      };
      const finalTree = { ...newTree, rootNodeId: "root-1", nodeCount: 15 };

      mockPrisma.avlProfileTree.findUnique.mockResolvedValueOnce(null);
      mockPrisma.avlProfileTree.create.mockResolvedValue(newTree);
      // initializeTree calls findUniqueOrThrow
      mockPrisma.avlProfileTree.findUniqueOrThrow.mockResolvedValue(newTree);
      // initializeTree calls $transaction
      mockPrisma.$transaction.mockImplementation(async (
        fn: (tx: typeof mockPrisma) => Promise<unknown>,
      ) => fn(mockPrisma));
      mockPrisma.avlProfileNode.create.mockResolvedValue({});
      mockPrisma.avlProfileTree.update.mockResolvedValue({});
      // Final findUniqueOrThrow after initializeTree
      mockPrisma.avlProfileTree.findUniqueOrThrow.mockResolvedValue(finalTree);

      const result = await getOrCreateTree("default");
      expect(result).toEqual(finalTree);
      expect(mockPrisma.avlProfileTree.create).toHaveBeenCalledWith({
        data: {
          name: "default",
          seedQuestions: DEFAULT_SEED_QUESTIONS,
        },
      });
    });
  });

  describe("initializeTree", () => {
    it("creates balanced tree from seed questions", async () => {
      const tree = { id: "tree-1", name: "test" };
      mockPrisma.avlProfileTree.findUniqueOrThrow.mockResolvedValue(tree);
      mockPrisma.$transaction.mockImplementation(async (
        fn: (tx: typeof mockPrisma) => Promise<unknown>,
      ) => fn(mockPrisma));
      mockPrisma.avlProfileNode.create.mockResolvedValue({});
      mockPrisma.avlProfileTree.update.mockResolvedValue({});

      const seedQuestions = [
        { question: "Q1?", tags: ["t1"] },
        { question: "Q2?", tags: ["t2"] },
        { question: "Q3?", tags: ["t3"] },
      ];

      const rootId = await initializeTree("test", seedQuestions);
      expect(rootId).toBeTruthy();

      // 3 seed questions produce: 3 internal + 4 leaf = 7 nodes
      expect(mockPrisma.avlProfileNode.create).toHaveBeenCalledTimes(7);
      expect(mockPrisma.avlProfileTree.update).toHaveBeenCalled();
    });
  });

  describe("getTreeStats", () => {
    it("returns correct statistics", async () => {
      mockPrisma.avlProfileTree.findUniqueOrThrow.mockResolvedValue({
        id: "tree-1",
        name: "default",
        nodeCount: 5,
        userCount: 2,
        maxDepth: 2,
      });

      mockPrisma.avlProfileNode.findMany.mockResolvedValue([
        { nodeType: "INTERNAL", assignedUserId: null },
        { nodeType: "INTERNAL", assignedUserId: null },
        { nodeType: "LEAF", assignedUserId: "user-1" },
        { nodeType: "LEAF", assignedUserId: "user-2" },
        { nodeType: "LEAF", assignedUserId: null },
      ]);

      const stats = await getTreeStats("default");
      expect(stats).toEqual({
        name: "default",
        nodeCount: 5,
        userCount: 2,
        maxDepth: 2,
        internalNodes: 2,
        leafNodes: 3,
        occupiedLeaves: 2,
        emptyLeaves: 1,
      });
    });
  });
});
