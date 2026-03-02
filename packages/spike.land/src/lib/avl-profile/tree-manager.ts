/**
 * AVL Profile Tree Manager
 *
 * Manages the AVL profile tree lifecycle: creation, initialization
 * with seed questions using median-split recursion, and stats queries.
 */

import type { Prisma } from "@/generated/prisma";
import type { SeedQuestion, TreeStats } from "./types";

export const DEFAULT_SEED_QUESTIONS: SeedQuestion[] = [
  {
    question: "Do you write code as part of your work?",
    tags: ["developer", "technical"],
  },
  { question: "Do you create visual content?", tags: ["creative", "visual"] },
  {
    question: "Do you manage social media accounts?",
    tags: ["marketing", "social"],
  },
  {
    question: "Are you interested in AI and automation?",
    tags: ["ai-agents", "automation"],
  },
  {
    question: "Do you work in a team of more than 5 people?",
    tags: ["collaboration", "enterprise"],
  },
  {
    question: "Do you primarily use mobile devices?",
    tags: ["mobile", "lifestyle"],
  },
  {
    question: "Are you interested in music or audio production?",
    tags: ["creative", "audio"],
  },
];

/**
 * Get an existing tree by name, or create one with default seed questions.
 */
export async function getOrCreateTree(name = "default") {
  const prisma = (await import("@/lib/prisma")).default;

  const existing = await prisma.avlProfileTree.findUnique({
    where: { name },
  });

  if (existing) {
    return existing;
  }

  await prisma.avlProfileTree.create({
    data: {
      name,
      seedQuestions: DEFAULT_SEED_QUESTIONS as unknown as Prisma.InputJsonValue,
    },
  });

  await initializeTree(name, DEFAULT_SEED_QUESTIONS);

  return prisma.avlProfileTree.findUniqueOrThrow({
    where: { name },
  });
}

/**
 * Build a balanced binary tree from seed questions using median-split recursion.
 *
 * The algorithm:
 * - Sort questions, pick the median as the internal node
 * - Left half becomes the yes-subtree, right half becomes the no-subtree
 * - Base case: 0 questions = leaf node, 1 question = internal node with 2 leaf children
 *
 * Returns the root node ID.
 */
export async function initializeTree(name: string, seedQuestions: SeedQuestion[]): Promise<string> {
  const prisma = (await import("@/lib/prisma")).default;

  const tree = await prisma.avlProfileTree.findUniqueOrThrow({
    where: { name },
  });

  const treeId = tree.id;

  interface CreatedNode {
    id: string;
    nodeType: "INTERNAL" | "LEAF";
    question: string | null;
    questionTags: string[];
    parentId: string | null;
    yesChildId: string | null;
    noChildId: string | null;
    height: number;
    balanceFactor: number;
    depth: number;
  }

  const nodesToCreate: CreatedNode[] = [];
  let nodeIdCounter = 0;

  function generateId(): string {
    nodeIdCounter++;
    return `${treeId}-node-${nodeIdCounter}`;
  }

  /**
   * Recursively build the tree structure in memory before persisting.
   * Returns the node ID of the subtree root.
   */
  function buildSubtree(questions: SeedQuestion[], depth: number, parentId: string | null): string {
    // Base case: no questions left — create a leaf node
    if (questions.length === 0) {
      const leafId = generateId();
      nodesToCreate.push({
        id: leafId,
        nodeType: "LEAF",
        question: null,
        questionTags: [],
        parentId,
        yesChildId: null,
        noChildId: null,
        height: 0,
        balanceFactor: 0,
        depth,
      });
      return leafId;
    }

    // Base case: single question — internal node with two leaf children
    if (questions.length === 1) {
      const nodeId = generateId();
      const yesLeafId = buildSubtree([], depth + 1, nodeId);
      const noLeafId = buildSubtree([], depth + 1, nodeId);

      nodesToCreate.push({
        id: nodeId,
        nodeType: "INTERNAL",
        question: questions[0]!.question,
        questionTags: questions[0]!.tags,
        parentId,
        yesChildId: yesLeafId,
        noChildId: noLeafId,
        height: 1,
        balanceFactor: 0,
        depth,
      });
      return nodeId;
    }

    // Recursive case: split at median
    const medianIndex = Math.floor(questions.length / 2);
    const medianQuestion = questions[medianIndex]!;
    const leftQuestions = questions.slice(0, medianIndex);
    const rightQuestions = questions.slice(medianIndex + 1);

    const nodeId = generateId();
    const yesChildId = buildSubtree(leftQuestions, depth + 1, nodeId);
    const noChildId = buildSubtree(rightQuestions, depth + 1, nodeId);

    // Calculate height from children
    const yesChild = nodesToCreate.find((n) => n.id === yesChildId)!;
    const noChild = nodesToCreate.find((n) => n.id === noChildId)!;
    const height = Math.max(yesChild.height, noChild.height) + 1;
    const balanceFactor = yesChild.height - noChild.height;

    nodesToCreate.push({
      id: nodeId,
      nodeType: "INTERNAL",
      question: medianQuestion.question,
      questionTags: medianQuestion.tags,
      parentId,
      yesChildId,
      noChildId,
      height,
      balanceFactor,
      depth,
    });

    return nodeId;
  }

  const rootNodeId = buildSubtree(seedQuestions, 0, null);

  // Find max depth across all nodes
  const maxDepth = Math.max(...nodesToCreate.map((n) => n.depth));

  // Persist everything in a transaction
  await prisma.$transaction(async (tx) => {
    // Create all nodes
    for (const node of nodesToCreate) {
      await tx.avlProfileNode.create({
        data: {
          id: node.id,
          treeId,
          nodeType: node.nodeType,
          question: node.question,
          questionTags: node.questionTags,
          parentId: node.parentId,
          yesChildId: node.yesChildId,
          noChildId: node.noChildId,
          height: node.height,
          balanceFactor: node.balanceFactor,
          depth: node.depth,
        },
      });
    }

    // Update tree metadata
    await tx.avlProfileTree.update({
      where: { name },
      data: {
        rootNodeId,
        nodeCount: nodesToCreate.length,
        maxDepth,
      },
    });
  });

  return rootNodeId;
}

/**
 * Get statistics about an AVL profile tree.
 */
export async function getTreeStats(name = "default"): Promise<TreeStats> {
  const prisma = (await import("@/lib/prisma")).default;

  const tree = await prisma.avlProfileTree.findUniqueOrThrow({
    where: { name },
  });

  const nodes = await prisma.avlProfileNode.findMany({
    where: { treeId: tree.id },
    select: {
      nodeType: true,
      assignedUserId: true,
    },
  });

  const internalNodes = nodes.filter((n) => n.nodeType === "INTERNAL").length;
  const leafNodes = nodes.filter((n) => n.nodeType === "LEAF").length;
  const occupiedLeaves = nodes.filter(
    (n) => n.nodeType === "LEAF" && n.assignedUserId !== null,
  ).length;
  const emptyLeaves = leafNodes - occupiedLeaves;

  return {
    name: tree.name,
    nodeCount: tree.nodeCount,
    userCount: tree.userCount,
    maxDepth: tree.maxDepth,
    internalNodes,
    leafNodes,
    emptyLeaves,
    occupiedLeaves,
  };
}
