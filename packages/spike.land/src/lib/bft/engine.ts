/**
 * Byzantine Fault Tolerance (BFT) Simulator - Simulation Engine
 *
 * Pure business logic with in-memory storage.
 * Deterministic simulation of PBFT-style consensus with configurable node behaviors.
 */

import type {
  BftCluster,
  BftNode,
  ClusterStateView,
  ClusterSummary,
  ConsensusResult,
  ConsensusRound,
  CreateClusterOptions,
  NodeBehavior,
  PbftMessage,
  SafetyCheckResult,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const clusters = new Map<string, BftCluster>();

export function clearClusters(): void {
  clusters.clear();
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  return `bft-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateMessageId(cluster: BftCluster): string {
  cluster.messageCounter++;
  return `msg-${cluster.messageCounter}`;
}

/**
 * Maximum number of Byzantine faults tolerated: f = floor((n - 1) / 3)
 */
function maxFaults(nodeCount: number): number {
  return Math.floor((nodeCount - 1) / 3);
}

/**
 * Quorum size required for prepare/commit phases: 2f + 1
 */
function quorumSize(nodeCount: number): number {
  const f = maxFaults(nodeCount);
  return 2 * f + 1;
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

function getCluster(clusterId: string, userId: string): BftCluster {
  const cluster = clusters.get(clusterId);
  if (!cluster) throw new Error(`Cluster ${clusterId} not found`);
  if (cluster.userId !== userId) throw new Error("Access denied");
  return cluster;
}

function getNode(cluster: BftCluster, nodeId: string): BftNode {
  const node = cluster.nodes.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);
  return node;
}

function getRound(cluster: BftCluster, roundSeq: number): ConsensusRound {
  const round = cluster.rounds.find((r) => r.sequenceNumber === roundSeq);
  if (!round) throw new Error(`Round ${roundSeq} not found`);
  return round;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createCluster(opts: CreateClusterOptions): BftCluster {
  if (opts.nodeCount < 4) {
    throw new Error("Node count must be at least 4 (need 3f+1 for BFT)");
  }

  const id = generateId();
  const nodes = new Map<string, BftNode>();
  const nodeOrder: string[] = [];

  for (let i = 1; i <= opts.nodeCount; i++) {
    const nodeId = `node-${i}`;
    nodes.set(nodeId, {
      id: nodeId,
      behavior: "honest",
      phase: "idle",
      viewNumber: 0,
      sequenceNumber: 0,
      decidedValue: null,
      prepareMessages: [],
      commitMessages: [],
    });
    nodeOrder.push(nodeId);
  }

  const cluster: BftCluster = {
    id,
    userId: opts.userId,
    name: opts.name,
    nodes,
    nodeOrder,
    rounds: [],
    currentView: 0,
    currentSequence: 0,
    messageLog: [],
    messageCounter: 0,
    createdAt: Date.now(),
  };

  clusters.set(id, cluster);
  return cluster;
}

export function destroyCluster(clusterId: string, userId: string): void {
  const cluster = getCluster(clusterId, userId);
  clusters.delete(cluster.id);
}

export function listClusters(userId: string): ClusterSummary[] {
  const result: ClusterSummary[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.userId !== userId) continue;
    let honestCount = 0;
    let faultyCount = 0;
    for (const node of cluster.nodes.values()) {
      if (node.behavior === "honest") {
        honestCount++;
      } else {
        faultyCount++;
      }
    }
    result.push({
      id: cluster.id,
      name: cluster.name,
      nodeCount: cluster.nodeOrder.length,
      honestCount,
      faultyCount,
      roundCount: cluster.rounds.length,
      createdAt: cluster.createdAt,
    });
  }
  return result;
}

export function setBehavior(
  clusterId: string,
  userId: string,
  nodeId: string,
  behavior: NodeBehavior,
): { node: BftNode; warning: string | null } {
  const cluster = getCluster(clusterId, userId);
  const node = getNode(cluster, nodeId);

  node.behavior = behavior;

  // Count honest nodes after the change
  let honestCount = 0;
  for (const n of cluster.nodes.values()) {
    if (n.behavior === "honest") {
      honestCount++;
    }
  }

  const f = maxFaults(cluster.nodeOrder.length);
  const requiredHonest = 2 * f + 1;
  let warning: string | null = null;

  if (honestCount < requiredHonest) {
    warning =
      `Warning: only ${honestCount} honest nodes remain, but ${requiredHonest} are needed ` +
      `for safety (f=${f}, n=${cluster.nodeOrder.length}). Consensus may fail.`;
  }

  return { node, warning };
}

export function propose(clusterId: string, userId: string, value: string): ConsensusRound {
  const cluster = getCluster(clusterId, userId);

  cluster.currentSequence++;
  const seqNum = cluster.currentSequence;

  // Leader is always node-1 in the current view
  const leaderId = cluster.nodeOrder[0]!;
  const leader = cluster.nodes.get(leaderId)!;

  // Create pre_prepare message from leader
  const prePrepareMsg: PbftMessage = {
    id: generateMessageId(cluster),
    type: "pre_prepare",
    viewNumber: cluster.currentView,
    sequenceNumber: seqNum,
    nodeId: leaderId,
    value,
    timestamp: Date.now(),
  };

  cluster.messageLog.push(prePrepareMsg);

  // Update leader phase
  leader.phase = "pre_prepare";
  leader.sequenceNumber = seqNum;

  // Create the round
  const round: ConsensusRound = {
    sequenceNumber: seqNum,
    proposedValue: value,
    phase: "pre_prepare",
    decided: false,
    decidedValue: null,
    messages: [prePrepareMsg],
  };

  cluster.rounds.push(round);

  // Move all nodes to pre_prepare phase
  for (const node of cluster.nodes.values()) {
    node.phase = "pre_prepare";
    node.sequenceNumber = seqNum;
    node.prepareMessages = [];
    node.commitMessages = [];
  }

  return round;
}

export function runPreparePhase(
  clusterId: string,
  userId: string,
  roundSeq: number,
): ConsensusRound {
  const cluster = getCluster(clusterId, userId);
  const round = getRound(cluster, roundSeq);

  if (round.phase !== "pre_prepare") {
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "pre_prepare"`);
  }

  const prepareMessages: PbftMessage[] = [];

  for (let i = 0; i < cluster.nodeOrder.length; i++) {
    const nodeId = cluster.nodeOrder[i]!;
    const node = cluster.nodes.get(nodeId)!;

    if (node.behavior === "silent") {
      // Silent nodes do not send prepare messages
      continue;
    }

    if (node.behavior === "equivocating") {
      // Equivocating nodes send different values to different peers
      // For simulation: send alternate values based on target index
      const equivocValue = `${round.proposedValue}-EQUIVOC-${nodeId}`;
      const msg: PbftMessage = {
        id: generateMessageId(cluster),
        type: "prepare",
        viewNumber: cluster.currentView,
        sequenceNumber: roundSeq,
        nodeId,
        value: equivocValue,
        timestamp: Date.now(),
      };
      prepareMessages.push(msg);
      cluster.messageLog.push(msg);
      continue;
    }

    // Honest node: send prepare with the proposed value
    const msg: PbftMessage = {
      id: generateMessageId(cluster),
      type: "prepare",
      viewNumber: cluster.currentView,
      sequenceNumber: roundSeq,
      nodeId,
      value: round.proposedValue,
      timestamp: Date.now(),
    };
    prepareMessages.push(msg);
    cluster.messageLog.push(msg);
  }

  // Distribute prepare messages to all nodes
  for (const node of cluster.nodes.values()) {
    node.phase = "prepare";
    node.prepareMessages = [...prepareMessages];
  }

  round.messages.push(...prepareMessages);
  round.phase = "prepare";

  return round;
}

export function runCommitPhase(
  clusterId: string,
  userId: string,
  roundSeq: number,
): ConsensusRound {
  const cluster = getCluster(clusterId, userId);
  const round = getRound(cluster, roundSeq);

  if (round.phase !== "prepare") {
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "prepare"`);
  }

  const n = cluster.nodeOrder.length;
  const q = quorumSize(n);
  const commitMessages: PbftMessage[] = [];

  for (const nodeId of cluster.nodeOrder) {
    const node = cluster.nodes.get(nodeId)!;

    if (node.behavior === "silent") {
      // Silent nodes do not send commit messages
      continue;
    }

    // Count how many prepare messages match the proposed value
    const matchingPrepares = node.prepareMessages.filter(
      (m) => m.value === round.proposedValue,
    ).length;

    if (node.behavior === "equivocating") {
      // Equivocating nodes send commit with a different value
      const equivocValue = `${round.proposedValue}-EQUIVOC-${nodeId}`;
      const msg: PbftMessage = {
        id: generateMessageId(cluster),
        type: "commit",
        viewNumber: cluster.currentView,
        sequenceNumber: roundSeq,
        nodeId,
        value: equivocValue,
        timestamp: Date.now(),
      };
      commitMessages.push(msg);
      cluster.messageLog.push(msg);
      continue;
    }

    // Honest node: only send commit if quorum of matching prepares received
    if (matchingPrepares >= q) {
      const msg: PbftMessage = {
        id: generateMessageId(cluster),
        type: "commit",
        viewNumber: cluster.currentView,
        sequenceNumber: roundSeq,
        nodeId,
        value: round.proposedValue,
        timestamp: Date.now(),
      };
      commitMessages.push(msg);
      cluster.messageLog.push(msg);
    }
  }

  // Distribute commit messages to all nodes
  for (const node of cluster.nodes.values()) {
    node.phase = "commit";
    node.commitMessages = [...commitMessages];
  }

  round.messages.push(...commitMessages);
  round.phase = "commit";

  return round;
}

export function checkConsensus(
  clusterId: string,
  userId: string,
  roundSeq: number,
): ConsensusResult {
  const cluster = getCluster(clusterId, userId);
  const round = getRound(cluster, roundSeq);

  if (round.phase !== "commit") {
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "commit"`);
  }

  const n = cluster.nodeOrder.length;
  const q = quorumSize(n);

  // Count prepare messages that match the proposed value
  const prepareCount = round.messages.filter(
    (m) => m.type === "prepare" && m.value === round.proposedValue,
  ).length;

  // Count commit messages that match the proposed value
  const commitCount = round.messages.filter(
    (m) => m.type === "commit" && m.value === round.proposedValue,
  ).length;

  const decided = commitCount >= q;

  if (decided) {
    round.decided = true;
    round.decidedValue = round.proposedValue;
    round.phase = "decided";

    // Update all honest nodes that have enough matching commits
    for (const node of cluster.nodes.values()) {
      const nodeMatchingCommits = node.commitMessages.filter(
        (m) => m.value === round.proposedValue,
      ).length;

      if (nodeMatchingCommits >= q && node.behavior === "honest") {
        node.decidedValue = round.proposedValue;
        node.phase = "decided";
      }
    }
  }

  return {
    decided,
    value: decided ? round.proposedValue : null,
    phase: round.phase,
    prepareCount,
    commitCount,
    requiredQuorum: q,
  };
}

export function runFullRound(clusterId: string, userId: string, value: string): ConsensusResult {
  const cluster = getCluster(clusterId, userId);

  propose(cluster.id, userId, value);
  const seqNum = cluster.currentSequence;
  runPreparePhase(cluster.id, userId, seqNum);
  runCommitPhase(cluster.id, userId, seqNum);
  return checkConsensus(cluster.id, userId, seqNum);
}

export function inspect(clusterId: string, userId: string): ClusterStateView {
  const cluster = getCluster(clusterId, userId);
  const n = cluster.nodeOrder.length;
  const f = maxFaults(n);

  const nodes = cluster.nodeOrder.map((nodeId) => {
    const node = cluster.nodes.get(nodeId)!;
    return {
      id: node.id,
      behavior: node.behavior,
      phase: node.phase,
      decidedValue: node.decidedValue,
    };
  });

  const currentRound =
    cluster.rounds.length > 0 ? cluster.rounds[cluster.rounds.length - 1]! : null;

  return {
    id: cluster.id,
    name: cluster.name,
    nodes,
    currentRound,
    roundCount: cluster.rounds.length,
    faultTolerance: `f=${f} (tolerates ${f} Byzantine node${f !== 1 ? "s" : ""} out of ${n})`,
  };
}

export function checkSafety(clusterId: string, userId: string): SafetyCheckResult {
  const cluster = getCluster(clusterId, userId);
  const issues: string[] = [];
  const n = cluster.nodeOrder.length;
  const f = maxFaults(n);

  // Check 1: Count faulty nodes
  let faultyCount = 0;
  for (const node of cluster.nodes.values()) {
    if (node.behavior !== "honest") {
      faultyCount++;
    }
  }

  if (faultyCount > f) {
    issues.push(
      `Too many faulty nodes: ${faultyCount} faulty, but maximum tolerable is ${f} (n=${n})`,
    );
  }

  // Check 2: No two honest nodes should have decided different values
  const honestDecisions: Array<{ nodeId: string; value: string }> = [];
  for (const node of cluster.nodes.values()) {
    if (node.behavior === "honest" && node.decidedValue !== null) {
      honestDecisions.push({ nodeId: node.id, value: node.decidedValue });
    }
  }

  for (let i = 0; i < honestDecisions.length; i++) {
    for (let j = i + 1; j < honestDecisions.length; j++) {
      const a = honestDecisions[i]!;
      const b = honestDecisions[j]!;
      if (a.value !== b.value) {
        issues.push(
          `Safety violation: honest node ${a.nodeId} decided "${a.value}" but honest node ${b.nodeId} decided "${b.value}"`,
        );
      }
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}
