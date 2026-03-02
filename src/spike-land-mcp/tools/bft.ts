/**
 * Byzantine Fault Tolerance (BFT) Simulator MCP Tools
 *
 * PBFT-style consensus simulation with honest, silent, and equivocating behaviors.
 * Ported from spike.land — pure in-memory computation, no DB needed.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeBehavior = "honest" | "silent" | "equivocating";
type PbftPhase = "idle" | "pre_prepare" | "prepare" | "commit" | "decided";

interface PbftMessage {
  id: string;
  type: "pre_prepare" | "prepare" | "commit";
  viewNumber: number;
  sequenceNumber: number;
  nodeId: string;
  value: string;
  timestamp: number;
}

interface BftNode {
  id: string;
  behavior: NodeBehavior;
  phase: PbftPhase;
  viewNumber: number;
  sequenceNumber: number;
  decidedValue: string | null;
  prepareMessages: PbftMessage[];
  commitMessages: PbftMessage[];
}

interface ConsensusRound {
  sequenceNumber: number;
  proposedValue: string;
  phase: PbftPhase;
  decided: boolean;
  decidedValue: string | null;
  messages: PbftMessage[];
}

interface BftCluster {
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

// ─── In-memory storage ───────────────────────────────────────────────────────

const clusters = new Map<string, BftCluster>();

export function clearClusters(): void {
  clusters.clear();
  idCounter = 0;
}

let idCounter = 0;

function generateId(): string {
  return `bft-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateMessageId(cluster: BftCluster): string {
  cluster.messageCounter++;
  return `msg-${cluster.messageCounter}`;
}

function maxFaults(nodeCount: number): number {
  return Math.floor((nodeCount - 1) / 3);
}

function quorumSize(nodeCount: number): number {
  return 2 * maxFaults(nodeCount) + 1;
}

function getCluster(clusterId: string, userId: string): BftCluster {
  const cluster = clusters.get(clusterId);
  if (!cluster) throw new Error(`Cluster ${clusterId} not found`);
  if (cluster.userId !== userId) throw new Error("Access denied");
  return cluster;
}

function getRound(cluster: BftCluster, roundSeq: number): ConsensusRound {
  const round = cluster.rounds.find((r) => r.sequenceNumber === roundSeq);
  if (!round) throw new Error(`Round ${roundSeq} not found`);
  return round;
}

// ─── Internal engine functions ───────────────────────────────────────────────

function doPropose(cluster: BftCluster, value: string): ConsensusRound {
  cluster.currentSequence++;
  const seqNum = cluster.currentSequence;
  const leaderId = cluster.nodeOrder[0]!;
  const leader = cluster.nodes.get(leaderId)!;
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
  leader.phase = "pre_prepare";
  leader.sequenceNumber = seqNum;
  const round: ConsensusRound = {
    sequenceNumber: seqNum,
    proposedValue: value,
    phase: "pre_prepare",
    decided: false,
    decidedValue: null,
    messages: [prePrepareMsg],
  };
  cluster.rounds.push(round);
  for (const node of cluster.nodes.values()) {
    node.phase = "pre_prepare";
    node.sequenceNumber = seqNum;
    node.prepareMessages = [];
    node.commitMessages = [];
  }
  return round;
}

function doPrepare(cluster: BftCluster, roundSeq: number): ConsensusRound {
  const round = getRound(cluster, roundSeq);
  if (round.phase !== "pre_prepare")
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "pre_prepare"`);
  const prepareMessages: PbftMessage[] = [];
  for (const nodeId of cluster.nodeOrder) {
    const node = cluster.nodes.get(nodeId)!;
    if (node.behavior === "silent") continue;
    if (node.behavior === "equivocating") {
      const msg: PbftMessage = {
        id: generateMessageId(cluster),
        type: "prepare",
        viewNumber: cluster.currentView,
        sequenceNumber: roundSeq,
        nodeId,
        value: `${round.proposedValue}-EQUIVOC-${nodeId}`,
        timestamp: Date.now(),
      };
      prepareMessages.push(msg);
      cluster.messageLog.push(msg);
      continue;
    }
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
  for (const node of cluster.nodes.values()) {
    node.phase = "prepare";
    node.prepareMessages = [...prepareMessages];
  }
  round.messages.push(...prepareMessages);
  round.phase = "prepare";
  return round;
}

function doCommit(cluster: BftCluster, roundSeq: number): ConsensusRound {
  const round = getRound(cluster, roundSeq);
  if (round.phase !== "prepare")
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "prepare"`);
  const n = cluster.nodeOrder.length;
  const q = quorumSize(n);
  const commitMessages: PbftMessage[] = [];
  for (const nodeId of cluster.nodeOrder) {
    const node = cluster.nodes.get(nodeId)!;
    if (node.behavior === "silent") continue;
    if (node.behavior === "equivocating") {
      const msg: PbftMessage = {
        id: generateMessageId(cluster),
        type: "commit",
        viewNumber: cluster.currentView,
        sequenceNumber: roundSeq,
        nodeId,
        value: `${round.proposedValue}-EQUIVOC-${nodeId}`,
        timestamp: Date.now(),
      };
      commitMessages.push(msg);
      cluster.messageLog.push(msg);
      continue;
    }
    const matchingPrepares = node.prepareMessages.filter(
      (m) => m.value === round.proposedValue,
    ).length;
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
  for (const node of cluster.nodes.values()) {
    node.phase = "commit";
    node.commitMessages = [...commitMessages];
  }
  round.messages.push(...commitMessages);
  round.phase = "commit";
  return round;
}

interface ConsensusResult {
  decided: boolean;
  value: string | null;
  phase: PbftPhase;
  prepareCount: number;
  commitCount: number;
  requiredQuorum: number;
}

function doCheckConsensus(cluster: BftCluster, roundSeq: number): ConsensusResult {
  const round = getRound(cluster, roundSeq);
  if (round.phase !== "commit")
    throw new Error(`Round ${roundSeq} is in phase "${round.phase}", expected "commit"`);
  const n = cluster.nodeOrder.length;
  const q = quorumSize(n);
  const prepareCount = round.messages.filter(
    (m) => m.type === "prepare" && m.value === round.proposedValue,
  ).length;
  const commitCount = round.messages.filter(
    (m) => m.type === "commit" && m.value === round.proposedValue,
  ).length;
  const decided = commitCount >= q;
  if (decided) {
    round.decided = true;
    round.decidedValue = round.proposedValue;
    round.phase = "decided";
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

// ─── Registration ────────────────────────────────────────────────────────────

const BehaviorEnum = z
  .enum(["honest", "silent", "equivocating"])
  .describe("Node behavior: honest, silent, or equivocating.");

export function registerBftTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "bft_create_cluster",
        "Create a PBFT cluster with N nodes (all honest initially). Requires N >= 4.",
        {
          name: z.string().min(1).describe("Name for the BFT cluster."),
          node_count: z.number().int().min(4).max(10).describe("Number of nodes (4-10)."),
        },
      )
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const id = generateId();
        const nodes = new Map<string, BftNode>();
        const nodeOrder: string[] = [];
        for (let i = 1; i <= input.node_count; i++) {
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
          userId,
          name: input.name,
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
        const f = maxFaults(input.node_count);
        return textResult(
          `**BFT Cluster Created**\n\n**ID:** ${cluster.id}\n**Name:** ${cluster.name}\n**Nodes:** ${cluster.nodeOrder.join(", ")}\n**Fault Tolerance:** f=${f} (tolerates ${f} Byzantine node(s) out of ${input.node_count})\n\nAll nodes are honest. Use \`bft_set_behavior\` to simulate Byzantine faults.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_set_behavior", "Change a node's behavior.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
        node_id: z.string().min(1).describe("Node ID."),
        behavior: BehaviorEnum,
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const node = cluster.nodes.get(input.node_id);
        if (!node) throw new Error(`Node ${input.node_id} not found`);
        node.behavior = input.behavior;
        return textResult(
          `**Node Behavior Updated**\n\n**Node:** ${input.node_id}\n**Behavior:** ${input.behavior}\n\n${input.behavior !== "honest" ? "Warning: This node will now behave as a Byzantine fault." : "This node will follow the PBFT protocol faithfully."}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_propose", "Leader proposes a value for consensus.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
        value: z.string().min(1).describe("Value to propose."),
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const round = doPropose(cluster, input.value);
        return textResult(
          `**Consensus Round Started**\n\n**Sequence:** ${round.sequenceNumber}\n**Proposed Value:** ${round.proposedValue}\n**Phase:** ${round.phase}\n**Messages:** ${round.messages.length}\n\nUse \`bft_run_prepare\` to advance.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_run_prepare", "Run the prepare phase for a consensus round.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
        sequence_number: z.number().int().min(1).describe("Sequence number of the round."),
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const round = doPrepare(cluster, input.sequence_number);
        return textResult(
          `**Prepare Phase Complete**\n\n**Sequence:** ${round.sequenceNumber}\n**Phase:** ${round.phase}\n**Prepare Messages:** ${round.messages.filter((m) => m.type === "prepare").length}\n\nUse \`bft_run_commit\` to advance.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_run_commit", "Run the commit phase for a consensus round.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
        sequence_number: z.number().int().min(1).describe("Sequence number of the round."),
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const round = doCommit(cluster, input.sequence_number);
        return textResult(
          `**Commit Phase Complete**\n\n**Sequence:** ${round.sequenceNumber}\n**Phase:** ${round.phase}\n**Commit Messages:** ${round.messages.filter((m) => m.type === "commit").length}\n\nUse \`bft_check_consensus\` to check.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_check_consensus", "Check if a consensus round reached agreement.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
        sequence_number: z.number().int().min(1).describe("Sequence number of the round."),
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const result = doCheckConsensus(cluster, input.sequence_number);
        return textResult(
          `**Consensus Check**\n\n**Decided:** ${result.decided ? "YES" : "NO"}\n**Value:** ${result.value ?? "(none)"}\n**Phase:** ${result.phase}\n**Prepare Count:** ${result.prepareCount}\n**Commit Count:** ${result.commitCount}\n**Required Quorum:** ${result.requiredQuorum}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "bft_run_full_round",
        "Run a complete PBFT consensus round: propose -> prepare -> commit -> check.",
        {
          cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
          value: z.string().min(1).describe("Value to propose."),
        },
      )
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        doPropose(cluster, input.value);
        const seqNum = cluster.currentSequence;
        doPrepare(cluster, seqNum);
        doCommit(cluster, seqNum);
        const result = doCheckConsensus(cluster, seqNum);
        return textResult(
          `**Full Consensus Round**\n\n**Decided:** ${result.decided ? "YES" : "NO"}\n**Value:** ${result.value ?? "(none)"}\n**Phase:** ${result.phase}\n**Prepare Count:** ${result.prepareCount}\n**Commit Count:** ${result.commitCount}\n**Required Quorum:** ${result.requiredQuorum}\n\n${result.decided ? `Consensus reached! All honest nodes agreed on "${result.value}".` : `Consensus NOT reached. Quorum not met (need ${result.requiredQuorum}).`}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("bft_inspect", "Inspect the BFT cluster state.", {
        cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
      })
      .meta({ category: "bft", tier: "free" })
      .handler(async ({ input }) => {
        const cluster = getCluster(input.cluster_id, userId);
        const n = cluster.nodeOrder.length;
        const f = maxFaults(n);
        const nodeRows = cluster.nodeOrder
          .map((nodeId) => {
            const node = cluster.nodes.get(nodeId)!;
            return `| ${node.id} | ${node.behavior} | ${node.phase} | ${node.decidedValue ?? "-"} |`;
          })
          .join("\n");
        return textResult(
          `**BFT Cluster: ${cluster.name}**\n\n**Fault Tolerance:** f=${f} (tolerates ${f} Byzantine node(s) out of ${n})\n**Rounds:** ${cluster.rounds.length}\n\n| Node | Behavior | Phase | Decided |\n|---|---|---|---|\n${nodeRows}`,
        );
      }),
  );
}
