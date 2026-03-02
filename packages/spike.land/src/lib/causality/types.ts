/**
 * Causality - Lamport & Vector Clock Simulator - Type Definitions
 *
 * Simulates logical clocks for reasoning about happens-before relationships
 * in distributed systems. Supports both Lamport timestamps and vector clocks.
 */

export type ClockType = "lamport" | "vector";

export interface LamportClock {
  type: "lamport";
  time: number;
}

export interface VectorClock {
  type: "vector";
  entries: Record<string, number>; // processId -> counter
}

export type LogicalClock = LamportClock | VectorClock;

export interface CausalEvent {
  id: string;
  processId: string;
  label: string; // user-provided label (e.g., "send_request")
  clock: LogicalClock; // clock at the time of the event
  causalParents: string[]; // event ids that causally precede this event
  timestamp: number; // monotonic counter for ordering
}

export type CausalRelation = "happens_before" | "concurrent" | "same";

export interface CausalSystem {
  id: string;
  userId: string;
  name: string;
  clockType: ClockType;
  processes: Map<string, LogicalClock>; // processId -> current clock
  processOrder: string[];
  events: CausalEvent[];
  eventCounter: number;
  createdAt: number;
}

// Public view types

export interface SystemSummary {
  id: string;
  name: string;
  clockType: ClockType;
  processCount: number;
  eventCount: number;
  createdAt: number;
}

export interface SystemStateView {
  id: string;
  name: string;
  clockType: ClockType;
  processes: Array<{ id: string; clock: LogicalClock }>;
  events: CausalEvent[];
}

export interface CausalQueryResult {
  eventA: string;
  eventB: string;
  relation: CausalRelation;
  explanation: string;
}

export interface CreateSystemOptions {
  userId: string;
  name: string;
  processCount: number;
  clockType: ClockType;
}
