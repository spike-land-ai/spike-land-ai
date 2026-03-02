/**
 * AVL Tree Rebalancing Operations
 *
 * Implements standard AVL rotations and rebalancing for the user profiling tree.
 * All operations work within a Prisma transaction on the AvlProfileNode model.
 */

import type { PrismaClient } from "@/generated/prisma";

export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Get the height of a node. Returns -1 for null/missing nodes.
 */
export async function getHeight(nodeId: string | null, tx: PrismaTransaction): Promise<number> {
  if (!nodeId) return -1;

  const node = await tx.avlProfileNode.findUnique({
    where: { id: nodeId },
    select: { height: true },
  });

  return node ? node.height : -1;
}

/**
 * Compute balance factor: yesChild.height - noChild.height
 */
export async function getBalanceFactor(nodeId: string, tx: PrismaTransaction): Promise<number> {
  const node = await tx.avlProfileNode.findUnique({
    where: { id: nodeId },
    select: { yesChildId: true, noChildId: true },
  });

  if (!node) return 0;

  const leftHeight = await getHeight(node.yesChildId, tx);
  const rightHeight = await getHeight(node.noChildId, tx);

  return leftHeight - rightHeight;
}

/**
 * Recalculate and persist height and balanceFactor from children's heights.
 */
export async function updateHeight(nodeId: string, tx: PrismaTransaction): Promise<void> {
  const node = await tx.avlProfileNode.findUnique({
    where: { id: nodeId },
    select: { yesChildId: true, noChildId: true },
  });

  if (!node) return;

  const leftHeight = await getHeight(node.yesChildId, tx);
  const rightHeight = await getHeight(node.noChildId, tx);
  const height = Math.max(leftHeight, rightHeight) + 1;
  const balanceFactor = leftHeight - rightHeight;

  await tx.avlProfileNode.update({
    where: { id: nodeId },
    data: { height, balanceFactor },
  });
}

/**
 * Right rotation: the yes-child becomes the new root of the subtree.
 *
 *       node            yesChild
 *      /    \           /      \
 *   yesChild  C  =>    A      node
 *   /    \                   /    \
 *  A      B                 B      C
 *
 * Returns the new root ID (yesChild's id).
 */
export async function rightRotate(nodeId: string, tx: PrismaTransaction): Promise<string> {
  const node = await tx.avlProfileNode.findUniqueOrThrow({
    where: { id: nodeId },
    select: {
      id: true,
      yesChildId: true,
      parentId: true,
      treeId: true,
    },
  });

  if (!node.yesChildId) {
    throw new Error(`Cannot right-rotate node ${nodeId}: no yes-child`);
  }

  const yesChild = await tx.avlProfileNode.findUniqueOrThrow({
    where: { id: node.yesChildId },
    select: { id: true, noChildId: true },
  });

  const bSubtreeId = yesChild.noChildId;

  // yesChild takes node's position: adopt node's parent
  await tx.avlProfileNode.update({
    where: { id: yesChild.id },
    data: {
      parentId: node.parentId,
      noChildId: node.id,
    },
  });

  // node becomes yesChild's no-child; its yes-child becomes B
  await tx.avlProfileNode.update({
    where: { id: node.id },
    data: {
      parentId: yesChild.id,
      yesChildId: bSubtreeId,
    },
  });

  // B subtree's parent changes to node
  if (bSubtreeId) {
    await tx.avlProfileNode.update({
      where: { id: bSubtreeId },
      data: { parentId: node.id },
    });
  }

  // Update the old parent's child pointer to yesChild
  if (node.parentId) {
    const parent = await tx.avlProfileNode.findUniqueOrThrow({
      where: { id: node.parentId },
      select: { yesChildId: true, noChildId: true },
    });

    if (parent.yesChildId === node.id) {
      await tx.avlProfileNode.update({
        where: { id: node.parentId },
        data: { yesChildId: yesChild.id },
      });
    } else if (parent.noChildId === node.id) {
      await tx.avlProfileNode.update({
        where: { id: node.parentId },
        data: { noChildId: yesChild.id },
      });
    }
  }

  // Recalculate heights (node first since it is now lower)
  await updateHeight(node.id, tx);
  await updateHeight(yesChild.id, tx);

  return yesChild.id;
}

/**
 * Left rotation: the no-child becomes the new root of the subtree.
 *
 *     node              noChild
 *    /    \             /      \
 *   A    noChild  =>  node      C
 *         /   \      /    \
 *        B     C    A      B
 *
 * Returns the new root ID (noChild's id).
 */
export async function leftRotate(nodeId: string, tx: PrismaTransaction): Promise<string> {
  const node = await tx.avlProfileNode.findUniqueOrThrow({
    where: { id: nodeId },
    select: {
      id: true,
      noChildId: true,
      parentId: true,
      treeId: true,
    },
  });

  if (!node.noChildId) {
    throw new Error(`Cannot left-rotate node ${nodeId}: no no-child`);
  }

  const noChild = await tx.avlProfileNode.findUniqueOrThrow({
    where: { id: node.noChildId },
    select: { id: true, yesChildId: true },
  });

  const bSubtreeId = noChild.yesChildId;

  // noChild takes node's position: adopt node's parent
  await tx.avlProfileNode.update({
    where: { id: noChild.id },
    data: {
      parentId: node.parentId,
      yesChildId: node.id,
    },
  });

  // node becomes noChild's yes-child; its no-child becomes B
  await tx.avlProfileNode.update({
    where: { id: node.id },
    data: {
      parentId: noChild.id,
      noChildId: bSubtreeId,
    },
  });

  // B subtree's parent changes to node
  if (bSubtreeId) {
    await tx.avlProfileNode.update({
      where: { id: bSubtreeId },
      data: { parentId: node.id },
    });
  }

  // Update the old parent's child pointer to noChild
  if (node.parentId) {
    const parent = await tx.avlProfileNode.findUniqueOrThrow({
      where: { id: node.parentId },
      select: { yesChildId: true, noChildId: true },
    });

    if (parent.yesChildId === node.id) {
      await tx.avlProfileNode.update({
        where: { id: node.parentId },
        data: { yesChildId: noChild.id },
      });
    } else if (parent.noChildId === node.id) {
      await tx.avlProfileNode.update({
        where: { id: node.parentId },
        data: { noChildId: noChild.id },
      });
    }
  }

  // Recalculate heights (node first since it is now lower)
  await updateHeight(node.id, tx);
  await updateHeight(noChild.id, tx);

  return noChild.id;
}

/**
 * Rebalance a single node if its balance factor is outside [-1, 1].
 *
 * Handles all four AVL cases:
 * - Left-Left  (bf > 1, yes-child bf >= 0): right rotate
 * - Left-Right (bf > 1, yes-child bf < 0):  left rotate yes-child, then right rotate
 * - Right-Right (bf < -1, no-child bf <= 0): left rotate
 * - Right-Left  (bf < -1, no-child bf > 0): right rotate no-child, then left rotate
 *
 * Returns the (possibly new) root ID of this subtree.
 */
export async function rebalance(nodeId: string, tx: PrismaTransaction): Promise<string> {
  const bf = await getBalanceFactor(nodeId, tx);

  if (bf > 1) {
    // Left-heavy
    const node = await tx.avlProfileNode.findUniqueOrThrow({
      where: { id: nodeId },
      select: { yesChildId: true },
    });

    if (node.yesChildId) {
      const childBf = await getBalanceFactor(node.yesChildId, tx);

      // Left-Right case: left rotate the yes-child first
      if (childBf < 0) {
        const newYesChildId = await leftRotate(node.yesChildId, tx);
        await tx.avlProfileNode.update({
          where: { id: nodeId },
          data: { yesChildId: newYesChildId },
        });
      }
    }

    return rightRotate(nodeId, tx);
  }

  if (bf < -1) {
    // Right-heavy
    const node = await tx.avlProfileNode.findUniqueOrThrow({
      where: { id: nodeId },
      select: { noChildId: true },
    });

    if (node.noChildId) {
      const childBf = await getBalanceFactor(node.noChildId, tx);

      // Right-Left case: right rotate the no-child first
      if (childBf > 0) {
        const newNoChildId = await rightRotate(node.noChildId, tx);
        await tx.avlProfileNode.update({
          where: { id: nodeId },
          data: { noChildId: newNoChildId },
        });
      }
    }

    return leftRotate(nodeId, tx);
  }

  // Already balanced
  return nodeId;
}

/**
 * Walk from a node up to the root, updating heights and rebalancing at each step.
 * If a rotation changes a subtree root, updates the parent's child pointer
 * and the tree's rootNodeId if necessary.
 */
export async function rebalanceUpward(nodeId: string, tx: PrismaTransaction): Promise<void> {
  let currentId: string | null = nodeId;

  while (currentId) {
    // Fetch the node to know its parent before any rotation
    const current: { id: string; parentId: string | null; treeId: string } | null =
      await tx.avlProfileNode.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true, treeId: true },
      });

    if (!current) break;

    await updateHeight(currentId, tx);
    const newRootId = await rebalance(currentId, tx);

    // If rotation changed the subtree root, update the tree's rootNodeId
    // when this was the root node (no parent)
    if (newRootId !== currentId && !current.parentId) {
      await tx.avlProfileTree.update({
        where: { id: current.treeId },
        data: { rootNodeId: newRootId },
      });
    }

    // Parent pointer updates are already handled inside rightRotate/leftRotate.
    // Move to the parent (of the original node before rotation).
    currentId = current.parentId;
  }
}
