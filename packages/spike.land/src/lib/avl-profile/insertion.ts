/**
 * AVL Profile Tree Insertion
 *
 * Handles collisions when a new user reaches an occupied leaf.
 * Splits the leaf into an internal node with a differentiating question
 * and two new leaf children, then rebalances the tree.
 */

import type { Prisma } from "@/generated/prisma";
import type { AnswerPathEntry } from "./types";

/**
 * Handle a collision at an occupied leaf node.
 *
 * 1. Generate a differentiating question via AI
 * 2. Convert occupied leaf -> internal node with the new question
 * 3. Create 2 new leaf children (yes/no)
 * 4. The occupant's answer to the new question is inferred as "yes"
 *    (occupant goes to yes-child, new user goes to no-child)
 * 5. Rebalance the tree upward
 * 6. Update profiles for both users
 *
 * Runs in a Serializable transaction for concurrency safety.
 */
export async function handleCollision(
  sessionId: string,
  occupantUserId: string,
  newUserId: string,
): Promise<{
  newQuestionNodeId: string;
  occupantLeafId: string;
  newUserLeafId: string;
  question: string;
}> {
  const prisma = (await import("@/lib/prisma")).default;
  const { generateDifferentiatingQuestion } = await import("./question-generator");
  const { rebalanceUpward } = await import("./avl-rotations");
  const { deriveTagsFromAnswerPath, buildProfileVector } = await import("./personalization");

  // Load session to get answer path context
  const session = await prisma.avlTraversalSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const newUserAnswers = session.answers as unknown as AnswerPathEntry[];

  // Load occupant's profile for their answer path
  const occupantProfile = await prisma.avlUserProfile.findUnique({
    where: { userId: occupantUserId },
  });
  const occupantAnswers = occupantProfile
    ? (occupantProfile.answerPath as unknown as AnswerPathEntry[])
    : [];

  // Collect used questions to avoid duplicates
  const usedQuestions = [
    ...newUserAnswers.map((a) => a.question),
    ...occupantAnswers.map((a) => a.question),
  ];

  // Generate a differentiating question
  const generated = await generateDifferentiatingQuestion(newUserAnswers, usedQuestions);

  // Run the collision resolution in a serializable transaction
  return prisma.$transaction(
    async (tx) => {
      const collisionNode = await tx.avlProfileNode.findUniqueOrThrow({
        where: { id: session.currentNodeId },
      });

      // If the node is no longer a leaf (concurrent collision resolved it),
      // we can't split — the caller should retry traversal
      if (collisionNode.nodeType !== "LEAF") {
        throw new Error("RETRY_TRAVERSAL");
      }

      // Convert the collision leaf into an internal node
      // We do this first to free up the assignedUserId unique constraint
      await tx.avlProfileNode.update({
        where: { id: collisionNode.id },
        data: {
          nodeType: "INTERNAL",
          question: generated.question,
          questionTags: generated.tags,
          assignedUserId: null,
          height: 1,
          balanceFactor: 0,
        },
      });

      // Also unassign newUserId if they have any dangling assignments
      await tx.avlProfileNode.updateMany({
        where: { assignedUserId: newUserId },
        data: { assignedUserId: null },
      });

      // Create two new leaf nodes
      const yesLeaf = await tx.avlProfileNode.create({
        data: {
          treeId: collisionNode.treeId,
          nodeType: "LEAF",
          questionTags: [],
          parentId: collisionNode.id,
          height: 0,
          balanceFactor: 0,
          depth: collisionNode.depth + 1,
          assignedUserId: occupantUserId,
        },
      });

      const noLeaf = await tx.avlProfileNode.create({
        data: {
          treeId: collisionNode.treeId,
          nodeType: "LEAF",
          questionTags: [],
          parentId: collisionNode.id,
          height: 0,
          balanceFactor: 0,
          depth: collisionNode.depth + 1,
          assignedUserId: null,
        },
      });

      // Update the collision node with children IDs
      await tx.avlProfileNode.update({
        where: { id: collisionNode.id },
        data: {
          yesChildId: yesLeaf.id,
          noChildId: noLeaf.id,
        },
      });

      // Rebalance upward from the converted node
      await rebalanceUpward(collisionNode.id, tx);

      // Update occupant's profile with new leaf (assume occupant says YES to their own derived question)
      const occupantAnswerPath: AnswerPathEntry[] = [
        ...occupantAnswers,
        {
          nodeId: collisionNode.id,
          question: generated.question,
          questionTags: generated.tags,
          answer: true,
        },
      ];
      const occupantTags = deriveTagsFromAnswerPath(occupantAnswerPath);

      if (occupantProfile) {
        await tx.avlUserProfile.update({
          where: { userId: occupantUserId },
          data: {
            leafNodeId: yesLeaf.id,
            answerPath: occupantAnswerPath as unknown as Prisma.InputJsonValue,
            derivedTags: occupantTags,
            profileVector: buildProfileVector(occupantAnswerPath, []),
          },
        });
      } else {
        await tx.avlUserProfile.create({
          data: {
            userId: occupantUserId,
            treeId: collisionNode.treeId,
            leafNodeId: yesLeaf.id,
            answerPath: occupantAnswerPath as unknown as Prisma.InputJsonValue,
            derivedTags: occupantTags,
            profileVector: buildProfileVector(occupantAnswerPath, []),
          },
        });
      }

      // DO NOT create new user's profile or complete their session yet!
      // Leave the session IN_PROGRESS so they can answer the question.
      // They are currently at `collisionNode.id` which is now an INTERNAL node.

      // Update tree stats
      await tx.avlProfileTree.update({
        where: { id: collisionNode.treeId },
        data: {
          nodeCount: { increment: 2 },
          // Don't increment userCount yet, the new user hasn't finished profiling
        },
      });

      return {
        newQuestionNodeId: collisionNode.id,
        occupantLeafId: yesLeaf.id,
        newUserLeafId: noLeaf.id,
        question: generated.question,
      };
    },
    { isolationLevel: "Serializable", timeout: 20000, maxWait: 20000 },
  );
}
