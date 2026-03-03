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

const mockQuestionGen = vi.hoisted(() => ({
  generateDifferentiatingQuestion: vi.fn().mockResolvedValue({
    question: "Do you use TypeScript?",
    tags: ["developer", "typescript"],
  }),
}));
vi.mock("./question-generator", () => mockQuestionGen);

const mockRotations = vi.hoisted(() => ({
  rebalanceUpward: vi.fn(),
}));
vi.mock("./avl-rotations", () => mockRotations);

const mockPersonalization = vi.hoisted(() => ({
  deriveTagsFromAnswerPath: vi.fn().mockReturnValue(["developer"]),
  buildProfileVector: vi.fn().mockReturnValue({ developer: 1.0 }),
}));
vi.mock("./personalization", () => mockPersonalization);

import { handleCollision } from "./insertion";

describe("insertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupCollisionMocks = (
    options?: { nodeType?: string; hasOccupantProfile?: boolean; },
  ) => {
    const nodeType = options?.nodeType ?? "LEAF";
    const hasOccupantProfile = options?.hasOccupantProfile ?? true;

    mockPrisma.avlTraversalSession.findUniqueOrThrow.mockResolvedValue({
      id: "session-1",
      userId: "new-user",
      treeId: "tree-1",
      currentNodeId: "collision-node",
      answers: [],
      status: "COLLISION",
    });

    mockPrisma.avlUserProfile.findUnique.mockResolvedValue(
      hasOccupantProfile
        ? {
          id: "occupant-profile",
          userId: "occupant-user",
          treeId: "tree-1",
          leafNodeId: "collision-node",
          answerPath: [],
          derivedTags: [],
          profileVector: {},
        }
        : null,
    );

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    mockPrisma.avlProfileNode.findUniqueOrThrow.mockResolvedValue({
      id: "collision-node",
      treeId: "tree-1",
      nodeType,
      assignedUserId: "occupant-user",
      depth: 2,
      parentId: "parent-1",
    });

    mockPrisma.avlProfileNode.create
      .mockResolvedValueOnce({
        id: "yes-leaf",
        treeId: "tree-1",
        nodeType: "LEAF",
      })
      .mockResolvedValueOnce({
        id: "no-leaf",
        treeId: "tree-1",
        nodeType: "LEAF",
      });

    mockPrisma.avlProfileNode.update.mockResolvedValue({});
    mockPrisma.avlUserProfile.update.mockResolvedValue({});
    mockPrisma.avlUserProfile.create.mockResolvedValue({});
    mockPrisma.avlTraversalSession.update.mockResolvedValue({});
    mockPrisma.avlProfileTree.update.mockResolvedValue({});
    mockRotations.rebalanceUpward.mockResolvedValue(undefined);
  };

  describe("handleCollision", () => {
    it("splits leaf into internal + 2 leaves", async () => {
      setupCollisionMocks();

      const result = await handleCollision(
        "session-1",
        "occupant-user",
        "new-user",
      );

      expect(result.newQuestionNodeId).toBe("collision-node");
      expect(result.occupantLeafId).toBe("yes-leaf");
      expect(result.newUserLeafId).toBe("no-leaf");

      // Two leaf nodes created
      expect(mockPrisma.avlProfileNode.create).toHaveBeenCalledTimes(2);

      // Collision node converted to INTERNAL
      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "collision-node" },
        data: expect.objectContaining({
          nodeType: "INTERNAL",
          question: "Do you use TypeScript?",
          assignedUserId: null,
        }),
      });

      // Collision node updated with children
      expect(mockPrisma.avlProfileNode.update).toHaveBeenCalledWith({
        where: { id: "collision-node" },
        data: expect.objectContaining({
          yesChildId: "yes-leaf",
          noChildId: "no-leaf",
        }),
      });
    });

    it("generates differentiating question", async () => {
      setupCollisionMocks();

      const result = await handleCollision(
        "session-1",
        "occupant-user",
        "new-user",
      );

      expect(result.question).toBe("Do you use TypeScript?");
      expect(
        mockQuestionGen.generateDifferentiatingQuestion,
      ).toHaveBeenCalled();
    });

    it("updates occupant profile", async () => {
      setupCollisionMocks();

      await handleCollision("session-1", "occupant-user", "new-user");

      expect(mockPrisma.avlUserProfile.update).toHaveBeenCalledWith({
        where: { userId: "occupant-user" },
        data: expect.objectContaining({
          leafNodeId: "yes-leaf",
        }),
      });
    });

    it("calls rebalanceUpward", async () => {
      setupCollisionMocks();

      await handleCollision("session-1", "occupant-user", "new-user");

      expect(mockRotations.rebalanceUpward).toHaveBeenCalledWith(
        "collision-node",
        mockPrisma,
      );
    });

    it("throws RETRY_TRAVERSAL if node no longer leaf", async () => {
      setupCollisionMocks({ nodeType: "INTERNAL" });

      await expect(
        handleCollision("session-1", "occupant-user", "new-user"),
      ).rejects.toThrow("RETRY_TRAVERSAL");
    });

    it("creates occupant profile when occupant has no existing profile", async () => {
      setupCollisionMocks({ hasOccupantProfile: false });

      await handleCollision("session-1", "occupant-user", "new-user");

      // When no occupant profile exists, create is called for both occupant and new user
      // (2 creates for user profiles + 2 for leaf nodes = but we only check user profile creates)
      const userProfileCreateCalls = mockPrisma.avlUserProfile.create.mock.calls;
      const occupantCreate = userProfileCreateCalls.find(
        (call: Array<Record<string, Record<string, string>>>) =>
          call[0]?.data?.userId === "occupant-user",
      );
      expect(occupantCreate).toBeDefined();
    });
  });
});
