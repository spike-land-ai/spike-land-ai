/**
 * Network Partition & Latency Simulator - Type Definitions
 *
 * Simulates network conditions between nodes: partitions, latency, packet loss.
 * Can wrap any distributed protocol (Raft, PBFT, etc.) with realistic network behavior.
 */

export type LinkState = "up" | "partitioned" | "slow" | "lossy";

export interface NetworkLink {
  from: string;
  to: string;
  state: LinkState;
  latencyMs: number; // simulated latency in ms
  lossRate: number; // 0..1, probability of message drop
}

export interface NetworkNode {
  id: string;
  partitioned: boolean; // fully isolated?
}

export interface NetworkMessage {
  id: string;
  from: string;
  to: string;
  payload: string;
  sentAt: number; // logical timestamp
  deliveredAt: number | null;
  dropped: boolean;
  delayed: boolean;
}

export interface NetworkTopology {
  id: string;
  userId: string;
  name: string;
  nodes: Map<string, NetworkNode>;
  nodeOrder: string[];
  links: Map<string, NetworkLink>; // key: "from->to"
  messageLog: NetworkMessage[];
  messageFilter?: (msg: NetworkMessage) => boolean; // hook for raft integration
  clock: number;
  createdAt: number;
}

// Public view types

export interface TopologySummary {
  id: string;
  name: string;
  nodeCount: number;
  linkCount: number;
  messageCount: number;
  createdAt: number;
}

export interface TopologyStateView {
  id: string;
  name: string;
  nodes: Array<{ id: string; partitioned: boolean; }>;
  links: Array<{
    from: string;
    to: string;
    state: LinkState;
    latencyMs: number;
    lossRate: number;
  }>;
  recentMessages: NetworkMessage[];
}

export interface DeliveryResult {
  delivered: NetworkMessage[];
  dropped: NetworkMessage[];
  pending: NetworkMessage[];
}

export interface CreateTopologyOptions {
  userId: string;
  name: string;
  nodeCount: number;
}
