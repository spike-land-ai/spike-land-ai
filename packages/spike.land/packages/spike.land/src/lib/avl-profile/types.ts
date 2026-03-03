/**
 * AVL Profile Tree Types
 *
 * Type definitions for the AVL-tree-based user profiling system.
 */

export interface AnswerPathEntry {
  nodeId: string;
  question: string;
  questionTags: string[];
  answer: boolean;
}

export interface TreeNode {
  id: string;
  treeId: string;
  nodeType: "INTERNAL" | "LEAF";
  question: string | null;
  questionTags: string[];
  parentId: string | null;
  yesChildId: string | null;
  noChildId: string | null;
  height: number;
  balanceFactor: number;
  depth: number;
  assignedUserId: string | null;
}

export interface TraversalResult {
  sessionId: string;
  status: "QUESTION" | "ASSIGNED" | "ALREADY_PROFILED" | "COLLISION";
  question?: string;
  questionTags?: string[];
  nodeId?: string;
  round?: number;
  profile?: UserProfile;
}

export interface AnswerResult {
  sessionId: string;
  status: "QUESTION" | "ASSIGNED" | "COLLISION";
  question?: string;
  questionTags?: string[];
  nodeId?: string;
  round?: number;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  userId: string;
  treeId: string;
  leafNodeId: string;
  answerPath: AnswerPathEntry[];
  derivedTags: string[];
  profileVector: Record<string, number>;
  profileRound?: number;
  completedAt: Date;
}

export interface TreeStats {
  name: string;
  nodeCount: number;
  userCount: number;
  maxDepth: number;
  internalNodes: number;
  leafNodes: number;
  emptyLeaves: number;
  occupiedLeaves: number;
}

export interface SeedQuestion {
  question: string;
  tags: string[];
}

export interface GeneratedQuestion {
  question: string;
  tags: string[];
}
