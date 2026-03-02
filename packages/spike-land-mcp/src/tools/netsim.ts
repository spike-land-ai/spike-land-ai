/**
 * Network Partition & Latency Simulator MCP Tools
 *
 * Simulates network conditions: partitions, latency, packet loss.
 * Ported from spike.land — pure in-memory computation, no DB needed.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

type LinkState = "up" | "partitioned" | "slow" | "lossy";

interface NetworkLink {
  from: string;
  to: string;
  state: LinkState;
  latencyMs: number;
  lossRate: number;
}

interface NetworkNode {
  id: string;
  partitioned: boolean;
}

interface NetworkMessage {
  id: string;
  from: string;
  to: string;
  payload: string;
  sentAt: number;
  deliveredAt: number | null;
  dropped: boolean;
  delayed: boolean;
}

interface NetworkTopology {
  id: string;
  userId: string;
  name: string;
  nodes: Map<string, NetworkNode>;
  nodeOrder: string[];
  links: Map<string, NetworkLink>;
  messageLog: NetworkMessage[];
  clock: number;
  createdAt: number;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const topologies = new Map<string, NetworkTopology>();

export function clearTopologies(): void {
  topologies.clear();
}

let idCounter = 0;

function generateId(): string {
  return `netsim-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function linkKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function deterministicRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash % 10000) / 10000;
}

function getTopology(topoId: string, userId: string): NetworkTopology {
  const topo = topologies.get(topoId);
  if (!topo) throw new Error(`Topology ${topoId} not found`);
  if (topo.userId !== userId) throw new Error("Access denied");
  return topo;
}

// ─── Registration ────────────────────────────────────────────────────────────

const LinkStateEnum = z
  .enum(["up", "partitioned", "slow", "lossy"])
  .describe("Link state: up, partitioned, slow, or lossy.");

export function registerNetsimTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "netsim_create_topology",
        "Create a network topology with N nodes connected in a full mesh.",
        {
          name: z.string().min(1).describe("Name for the network topology."),
          node_count: z.number().int().min(2).max(10).describe("Number of nodes (2-10)."),
        },
      )
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const id = generateId();
        const nodes = new Map<string, NetworkNode>();
        const nodeOrder: string[] = [];
        const links = new Map<string, NetworkLink>();
        for (let i = 1; i <= input.node_count; i++) {
          const nodeId = `node-${i}`;
          nodes.set(nodeId, { id: nodeId, partitioned: false });
          nodeOrder.push(nodeId);
        }
        for (let i = 0; i < nodeOrder.length; i++) {
          for (let j = 0; j < nodeOrder.length; j++) {
            if (i === j) continue;
            const from = nodeOrder[i]!,
              to = nodeOrder[j]!;
            links.set(linkKey(from, to), { from, to, state: "up", latencyMs: 0, lossRate: 0 });
          }
        }
        const topo: NetworkTopology = {
          id,
          userId,
          name: input.name,
          nodes,
          nodeOrder,
          links,
          messageLog: [],
          clock: 0,
          createdAt: Date.now(),
        };
        topologies.set(id, topo);
        return textResult(
          `**Network Topology Created**\n\n**ID:** ${topo.id}\n**Name:** ${topo.name}\n**Nodes:** ${topo.nodeOrder.join(", ")}\n**Links:** ${topo.links.size} (full mesh, all up)\n\nUse \`netsim_set_link_state\` to simulate partitions, latency, or packet loss.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("netsim_set_link_state", "Change the state of a network link between two nodes.", {
        topology_id: z.string().min(1).describe("ID of the network topology."),
        from: z.string().min(1).describe("Source node ID."),
        to: z.string().min(1).describe("Target node ID."),
        state: LinkStateEnum,
        latency_ms: z.number().int().min(0).optional().describe("Simulated latency in ms."),
        loss_rate: z.number().min(0).max(1).optional().describe("Packet loss probability 0..1."),
      })
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const topo = getTopology(input.topology_id, userId);
        const key = linkKey(input.from, input.to);
        const link = topo.links.get(key);
        if (!link) throw new Error(`Link ${key} not found`);
        link.state = input.state;
        if (input.latency_ms !== undefined) link.latencyMs = input.latency_ms;
        if (input.loss_rate !== undefined) link.lossRate = input.loss_rate;
        return textResult(
          `**Link Updated**\n\n**${link.from} -> ${link.to}**\n**State:** ${link.state}\n**Latency:** ${link.latencyMs}ms\n**Loss Rate:** ${(link.lossRate * 100).toFixed(0)}%`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("netsim_partition_node", "Fully partition a node from the network.", {
        topology_id: z.string().min(1).describe("ID of the network topology."),
        node_id: z.string().min(1).describe("Node ID to partition."),
      })
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const topo = getTopology(input.topology_id, userId);
        const node = topo.nodes.get(input.node_id);
        if (!node) throw new Error(`Node ${input.node_id} not found`);
        node.partitioned = true;
        for (const link of topo.links.values()) {
          if (link.from === input.node_id || link.to === input.node_id) link.state = "partitioned";
        }
        return textResult(
          `**Node Partitioned**\n\n**Node:** ${input.node_id}\nAll links to/from this node are now partitioned.\n\nUse \`netsim_heal_node\` to restore connectivity.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("netsim_heal_node", "Heal a partitioned node, restoring all its links to 'up' state.", {
        topology_id: z.string().min(1).describe("ID of the network topology."),
        node_id: z.string().min(1).describe("Node ID to heal."),
      })
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const topo = getTopology(input.topology_id, userId);
        const node = topo.nodes.get(input.node_id);
        if (!node) throw new Error(`Node ${input.node_id} not found`);
        node.partitioned = false;
        for (const link of topo.links.values()) {
          if (link.from === input.node_id || link.to === input.node_id) {
            const otherNodeId = link.from === input.node_id ? link.to : link.from;
            const otherNode = topo.nodes.get(otherNodeId);
            if (otherNode && !otherNode.partitioned) {
              link.state = "up";
              link.latencyMs = 0;
              link.lossRate = 0;
            }
          }
        }
        return textResult(
          `**Node Healed**\n\n**Node:** ${input.node_id}\nAll links to/from this node are restored to 'up' state.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "netsim_send_message",
        "Send a message from one node to another through the simulated network.",
        {
          topology_id: z.string().min(1).describe("ID of the network topology."),
          from: z.string().min(1).describe("Sender node ID."),
          to: z.string().min(1).describe("Receiver node ID."),
          payload: z.string().min(1).describe("Message payload."),
        },
      )
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const topo = getTopology(input.topology_id, userId);
        if (!topo.nodes.has(input.from)) throw new Error(`Node ${input.from} not found`);
        if (!topo.nodes.has(input.to)) throw new Error(`Node ${input.to} not found`);
        const msg: NetworkMessage = {
          id: `msg-${topo.messageLog.length + 1}`,
          from: input.from,
          to: input.to,
          payload: input.payload,
          sentAt: topo.clock,
          deliveredAt: null,
          dropped: false,
          delayed: false,
        };
        topo.messageLog.push(msg);
        return textResult(
          `**Message Sent**\n\n**ID:** ${msg.id}\n**From:** ${msg.from} -> **To:** ${msg.to}\n**Payload:** ${msg.payload}\n**Status:** PENDING\n\nUse \`netsim_tick\` to advance the simulation clock.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "netsim_tick",
        "Advance the simulation clock by N rounds, delivering pending messages.",
        {
          topology_id: z.string().min(1).describe("ID of the network topology."),
          rounds: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Number of rounds (default 1)."),
        },
      )
      .meta({ category: "netsim", tier: "free" })
      .handler(async ({ input }) => {
        const topo = getTopology(input.topology_id, userId);
        const rounds = input.rounds ?? 1;
        const delivered: NetworkMessage[] = [];
        const dropped: NetworkMessage[] = [];
        for (let r = 0; r < rounds; r++) {
          topo.clock++;
          for (const msg of topo.messageLog) {
            if (msg.deliveredAt !== null || msg.dropped) continue;
            const key = linkKey(msg.from, msg.to);
            const link = topo.links.get(key);
            if (!link) {
              msg.dropped = true;
              dropped.push(msg);
              continue;
            }
            switch (link.state) {
              case "up":
                msg.deliveredAt = topo.clock;
                delivered.push(msg);
                break;
              case "partitioned":
                msg.dropped = true;
                dropped.push(msg);
                break;
              case "slow": {
                const ticksNeeded = Math.max(1, Math.ceil(link.latencyMs / 100));
                if (topo.clock - msg.sentAt >= ticksNeeded) {
                  msg.deliveredAt = topo.clock;
                  msg.delayed = true;
                  delivered.push(msg);
                }
                break;
              }
              case "lossy": {
                if (deterministicRandom(msg.id) < link.lossRate) {
                  msg.dropped = true;
                  dropped.push(msg);
                } else {
                  msg.deliveredAt = topo.clock;
                  delivered.push(msg);
                }
                break;
              }
            }
          }
        }
        const pending = topo.messageLog.filter((m) => m.deliveredAt === null && !m.dropped);
        return textResult(
          `**Simulation Advanced**\n\n**Delivered:** ${delivered.length} message(s)\n**Dropped:** ${dropped.length} message(s)\n**Pending:** ${pending.length} message(s)\n\n` +
            (delivered.length > 0
              ? `| From | To | Payload |\n|---|---|---|\n` +
                delivered.map((m) => `| ${m.from} | ${m.to} | ${m.payload} |`).join("\n")
              : "No messages delivered this tick."),
        );
      }),
  );
}
