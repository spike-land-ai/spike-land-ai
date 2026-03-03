/**
 * Arena Types
 *
 * TypeScript types for arena SSE events and state machine.
 */

export type ArenaPhase =
  | "PROMPTED"
  | "GENERATING"
  | "TRANSPILING"
  | "FIXING"
  | "REVIEWING"
  | "SCORED"
  | "FAILED";

export type ArenaSSEEventType =
  | "connected"
  | "phase_update"
  | "code_generated"
  | "error_detected"
  | "error_fixed"
  | "transpile_success"
  | "review_started"
  | "review_complete"
  | "scored"
  | "failed"
  | "heartbeat";

export interface ArenaSSEEvent {
  type: ArenaSSEEventType;
  data: unknown;
  timestamp: number;
}

export interface ArenaBug {
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  line?: number;
}

export interface ArenaLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestElo: number;
}
