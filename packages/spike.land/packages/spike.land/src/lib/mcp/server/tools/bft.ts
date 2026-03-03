import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// Re-export for test cleanup
export { clearClusters } from "@/lib/bft/engine";

// --- Zod schemas ---

const BehaviorEnum = z
  .enum(["honest", "silent", "equivocating"])
  .describe(
    "Node behavior: honest (follows protocol), silent (drops all messages), equivocating (sends conflicting messages).",
  );

const CreateClusterSchema = z.object({
  name: z.string().min(1).describe("Name for the BFT cluster."),
  node_count: z
    .number()
    .int()
    .min(4)
    .max(10)
    .describe(
      "Number of nodes (4-10). Must be >= 3f+1 for f Byzantine faults.",
    ),
});

const SetBehaviorSchema = z.object({
  cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
  node_id: z.string().min(1).describe("Node ID to change behavior."),
  behavior: BehaviorEnum,
});

const ProposeSchema = z.object({
  cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
  value: z
    .string()
    .min(1)
    .describe("Value to propose for consensus."),
});

const RoundRefSchema = z.object({
  cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
  sequence_number: z
    .number()
    .int()
    .min(1)
    .describe("Sequence number of the consensus round."),
});

const FullRoundSchema = z.object({
  cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
  value: z
    .string()
    .min(1)
    .describe("Value to propose for consensus."),
});

const InspectSchema = z.object({
  cluster_id: z.string().min(1).describe("ID of the BFT cluster."),
});

// --- Registration ---

export function registerBftTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "bft_create_cluster",
    description:
      "Create a PBFT cluster with N nodes (all honest initially). Requires N >= 4 for Byzantine fault tolerance (3f+1). Returns cluster ID and node list.",
    category: "bft",
    tier: "free",
    inputSchema: CreateClusterSchema.shape,
    handler: async (
      args: z.infer<typeof CreateClusterSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_create_cluster", async () => {
        const { createCluster } = await import("@/lib/bft/engine");
        const cluster = createCluster({
          userId,
          name: args.name,
          nodeCount: args.node_count,
        });

        const f = Math.floor((args.node_count - 1) / 3);
        return textResult(
          `**BFT Cluster Created**\n\n`
            + `**ID:** ${cluster.id}\n`
            + `**Name:** ${cluster.name}\n`
            + `**Nodes:** ${cluster.nodeOrder.join(", ")}\n`
            + `**Fault Tolerance:** f=${f} (tolerates ${f} Byzantine node(s) out of ${args.node_count})\n\n`
            + `All nodes are honest. Use \`bft_set_behavior\` to simulate Byzantine faults, then \`bft_propose\` to start consensus.`,
        );
      }),
  });

  registry.register({
    name: "bft_set_behavior",
    description:
      "Change a node's behavior. Honest nodes follow the PBFT protocol. Silent nodes drop all messages. Equivocating nodes send different values to different peers.",
    category: "bft",
    tier: "free",
    inputSchema: SetBehaviorSchema.shape,
    handler: async (
      args: z.infer<typeof SetBehaviorSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_set_behavior", async () => {
        const { setBehavior } = await import("@/lib/bft/engine");
        setBehavior(args.cluster_id, userId, args.node_id, args.behavior);

        return textResult(
          `**Node Behavior Updated**\n\n`
            + `**Node:** ${args.node_id}\n`
            + `**Behavior:** ${args.behavior}\n\n`
            + (args.behavior !== "honest"
              ? `Warning: This node will now behave as a Byzantine fault.`
              : `This node will follow the PBFT protocol faithfully.`),
        );
      }),
  });

  registry.register({
    name: "bft_propose",
    description:
      "Leader proposes a value for consensus. Starts a new PBFT round with pre-prepare messages. Returns the round details.",
    category: "bft",
    tier: "free",
    inputSchema: ProposeSchema.shape,
    handler: async (
      args: z.infer<typeof ProposeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_propose", async () => {
        const { propose } = await import("@/lib/bft/engine");
        const round = propose(args.cluster_id, userId, args.value);

        return textResult(
          `**Consensus Round Started**\n\n`
            + `**Sequence:** ${round.sequenceNumber}\n`
            + `**Proposed Value:** ${round.proposedValue}\n`
            + `**Phase:** ${round.phase}\n`
            + `**Messages:** ${round.messages.length}\n\n`
            + `Use \`bft_run_prepare\` to advance to the prepare phase.`,
        );
      }),
  });

  registry.register({
    name: "bft_run_prepare",
    description:
      "Run the prepare phase for a consensus round. Honest nodes broadcast matching prepare messages. Silent nodes do nothing. Equivocating nodes send conflicting values.",
    category: "bft",
    tier: "free",
    inputSchema: RoundRefSchema.shape,
    handler: async (
      args: z.infer<typeof RoundRefSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_run_prepare", async () => {
        const { runPreparePhase } = await import("@/lib/bft/engine");
        const round = runPreparePhase(
          args.cluster_id,
          userId,
          args.sequence_number,
        );

        return textResult(
          `**Prepare Phase Complete**\n\n`
            + `**Sequence:** ${round.sequenceNumber}\n`
            + `**Phase:** ${round.phase}\n`
            + `**Prepare Messages:** ${round.messages.filter(m => m.type === "prepare").length}\n\n`
            + `Use \`bft_run_commit\` to advance to the commit phase.`,
        );
      }),
  });

  registry.register({
    name: "bft_run_commit",
    description:
      "Run the commit phase for a consensus round. Nodes that collected 2f+1 matching prepare messages send commit messages.",
    category: "bft",
    tier: "free",
    inputSchema: RoundRefSchema.shape,
    handler: async (
      args: z.infer<typeof RoundRefSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_run_commit", async () => {
        const { runCommitPhase } = await import("@/lib/bft/engine");
        const round = runCommitPhase(
          args.cluster_id,
          userId,
          args.sequence_number,
        );

        return textResult(
          `**Commit Phase Complete**\n\n`
            + `**Sequence:** ${round.sequenceNumber}\n`
            + `**Phase:** ${round.phase}\n`
            + `**Commit Messages:** ${round.messages.filter(m => m.type === "commit").length}\n\n`
            + `Use \`bft_check_consensus\` to check if consensus was reached.`,
        );
      }),
  });

  registry.register({
    name: "bft_check_consensus",
    description:
      "Check if a consensus round reached agreement. Requires 2f+1 matching commit messages. Returns consensus result and quorum details.",
    category: "bft",
    tier: "free",
    inputSchema: RoundRefSchema.shape,
    handler: async (
      args: z.infer<typeof RoundRefSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_check_consensus", async () => {
        const { checkConsensus } = await import("@/lib/bft/engine");
        const result = checkConsensus(
          args.cluster_id,
          userId,
          args.sequence_number,
        );

        return textResult(
          `**Consensus Check**\n\n`
            + `**Decided:** ${result.decided ? "YES" : "NO"}\n`
            + `**Value:** ${result.value ?? "(none)"}\n`
            + `**Phase:** ${result.phase}\n`
            + `**Prepare Count:** ${result.prepareCount}\n`
            + `**Commit Count:** ${result.commitCount}\n`
            + `**Required Quorum:** ${result.requiredQuorum}`,
        );
      }),
  });

  registry.register({
    name: "bft_run_full_round",
    description:
      "Run a complete PBFT consensus round: propose -> prepare -> commit -> check. Convenience wrapper that executes all phases at once.",
    category: "bft",
    tier: "free",
    inputSchema: FullRoundSchema.shape,
    handler: async (
      args: z.infer<typeof FullRoundSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_run_full_round", async () => {
        const { runFullRound } = await import("@/lib/bft/engine");
        const result = runFullRound(args.cluster_id, userId, args.value);

        return textResult(
          `**Full Consensus Round**\n\n`
            + `**Decided:** ${result.decided ? "YES" : "NO"}\n`
            + `**Value:** ${result.value ?? "(none)"}\n`
            + `**Phase:** ${result.phase}\n`
            + `**Prepare Count:** ${result.prepareCount}\n`
            + `**Commit Count:** ${result.commitCount}\n`
            + `**Required Quorum:** ${result.requiredQuorum}\n\n`
            + (result.decided
              ? `Consensus reached! All honest nodes agreed on "${result.value}".`
              : `Consensus NOT reached. Quorum not met (need ${result.requiredQuorum}).`),
        );
      }),
  });

  registry.register({
    name: "bft_inspect",
    description:
      "Inspect the BFT cluster state. Shows all nodes with their behaviors, phases, and decided values, plus current round status and fault tolerance info.",
    category: "bft",
    tier: "free",
    inputSchema: InspectSchema.shape,
    handler: async (
      args: z.infer<typeof InspectSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bft_inspect", async () => {
        const { inspect } = await import("@/lib/bft/engine");
        const state = inspect(args.cluster_id, userId);

        const nodeRows = state.nodes
          .map(
            n => `| ${n.id} | ${n.behavior} | ${n.phase} | ${n.decidedValue ?? "-"} |`,
          )
          .join("\n");

        return textResult(
          `**BFT Cluster: ${state.name}**\n\n`
            + `**Fault Tolerance:** ${state.faultTolerance}\n`
            + `**Rounds:** ${state.roundCount}\n\n`
            + `| Node | Behavior | Phase | Decided |\n`
            + `|---|---|---|---|\n`
            + `${nodeRows}`,
        );
      }),
  });
}
