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
  getBalanceFactor,
  getHeight,
  leftRotate,
  type PrismaTransaction,
  rebalance,
  rebalanceUpward,
  rightRotate,
  updateHeight,
} from "./avl-rotations";

const mockTx = mockPrisma as unknown as PrismaTransaction;

describe("avl-rotations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getHeight", () => {
    it("returns -1 for null nodeId", async () => {
      const result = await getHeight(null, mockTx);
      expect(result).toBe(-1);
    });

    it("returns node height when found", async () => {
      mockPrisma.avlProfileNode.findUnique.mockResolvedValue({ height: 3 });
      const result = await getHeight("node-1", mockTx);
      expect(result).toBe(3);
    });

    it("returns -1 when node not found", async () => {
      mockPrisma.avlProfileNode.findUnique.mockResolvedValue(null);
      const result = await getHeight("missing-node", mockTx);
      expect(result).toBe(-1);
    });
  });

  describe("getBalanceFactor", () => {
    it("computes yesHeight - noHeight correctly", async () => {
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({ yesChildId: "yes-1", noChildId: "no-1" })
        .mockResolvedValueOnce({ height: 2 })
        .mockResolvedValueOnce({ height: 0 });

      const result = await getBalanceFactor("node-1", mockTx);
      expect(result).toBe(2);
    });

    it("returns 0 when node not found", async () => {
      mockPrisma.avlProfileNode.findUnique.mockResolvedValue(null);
      const result = await getBalanceFactor("missing", mockTx);
      expect(result).toBe(0);
    });
  });

  describe("updateHeight", () => {
    it("recalculates from children heights", async () => {
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({ yesChildId: "yes-1", noChildId: "no-1" })
        .mockResolvedValueOnce({ height: 2 })
        .mockResolvedValueOnce({ height: 1 });
      mockPrisma.avlProfileNode.update.mockResolvedValue({});

      await updateHeight("node-1", mockTx);

      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "node-1" },
        data: { height: 3, balanceFactor: 1 },
      });
    });

    it("does nothing when node not found", async () => {
      mockPrisma.avlProfileNode.findUnique.mockResolvedValue(null);
      await updateHeight("missing", mockTx);
      expect(mockPrisma.avlProfileNode.update).not.toHaveBeenCalled();
    });
  });

  describe("rightRotate", () => {
    it("moves yes-child to root and updates parent refs", async () => {
      mockPrisma.avlProfileNode.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "node-A",
          yesChildId: "node-B",
          parentId: null,
          treeId: "tree-1",
        })
        .mockResolvedValueOnce({
          id: "node-B",
          noChildId: "node-C",
        });

      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      // updateHeight calls: findUnique for node-A children, then node-B children
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({ yesChildId: "node-C", noChildId: null })
        .mockResolvedValueOnce({ height: 0 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ yesChildId: null, noChildId: "node-A" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ height: 1 });

      const result = await rightRotate("node-A", mockTx);
      expect(result).toBe("node-B");

      // yesChild (node-B) gets parent updated to null, noChildId to node-A
      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "node-B" },
        data: { parentId: null, noChildId: "node-A" },
      });

      // node-A gets parent updated to node-B, yesChildId to node-C (B subtree)
      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "node-A" },
        data: { parentId: "node-B", yesChildId: "node-C" },
      });
    });

    it("throws when no yes-child exists", async () => {
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockResolvedValueOnce({
        id: "node-A",
        yesChildId: null,
        parentId: null,
        treeId: "tree-1",
      });

      await expect(rightRotate("node-A", mockTx)).rejects.toThrow(
        "Cannot right-rotate node node-A: no yes-child",
      );
    });
  });

  describe("leftRotate", () => {
    it("moves no-child to root and updates parent refs", async () => {
      mockPrisma.avlProfileNode.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "node-A",
          noChildId: "node-B",
          parentId: null,
          treeId: "tree-1",
        })
        .mockResolvedValueOnce({
          id: "node-B",
          yesChildId: "node-C",
        });

      mockPrisma.avlProfileNode.update.mockResolvedValue({});
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({ yesChildId: null, noChildId: "node-C" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ height: 0 })
        .mockResolvedValueOnce({ yesChildId: "node-A", noChildId: null })
        .mockResolvedValueOnce({ height: 1 })
        .mockResolvedValueOnce(null);

      const result = await leftRotate("node-A", mockTx);
      expect(result).toBe("node-B");

      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "node-B" },
        data: { parentId: null, yesChildId: "node-A" },
      });

      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "node-A" },
        data: { parentId: "node-B", noChildId: "node-C" },
      });
    });

    it("throws when no no-child exists", async () => {
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockResolvedValueOnce({
        id: "node-A",
        noChildId: null,
        parentId: null,
        treeId: "tree-1",
      });

      await expect(leftRotate("node-A", mockTx)).rejects.toThrow(
        "Cannot left-rotate node node-A: no no-child",
      );
    });
  });

  describe("rebalance", () => {
    it("returns nodeId when balanced (bf between -1 and 1)", async () => {
      // getBalanceFactor: findUnique for node, then heights of children
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({ yesChildId: "yes-1", noChildId: "no-1" })
        .mockResolvedValueOnce({ height: 1 })
        .mockResolvedValueOnce({ height: 1 });

      const result = await rebalance("node-1", mockTx);
      expect(result).toBe("node-1");
    });

    it("calls rightRotate when left-heavy (bf > 1)", async () => {
      // Use a mutable node store so all internal calls resolve correctly
      const nodes: Record<string, Record<string, unknown>> = {
        "node-1": {
          id: "node-1",
          yesChildId: "yes-1",
          noChildId: "no-1",
          parentId: null,
          treeId: "tree-1",
          height: 3,
          balanceFactor: 2,
        },
        "yes-1": {
          id: "yes-1",
          yesChildId: "yy-1",
          noChildId: null,
          parentId: "node-1",
          treeId: "tree-1",
          height: 2,
          balanceFactor: 1,
        },
        "no-1": {
          id: "no-1",
          yesChildId: null,
          noChildId: null,
          parentId: "node-1",
          treeId: "tree-1",
          height: 0,
          balanceFactor: 0,
        },
        "yy-1": {
          id: "yy-1",
          yesChildId: null,
          noChildId: null,
          parentId: "yes-1",
          treeId: "tree-1",
          height: 0,
          balanceFactor: 0,
        },
      };

      mockPrisma.avlProfileNode.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => Promise.resolve(nodes[where.id] ?? null),
      );
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          const node = nodes[where.id];
          if (!node) return Promise.reject(new Error("Not found"));
          return Promise.resolve(node);
        },
      );
      mockPrisma.avlProfileNode.update.mockImplementation(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const node = nodes[where.id];
          if (node) {
            Object.assign(node, data);
          }
          return Promise.resolve(nodes[where.id]);
        },
      );

      const result = await rebalance("node-1", mockTx);
      // rightRotate: yes-1 becomes new root
      expect(result).toBe("yes-1");
    });

    it("calls leftRotate when right-heavy (bf < -1)", async () => {
      const nodes: Record<string, Record<string, unknown>> = {
        "node-1": {
          id: "node-1",
          yesChildId: "yes-1",
          noChildId: "no-1",
          parentId: null,
          treeId: "tree-1",
          height: 3,
          balanceFactor: -2,
        },
        "yes-1": {
          id: "yes-1",
          yesChildId: null,
          noChildId: null,
          parentId: "node-1",
          treeId: "tree-1",
          height: 0,
          balanceFactor: 0,
        },
        "no-1": {
          id: "no-1",
          yesChildId: null,
          noChildId: "nn-1",
          parentId: "node-1",
          treeId: "tree-1",
          height: 2,
          balanceFactor: -1,
        },
        "nn-1": {
          id: "nn-1",
          yesChildId: null,
          noChildId: null,
          parentId: "no-1",
          treeId: "tree-1",
          height: 0,
          balanceFactor: 0,
        },
      };

      mockPrisma.avlProfileNode.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => Promise.resolve(nodes[where.id] ?? null),
      );
      mockPrisma.avlProfileNode.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          const node = nodes[where.id];
          if (!node) return Promise.reject(new Error("Not found"));
          return Promise.resolve(node);
        },
      );
      mockPrisma.avlProfileNode.update.mockImplementation(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const node = nodes[where.id];
          if (node) {
            Object.assign(node, data);
          }
          return Promise.resolve(nodes[where.id]);
        },
      );

      const result = await rebalance("node-1", mockTx);
      // leftRotate: no-1 becomes new root
      expect(result).toBe("no-1");
    });
  });

  describe("rebalanceUpward", () => {
    it("walks to root updating heights", async () => {
      // First iteration: node with parent
      mockPrisma.avlProfileNode.findUnique
        .mockResolvedValueOnce({
          id: "child-1",
          parentId: "root-1",
          treeId: "tree-1",
        })
        // updateHeight for child-1
        .mockResolvedValueOnce({ yesChildId: null, noChildId: null })
        // getBalanceFactor for rebalance
        .mockResolvedValueOnce({ yesChildId: null, noChildId: null })
        // Second iteration: root node (no parent)
        .mockResolvedValueOnce({
          id: "root-1",
          parentId: null,
          treeId: "tree-1",
        })
        // updateHeight for root-1
        .mockResolvedValueOnce({ yesChildId: "child-1", noChildId: null })
        .mockResolvedValueOnce({ height: 0 })
        // getBalanceFactor for rebalance on root
        .mockResolvedValueOnce({ yesChildId: "child-1", noChildId: null })
        .mockResolvedValueOnce({ height: 0 });

      mockPrisma.avlProfileNode.update.mockResolvedValue({});

      await rebalanceUpward("child-1", mockTx);

      // Should have called update for height recalculations
      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalled();
    });
  });
});
