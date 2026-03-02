/**
 * AVL Profile Tree Traversal
 *
 * Handles user profiling flow: start traversal, answer questions,
 * navigate the tree, and manage user profiles.
 */

import type { Prisma } from "@/generated/prisma";
import type { AnswerPathEntry, AnswerResult, TraversalResult, UserProfile } from "./types";

/**
 * Start a profiling traversal for a user.
 * If the user already has a profile, returns it.
 * If the tree is empty, assigns the user to the root as first user.
 * Otherwise, creates a traversal session at the root node.
 */
export async function startTraversal(
  userId: string,
  treeName = "default",
): Promise<TraversalResult> {
  const prisma = (await import("@/lib/prisma")).default;
  const { getOrCreateTree } = await import("./tree-manager");

  // Check if user already has a profile
  const existing = await prisma.avlUserProfile.findUnique({
    where: { userId },
  });
  if (existing) {
    return {
      sessionId: "",
      status: "ALREADY_PROFILED",
      round: existing.profileRound,
      profile: {
        id: existing.id,
        userId: existing.userId,
        treeId: existing.treeId,
        leafNodeId: existing.leafNodeId,
        answerPath: existing.answerPath as unknown as AnswerPathEntry[],
        derivedTags: existing.derivedTags,
        profileVector: existing.profileVector as Record<string, number>,
        completedAt: existing.completedAt,
        profileRound: existing.profileRound,
      },
    };
  }

  const tree = await getOrCreateTree(treeName);

  // If tree has no root, user is the first — create an internal node at root
  if (!tree.rootNodeId) {
    const { generateDifferentiatingQuestion } = await import("./question-generator");

    // Generate a broad starting question
    const generated = await generateDifferentiatingQuestion(
      [],
      [],
      "Generate a broad, engaging personality question to start profiling.",
    );

    // Clear any existing assignments first
    await prisma.avlProfileNode.updateMany({
      where: { assignedUserId: userId },
      data: { assignedUserId: null },
    });

    // Create the root node as an internal node with the question
    const rootNode = await prisma.avlProfileNode.create({
      data: {
        treeId: tree.id,
        nodeType: "INTERNAL",
        question: generated.question,
        questionTags: generated.tags,
        height: 1,
        balanceFactor: 0,
        depth: 0,
        assignedUserId: null,
      },
    });

    // Create the two empty leaf children
    const yesLeaf = await prisma.avlProfileNode.create({
      data: {
        treeId: tree.id,
        nodeType: "LEAF",
        questionTags: [],
        parentId: rootNode.id,
        height: 0,
        balanceFactor: 0,
        depth: 1,
        assignedUserId: null,
      },
    });

    const noLeaf = await prisma.avlProfileNode.create({
      data: {
        treeId: tree.id,
        nodeType: "LEAF",
        questionTags: [],
        parentId: rootNode.id,
        height: 0,
        balanceFactor: 0,
        depth: 1,
        assignedUserId: null,
      },
    });

    // Update root with children
    await prisma.avlProfileNode.update({
      where: { id: rootNode.id },
      data: {
        yesChildId: yesLeaf.id,
        noChildId: noLeaf.id,
      },
    });

    await prisma.avlProfileTree.update({
      where: { id: tree.id },
      data: { rootNodeId: rootNode.id, nodeCount: 3, userCount: 0 },
    });

    // Start a traversal session at the new root node
    const session = await prisma.avlTraversalSession.create({
      data: {
        userId,
        treeId: tree.id,
        currentNodeId: rootNode.id,
        answers: [],
        status: "IN_PROGRESS",
      },
    });

    return {
      sessionId: session.id,
      status: "QUESTION",
      ...(rootNode.question != null ? { question: rootNode.question } : {}),
      questionTags: rootNode.questionTags,
      nodeId: rootNode.id,
      round: 0,
    };
  }

  // Start at the root node
  const rootNode = await prisma.avlProfileNode.findUniqueOrThrow({
    where: { id: tree.rootNodeId },
  });

  // If root is a leaf (single-node tree)
  if (rootNode.nodeType === "LEAF") {
    if (rootNode.assignedUserId === null) {
      // Empty leaf — assign user
      return assignUserToLeaf(userId, rootNode.id, tree.id, []);
    }
    // Collision at root (should be rare since we now init with internal node, but handled just in case)
    const { handleCollision } = await import("./insertion");
    const session = await prisma.avlTraversalSession.create({
      data: {
        userId,
        treeId: tree.id,
        currentNodeId: rootNode.id,
        answers: [],
        status: "IN_PROGRESS",
      },
    });
    const collisionResult = await handleCollision(session.id, rootNode.assignedUserId, userId);
    // Returning the newly generated question to the new user
    return {
      sessionId: session.id,
      status: "QUESTION",
      ...(collisionResult.question !== undefined ? { question: collisionResult.question } : {}),
      questionTags: [], // Optionally fetch from the newly created internal node if needed, but handleCollision returns question string.
      nodeId: collisionResult.newQuestionNodeId,
      round: 0,
    };
  }

  // Root is internal — create session and return first question
  const session = await prisma.avlTraversalSession.create({
    data: {
      userId,
      treeId: tree.id,
      currentNodeId: rootNode.id,
      answers: [],
      status: "IN_PROGRESS",
    },
  });

  return {
    sessionId: session.id,
    status: "QUESTION",
    ...(rootNode.question != null ? { question: rootNode.question } : {}),
    questionTags: rootNode.questionTags,
    nodeId: rootNode.id,
    round: 0,
  };
}

/**
 * Continue profiling for a returning user.
 * If the tree has grown deeper since their last visit, starts a new session
 * from their current leaf position. Otherwise returns their existing profile.
 */
export async function continueTraversal(
  userId: string,
  treeName = "default",
): Promise<TraversalResult> {
  const prisma = (await import("@/lib/prisma")).default;
  const { getOrCreateTree } = await import("./tree-manager");

  const existing = await prisma.avlUserProfile.findUnique({
    where: { userId },
  });
  if (!existing) {
    return startTraversal(userId, treeName);
  }

  const tree = await getOrCreateTree(treeName);

  // Find current tree max depth
  const deepestNode = await prisma.avlProfileNode.findFirst({
    where: { treeId: tree.id },
    orderBy: { depth: "desc" },
    select: { depth: true },
  });
  const treeMaxDepth = deepestNode?.depth ?? 0;
  const userPathLength = (existing.answerPath as unknown as AnswerPathEntry[]).length;

  if (treeMaxDepth <= userPathLength) {
    return {
      sessionId: "",
      status: "ALREADY_PROFILED",
      round: existing.profileRound,
      profile: {
        id: existing.id,
        userId: existing.userId,
        treeId: existing.treeId,
        leafNodeId: existing.leafNodeId,
        answerPath: existing.answerPath as unknown as AnswerPathEntry[],
        derivedTags: existing.derivedTags,
        profileVector: existing.profileVector as Record<string, number>,
        completedAt: existing.completedAt,
        profileRound: existing.profileRound,
      },
    };
  }

  // Tree has grown deeper — start new session from user's current leaf
  const leafNode = await prisma.avlProfileNode.findUnique({
    where: { id: existing.leafNodeId },
  });

  if (!leafNode) {
    // Leaf node was deleted, fallback to starting a new traversal
    return startTraversal(userId, treeName);
  }

  // If the leaf node is still a leaf, no new questions available at this position
  if (leafNode.nodeType === "LEAF") {
    return {
      sessionId: "",
      status: "ALREADY_PROFILED",
      round: existing.profileRound,
      profile: {
        id: existing.id,
        userId: existing.userId,
        treeId: existing.treeId,
        leafNodeId: existing.leafNodeId,
        answerPath: existing.answerPath as unknown as AnswerPathEntry[],
        derivedTags: existing.derivedTags,
        profileVector: existing.profileVector as Record<string, number>,
        completedAt: existing.completedAt,
        profileRound: existing.profileRound,
      },
    };
  }

  // Leaf was replaced by an internal node (tree restructured) — new questions available
  const session = await prisma.avlTraversalSession.create({
    data: {
      userId,
      treeId: tree.id,
      currentNodeId: leafNode.id,
      answers: existing.answerPath as unknown as Prisma.InputJsonValue,
      status: "IN_PROGRESS",
    },
  });

  return {
    sessionId: session.id,
    status: "QUESTION",
    ...(leafNode.question != null ? { question: leafNode.question } : {}),
    questionTags: leafNode.questionTags,
    nodeId: leafNode.id,
    round: existing.profileRound + 1,
  };
}

/**
 * Answer a yes/no question in an active traversal session.
 * Navigates to the appropriate child and returns the next state.
 */
export async function answerQuestion(
  userId: string,
  sessionId: string,
  answer: boolean,
): Promise<AnswerResult> {
  const prisma = (await import("@/lib/prisma")).default;

  const session = await prisma.avlTraversalSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (session.userId !== userId) {
    throw new Error("Session does not belong to this user");
  }
  if (session.status !== "IN_PROGRESS") {
    throw new Error(`Session is ${session.status}, not IN_PROGRESS`);
  }

  const currentNode = await prisma.avlProfileNode.findUniqueOrThrow({
    where: { id: session.currentNodeId },
  });

  if (currentNode.nodeType !== "INTERNAL" || !currentNode.question) {
    throw new Error("Current node is not a question node");
  }

  // Record the answer
  const answers = session.answers as unknown as AnswerPathEntry[];
  answers.push({
    nodeId: currentNode.id,
    question: currentNode.question,
    questionTags: currentNode.questionTags,
    answer,
  });

  // Navigate to the appropriate child
  const nextNodeId = answer ? currentNode.yesChildId : currentNode.noChildId;
  if (!nextNodeId) {
    throw new Error(`Node ${currentNode.id} has no ${answer ? "yes" : "no"} child`);
  }

  const nextNode = await prisma.avlProfileNode.findUniqueOrThrow({
    where: { id: nextNodeId },
  });

  if (nextNode.nodeType === "INTERNAL") {
    // More questions to answer
    await prisma.avlTraversalSession.update({
      where: { id: sessionId },
      data: {
        currentNodeId: nextNode.id,
        answers: answers as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      sessionId,
      status: "QUESTION",
      ...(nextNode.question != null ? { question: nextNode.question } : {}),
      questionTags: nextNode.questionTags,
      nodeId: nextNode.id,
    };
  }

  // Reached a leaf
  if (nextNode.assignedUserId === null) {
    // Empty leaf — assign user
    await prisma.avlTraversalSession.update({
      where: { id: sessionId },
      data: {
        currentNodeId: nextNode.id,
        answers: answers as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
      },
    });

    return assignUserToLeaf(userId, nextNode.id, session.treeId, answers);
  }

  // Occupied leaf — resolve collision inline
  await prisma.avlTraversalSession.update({
    where: { id: sessionId },
    data: {
      currentNodeId: nextNode.id,
      answers: answers as unknown as Prisma.InputJsonValue,
    },
  });

  const { handleCollision } = await import("./insertion");

  const collisionResult = await handleCollision(sessionId, nextNode.assignedUserId, userId);

  // Ask the newly generated collision question
  return {
    sessionId,
    status: "QUESTION",
    question: collisionResult.question,
    questionTags: [],
    nodeId: collisionResult.newQuestionNodeId,
  };
}

/**
 * Get a user's AVL profile.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const prisma = (await import("@/lib/prisma")).default;

  const profile = await prisma.avlUserProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
    treeId: profile.treeId,
    leafNodeId: profile.leafNodeId,
    answerPath: profile.answerPath as unknown as AnswerPathEntry[],
    derivedTags: profile.derivedTags,
    profileVector: profile.profileVector as Record<string, number>,
    profileRound: profile.profileRound,
    completedAt: profile.completedAt,
  };
}

/**
 * Reset a user's profile, freeing their leaf node for reassignment.
 */
export async function resetUserProfile(userId: string): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;

  const profile = await prisma.avlUserProfile.findUnique({
    where: { userId },
  });

  // Even if no profile record, check if they are assigned to a node
  const assignedNode = await prisma.avlProfileNode.findUnique({
    where: { assignedUserId: userId },
  });

  if (!profile && !assignedNode) return;

  await prisma.$transaction(async (tx) => {
    if (assignedNode || profile) {
      // Free the leaf node
      await tx.avlProfileNode.updateMany({
        where: { assignedUserId: userId },
        data: { assignedUserId: null },
      });
    }

    if (profile) {
      // Delete profile
      await tx.avlUserProfile.delete({
        where: { userId },
      });

      // Decrement user count
      await tx.avlProfileTree.update({
        where: { id: profile.treeId },
        data: { userCount: { decrement: 1 } },
      });
    }

    // Delete traversal sessions
    await tx.avlTraversalSession.deleteMany({
      where: { userId },
    });
  });
}

/**
 * Assign a user to an empty leaf node and create their profile.
 */
async function assignUserToLeaf(
  userId: string,
  leafNodeId: string,
  treeId: string,
  answerPath: AnswerPathEntry[],
  round = 0,
): Promise<AnswerResult> {
  const prisma = (await import("@/lib/prisma")).default;
  const { deriveTagsFromAnswerPath, buildProfileVector } = await import("./personalization");

  // Collect all tags from the answer path for the profile vector
  const allTags = [...new Set(answerPath.flatMap((a) => a.questionTags))];

  // Ensure user is not assigned to any other node first
  await prisma.avlProfileNode.updateMany({
    where: { assignedUserId: userId },
    data: { assignedUserId: null },
  });

  await prisma.avlProfileNode.update({
    where: { id: leafNodeId },
    data: { assignedUserId: userId },
  });

  const derivedTags = deriveTagsFromAnswerPath(answerPath);
  const profileVector = buildProfileVector(answerPath, allTags);

  if (round > 0) {
    // Update existing profile for multi-visit
    const profile = await prisma.avlUserProfile.update({
      where: { userId },
      data: {
        leafNodeId,
        answerPath: answerPath as unknown as Prisma.InputJsonValue,
        derivedTags,
        profileVector,
        profileRound: round,
      },
    });

    return {
      sessionId: "",
      status: "ASSIGNED",
      profile: {
        id: profile.id,
        userId: profile.userId,
        treeId: profile.treeId,
        leafNodeId: profile.leafNodeId,
        answerPath,
        derivedTags: profile.derivedTags,
        profileVector: profile.profileVector as Record<string, number>,
        completedAt: profile.completedAt,
        profileRound: profile.profileRound,
      },
    };
  }

  const profile = await prisma.avlUserProfile.create({
    data: {
      userId,
      treeId,
      leafNodeId,
      answerPath: answerPath as unknown as Prisma.InputJsonValue,
      derivedTags,
      profileVector,
    },
  });

  await prisma.avlProfileTree.update({
    where: { id: treeId },
    data: { userCount: { increment: 1 } },
  });

  return {
    sessionId: "",
    status: "ASSIGNED",
    profile: {
      id: profile.id,
      userId: profile.userId,
      treeId: profile.treeId,
      leafNodeId: profile.leafNodeId,
      answerPath,
      derivedTags: profile.derivedTags,
      profileVector: profile.profileVector as Record<string, number>,
      completedAt: profile.completedAt,
      profileRound: 0,
    },
  };
}
