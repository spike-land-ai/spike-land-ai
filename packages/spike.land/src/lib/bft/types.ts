/**
 * Byzantine Fault Tolerance (BFT) Simulator - Type Definitions
 *
 * PBFT-style consensus simulation with honest, silent, and equivocating node behaviors.
 * Demonstrates Byzantine agreement with f < n/3 fault tolerance.
 */

export type NodeBehavior = "honest" | "silent" | "equivocating";

export type PbftPhase = "idle" | "pre_prepare" | "prepare" | "commit" | "decided";

export interface PbftMessage {
  id: string;
  type: "pre_prepare" | "prepare" | "commit";
  viewNumber: number;
  sequenceNumber: number;
  nodeId: string;
  value: string;
  timestamp: number;
}

export interface BftNode {
  id: string;
  behavior: NodeBehavior;
  phase: PbftPhase;
  viewNumber: number;
  sequenceNumber: number;
  decidedValue: string | null;
  prepareMessages: PbftMessage[]; // collected prepare msgs
  commitMessages: PbftMessage[]; // collected commit msgs
}

export interface ConsensusRound {
  sequenceNumber: number;
  proposedValue: string;
  phase: PbftPhase;
  decided: boolean;
  decidedValue: string | null;
  messages: PbftMessage[];
}

export interface BftCluster {
  id: string;
  userId: string;
  name: string;
  nodes: Map<string, BftNode>;
  nodeOrder: string[];
  rounds: ConsensusRound[];
  currentView: number;
  currentSequence: number;
  messageLog: PbftMessage[];
  messageCounter: number;
  createdAt: number;
}

// Public view types
export interface ClusterSummary {
  id: string;
  name: string;
  nodeCount: number;
  honestCount: number;
  faultyCount: number;
  roundCount: number;
  createdAt: number;
}

export interface ClusterStateView {
  id: string;
  name: string;
  nodes: Array<{
    id: string;
    behavior: NodeBehavior;
    phase: PbftPhase;
    decidedValue: string | null;
  }>;
  currentRound: ConsensusRound | null;
  roundCount: number;
  faultTolerance: string; // e.g., "f=1 (tolerates 1 Byzantine node out of 4)"
}

export interface ConsensusResult {
  decided: boolean;
  value: string | null;
  phase: PbftPhase;
  prepareCount: number;
  commitCount: number;
  requiredQuorum: number;
}

export interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
}

export interface CreateClusterOptions {
  userId: string;
  name: string;
  nodeCount: number;
}
