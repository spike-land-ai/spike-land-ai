import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// Re-export for test cleanup
export { clearTopologies } from "@/lib/netsim/engine";

// --- Zod schemas ---

const LinkStateEnum = z
  .enum(["up", "partitioned", "slow", "lossy"])
  .describe("Link state: up, partitioned, slow, or lossy.");

const CreateTopologySchema = z.object({
  name: z.string().min(1).describe("Name for the network topology."),
  node_count: z
    .number()
    .int()
    .min(2)
    .max(10)
    .describe("Number of nodes (2-10)."),
});

const SetLinkStateSchema = z.object({
  topology_id: z.string().min(1).describe("ID of the network topology."),
  from: z.string().min(1).describe("Source node ID."),
  to: z.string().min(1).describe("Target node ID."),
  state: LinkStateEnum,
  latency_ms: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Simulated latency in ms (for slow links)."),
  loss_rate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Packet loss probability 0..1 (for lossy links)."),
});

const NodeOpSchema = z.object({
  topology_id: z.string().min(1).describe("ID of the network topology."),
  node_id: z.string().min(1).describe("Node ID to partition or heal."),
});

const SendMessageSchema = z.object({
  topology_id: z.string().min(1).describe("ID of the network topology."),
  from: z.string().min(1).describe("Sender node ID."),
  to: z.string().min(1).describe("Receiver node ID."),
  payload: z.string().min(1).describe("Message payload."),
});

const TickSchema = z.object({
  topology_id: z.string().min(1).describe("ID of the network topology."),
  rounds: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of rounds to advance (default 1)."),
});

// --- Registration ---

export function registerNetsimTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "netsim_create_topology",
    description:
      "Create a network topology with N nodes connected in a full mesh. All links start as 'up' with 0 latency and 0 loss. Returns topology ID and node list.",
    category: "netsim",
    tier: "free",
    inputSchema: CreateTopologySchema.shape,
    handler: async (
      args: z.infer<typeof CreateTopologySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_create_topology", async () => {
        const { createTopology } = await import("@/lib/netsim/engine");
        const topo = createTopology({
          userId,
          name: args.name,
          nodeCount: args.node_count,
        });

        return textResult(
          `**Network Topology Created**\n\n`
            + `**ID:** ${topo.id}\n`
            + `**Name:** ${topo.name}\n`
            + `**Nodes:** ${topo.nodeOrder.join(", ")}\n`
            + `**Links:** ${topo.links.size} (full mesh, all up)\n\n`
            + `Use \`netsim_set_link_state\` to simulate partitions, latency, or packet loss.`,
        );
      }),
  });

  registry.register({
    name: "netsim_set_link_state",
    description:
      "Change the state of a network link between two nodes. States: up (normal), partitioned (all messages dropped), slow (adds latency), lossy (random drops).",
    category: "netsim",
    tier: "free",
    inputSchema: SetLinkStateSchema.shape,
    handler: async (
      args: z.infer<typeof SetLinkStateSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_set_link_state", async () => {
        const { setLinkState } = await import("@/lib/netsim/engine");
        const link = setLinkState(
          args.topology_id,
          userId,
          args.from,
          args.to,
          args.state,
          args.latency_ms,
          args.loss_rate,
        );

        return textResult(
          `**Link Updated**\n\n`
            + `**${link.from} -> ${link.to}**\n`
            + `**State:** ${link.state}\n`
            + `**Latency:** ${link.latencyMs}ms\n`
            + `**Loss Rate:** ${(link.lossRate * 100).toFixed(0)}%`,
        );
      }),
  });

  registry.register({
    name: "netsim_partition_node",
    description:
      "Fully partition a node from the network. All links to and from the node are set to 'partitioned'. Messages will be dropped.",
    category: "netsim",
    tier: "free",
    inputSchema: NodeOpSchema.shape,
    handler: async (
      args: z.infer<typeof NodeOpSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_partition_node", async () => {
        const { partitionNode } = await import("@/lib/netsim/engine");
        partitionNode(args.topology_id, userId, args.node_id);

        return textResult(
          `**Node Partitioned**\n\n`
            + `**Node:** ${args.node_id}\n`
            + `All links to/from this node are now partitioned. Messages will be dropped.\n\n`
            + `Use \`netsim_heal_node\` to restore connectivity.`,
        );
      }),
  });

  registry.register({
    name: "netsim_heal_node",
    description:
      "Heal a partitioned node, restoring all its links to 'up' state with 0 latency and 0 loss.",
    category: "netsim",
    tier: "free",
    inputSchema: NodeOpSchema.shape,
    handler: async (
      args: z.infer<typeof NodeOpSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_heal_node", async () => {
        const { healNode } = await import("@/lib/netsim/engine");
        healNode(args.topology_id, userId, args.node_id);

        return textResult(
          `**Node Healed**\n\n`
            + `**Node:** ${args.node_id}\n`
            + `All links to/from this node are restored to 'up' state.`,
        );
      }),
  });

  registry.register({
    name: "netsim_send_message",
    description:
      "Send a message from one node to another through the simulated network. The message will be subject to the link's current state (delivered, delayed, or dropped).",
    category: "netsim",
    tier: "free",
    inputSchema: SendMessageSchema.shape,
    handler: async (
      args: z.infer<typeof SendMessageSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_send_message", async () => {
        const { sendMessage } = await import("@/lib/netsim/engine");
        const msg = sendMessage(
          args.topology_id,
          userId,
          args.from,
          args.to,
          args.payload,
        );

        return textResult(
          `**Message Sent**\n\n`
            + `**ID:** ${msg.id}\n`
            + `**From:** ${msg.from} -> **To:** ${msg.to}\n`
            + `**Payload:** ${msg.payload}\n`
            + `**Status:** ${
              msg.dropped
                ? "DROPPED"
                : msg.deliveredAt !== null
                ? "DELIVERED"
                : "PENDING"
            }\n\n`
            + `Use \`netsim_tick\` to advance the simulation clock and deliver pending messages.`,
        );
      }),
  });

  registry.register({
    name: "netsim_tick",
    description:
      "Advance the simulation clock by N rounds, delivering pending messages based on link states. Returns delivery statistics.",
    category: "netsim",
    tier: "free",
    inputSchema: TickSchema.shape,
    handler: async (
      args: z.infer<typeof TickSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("netsim_tick", async () => {
        const { tick } = await import("@/lib/netsim/engine");
        const result = tick(args.topology_id, userId, args.rounds);

        return textResult(
          `**Simulation Advanced**\n\n`
            + `**Delivered:** ${result.delivered.length} message(s)\n`
            + `**Dropped:** ${result.dropped.length} message(s)\n`
            + `**Pending:** ${result.pending.length} message(s)\n\n`
            + (result.delivered.length > 0
              ? `| From | To | Payload |\n|---|---|---|\n`
                + result.delivered
                  .map(m => `| ${m.from} | ${m.to} | ${m.payload} |`)
                  .join("\n")
              : "No messages delivered this tick."),
        );
      }),
  });
}
