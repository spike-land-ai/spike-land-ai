/**
 * Network Partition & Latency Simulator - Simulation Engine
 *
 * Pure business logic with in-memory storage.
 * Deterministic simulation of network conditions: partitions, latency, packet loss.
 */

import type {
  CreateTopologyOptions,
  DeliveryResult,
  LinkState,
  NetworkLink,
  NetworkMessage,
  NetworkNode,
  NetworkTopology,
  TopologyStateView,
  TopologySummary,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const topologies = new Map<string, NetworkTopology>();

export function clearTopologies(): void {
  topologies.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  return `netsim-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateMessageId(topo: NetworkTopology): string {
  return `msg-${topo.messageLog.length + 1}`;
}

function linkKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * Deterministic pseudo-random based on a string seed.
 * Returns a value between 0 and 1.
 */
function deterministicRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  // Normalize to 0..1 range
  return Math.abs(hash % 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

function getTopology(topoId: string, userId: string): NetworkTopology {
  const topo = topologies.get(topoId);
  if (!topo) throw new Error(`Topology ${topoId} not found`);
  if (topo.userId !== userId) throw new Error("Access denied");
  return topo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createTopology(opts: CreateTopologyOptions): NetworkTopology {
  if (opts.nodeCount < 2 || opts.nodeCount > 20) {
    throw new Error("Node count must be between 2 and 20");
  }

  const id = generateId();
  const nodes = new Map<string, NetworkNode>();
  const nodeOrder: string[] = [];
  const links = new Map<string, NetworkLink>();

  // Create nodes
  for (let i = 1; i <= opts.nodeCount; i++) {
    const nodeId = `node-${i}`;
    nodes.set(nodeId, { id: nodeId, partitioned: false });
    nodeOrder.push(nodeId);
  }

  // Create full-mesh links (bidirectional)
  for (let i = 0; i < nodeOrder.length; i++) {
    for (let j = 0; j < nodeOrder.length; j++) {
      if (i === j) continue;
      const from = nodeOrder[i]!;
      const to = nodeOrder[j]!;
      const key = linkKey(from, to);
      links.set(key, {
        from,
        to,
        state: "up",
        latencyMs: 0,
        lossRate: 0,
      });
    }
  }

  const topo: NetworkTopology = {
    id,
    userId: opts.userId,
    name: opts.name,
    nodes,
    nodeOrder,
    links,
    messageLog: [],
    clock: 0,
    createdAt: Date.now(),
  };

  topologies.set(id, topo);
  return topo;
}

export function destroyTopology(topoId: string, userId: string): void {
  const topo = getTopology(topoId, userId);
  topologies.delete(topo.id);
}

export function listTopologies(userId: string): TopologySummary[] {
  const result: TopologySummary[] = [];
  for (const topo of topologies.values()) {
    if (topo.userId !== userId) continue;
    result.push({
      id: topo.id,
      name: topo.name,
      nodeCount: topo.nodeOrder.length,
      linkCount: topo.links.size,
      messageCount: topo.messageLog.length,
      createdAt: topo.createdAt,
    });
  }
  return result;
}

export function setLinkState(
  topoId: string,
  userId: string,
  from: string,
  to: string,
  state: LinkState,
  latencyMs?: number,
  lossRate?: number,
): NetworkLink {
  const topo = getTopology(topoId, userId);
  const key = linkKey(from, to);
  const link = topo.links.get(key);
  if (!link) throw new Error(`Link ${key} not found`);

  link.state = state;
  if (latencyMs !== undefined) {
    link.latencyMs = latencyMs;
  }
  if (lossRate !== undefined) {
    if (lossRate < 0 || lossRate > 1) {
      throw new Error("Loss rate must be between 0 and 1");
    }
    link.lossRate = lossRate;
  }

  return link;
}

export function partitionNode(
  topoId: string,
  userId: string,
  nodeId: string,
): void {
  const topo = getTopology(topoId, userId);
  const node = topo.nodes.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  node.partitioned = true;

  // Set all links involving this node to "partitioned"
  for (const link of topo.links.values()) {
    if (link.from === nodeId || link.to === nodeId) {
      link.state = "partitioned";
    }
  }
}

export function healNode(
  topoId: string,
  userId: string,
  nodeId: string,
): void {
  const topo = getTopology(topoId, userId);
  const node = topo.nodes.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  node.partitioned = false;

  // Restore all links involving this node to "up" (only if the other end
  // is not also partitioned)
  for (const link of topo.links.values()) {
    if (link.from === nodeId || link.to === nodeId) {
      const otherNodeId = link.from === nodeId ? link.to : link.from;
      const otherNode = topo.nodes.get(otherNodeId);
      if (otherNode && !otherNode.partitioned) {
        link.state = "up";
        link.latencyMs = 0;
        link.lossRate = 0;
      }
    }
  }
}

export function sendMessage(
  topoId: string,
  userId: string,
  from: string,
  to: string,
  payload: string,
): NetworkMessage {
  const topo = getTopology(topoId, userId);

  if (!topo.nodes.has(from)) throw new Error(`Node ${from} not found`);
  if (!topo.nodes.has(to)) throw new Error(`Node ${to} not found`);

  const msg: NetworkMessage = {
    id: generateMessageId(topo),
    from,
    to,
    payload,
    sentAt: topo.clock,
    deliveredAt: null,
    dropped: false,
    delayed: false,
  };

  topo.messageLog.push(msg);
  return msg;
}

export function tick(
  topoId: string,
  userId: string,
  rounds: number = 1,
): DeliveryResult {
  const topo = getTopology(topoId, userId);

  const delivered: NetworkMessage[] = [];
  const dropped: NetworkMessage[] = [];

  for (let r = 0; r < rounds; r++) {
    topo.clock++;

    // Process all pending messages
    for (const msg of topo.messageLog) {
      // Skip already resolved messages
      if (msg.deliveredAt !== null || msg.dropped) continue;

      // Check the message filter hook
      if (topo.messageFilter && !topo.messageFilter(msg)) {
        msg.dropped = true;
        dropped.push(msg);
        continue;
      }

      const key = linkKey(msg.from, msg.to);
      const link = topo.links.get(key);

      if (!link) {
        // No link exists - drop the message
        msg.dropped = true;
        dropped.push(msg);
        continue;
      }

      switch (link.state) {
        case "up": {
          // Deliver immediately
          msg.deliveredAt = topo.clock;
          delivered.push(msg);
          break;
        }
        case "partitioned": {
          // Always drop
          msg.dropped = true;
          dropped.push(msg);
          break;
        }
        case "slow": {
          // Add latency: deliver only if enough ticks have passed
          const ticksNeeded = Math.max(1, Math.ceil(link.latencyMs / 100));
          const ticksElapsed = topo.clock - msg.sentAt;
          if (ticksElapsed >= ticksNeeded) {
            msg.deliveredAt = topo.clock;
            msg.delayed = true;
            delivered.push(msg);
          }
          // Otherwise remains pending
          break;
        }
        case "lossy": {
          // Deterministic drop based on message id and loss rate
          const randomValue = deterministicRandom(msg.id);
          if (randomValue < link.lossRate) {
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

  // Collect still-pending messages
  const pending = topo.messageLog.filter(
    m => m.deliveredAt === null && !m.dropped,
  );

  return { delivered, dropped, pending };
}

export function inspect(
  topoId: string,
  userId: string,
): TopologyStateView {
  const topo = getTopology(topoId, userId);

  const nodes = topo.nodeOrder.map(nid => {
    const node = topo.nodes.get(nid)!;
    return { id: node.id, partitioned: node.partitioned };
  });

  const links: TopologyStateView["links"] = [];
  for (const link of topo.links.values()) {
    links.push({
      from: link.from,
      to: link.to,
      state: link.state,
      latencyMs: link.latencyMs,
      lossRate: link.lossRate,
    });
  }

  // Return last 50 messages as recent
  const recentMessages = topo.messageLog.slice(-50);

  return {
    id: topo.id,
    name: topo.name,
    nodes,
    links,
    recentMessages,
  };
}

export function getDeliveryStats(
  topoId: string,
  userId: string,
): DeliveryResult {
  const topo = getTopology(topoId, userId);

  const delivered: NetworkMessage[] = [];
  const droppedMsgs: NetworkMessage[] = [];
  const pending: NetworkMessage[] = [];

  for (const msg of topo.messageLog) {
    if (msg.dropped) {
      droppedMsgs.push(msg);
    } else if (msg.deliveredAt !== null) {
      delivered.push(msg);
    } else {
      pending.push(msg);
    }
  }

  return { delivered, dropped: droppedMsgs, pending };
}
