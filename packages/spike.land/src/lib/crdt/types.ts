/**
 * CRDT Playground - Type Definitions
 *
 * Conflict-free Replicated Data Types for exploring eventual consistency.
 * Supports G-Counter, PN-Counter, LWW-Register, and OR-Set.
 */

export type CrdtType = "g_counter" | "pn_counter" | "lww_register" | "or_set";

// --- Internal state types per CRDT kind ---

export interface GCounterState {
  type: "g_counter";
  counts: Record<string, number>; // replicaId -> count
}

export interface PNCounterState {
  type: "pn_counter";
  positive: Record<string, number>; // replicaId -> count
  negative: Record<string, number>; // replicaId -> count
}

export interface LWWRegisterState {
  type: "lww_register";
  value: string | null;
  timestamp: number;
}

export interface ORSetState {
  type: "or_set";
  elements: Record<string, string[]>; // value -> uniqueTags[]
}

export type ReplicaState = GCounterState | PNCounterState | LWWRegisterState | ORSetState;

// --- Replica ---

export interface CrdtReplica {
  id: string;
  state: ReplicaState;
}

// --- Operation log ---

export interface OperationLog {
  id: string;
  replicaId: string;
  operation: string;
  value?: string;
  timestamp: number;
}

// --- CRDT Set (top-level container) ---

export interface CrdtSet {
  id: string;
  userId: string;
  name: string;
  crdtType: CrdtType;
  replicas: Map<string, CrdtReplica>;
  replicaOrder: string[];
  operationLog: OperationLog[];
  timestampCounter: number; // deterministic monotonic counter for LWW
  tagCounter: number; // for OR-Set unique tags
  createdAt: number;
}

// --- Public view types ---

export interface SetSummary {
  id: string;
  name: string;
  crdtType: CrdtType;
  replicaCount: number;
  operationCount: number;
  createdAt: number;
}

export interface ReplicaView {
  id: string;
  state: ReplicaState;
  resolvedValue: string;
}

export interface SetStateView {
  id: string;
  name: string;
  crdtType: CrdtType;
  replicas: ReplicaView[];
  operationCount: number;
}

export interface ConvergenceResult {
  converged: boolean;
  diffs: ConvergenceDiff[];
}

export interface ConvergenceDiff {
  replicaA: string;
  replicaB: string;
  valueA: string;
  valueB: string;
}

export interface CreateSetOptions {
  userId: string;
  name: string;
  replicaCount: number;
  crdtType: CrdtType;
}
