/**
 * State Machine Data Model
 *
 * Type definitions for the statechart engine supporting
 * hierarchical/nested states, parallel regions, guards,
 * actions, history states, and final states.
 */

export type StateType =
  | "atomic"
  | "compound"
  | "parallel"
  | "final"
  | "history";
export type HistoryType = "shallow" | "deep";
export type ActionType = "assign" | "log" | "raise" | "custom";

export interface Action {
  type: ActionType;
  /** For assign: { key: value } pairs. For log: { message }. For raise: { event }. For custom: { name, ...params }. */
  params: Record<string, unknown>;
}

export interface Guard {
  /** Safe expression string evaluated by recursive-descent parser. e.g. "context.count > 0 && context.active == true" */
  expression: string;
}

export interface Transition {
  id: string;
  source: string;
  target: string;
  event: string;
  guard?: Guard;
  actions: Action[];
  /** Internal transitions don't exit/re-enter the source state. */
  internal: boolean;
  /** Delay in milliseconds before automatic transition. Evaluated as an expression. */
  delayExpression?: string;
}

export interface StateNode {
  id: string;
  type: StateType;
  /** Parent state ID for nesting, undefined for top-level. */
  parent?: string;
  /** Child state IDs (for compound/parallel states). */
  children: string[];
  /** Initial child state ID (required for compound states). */
  initial?: string;
  /** Actions executed on entering this state. */
  entryActions: Action[];
  /** Actions executed on exiting this state. */
  exitActions: Action[];
  /** For history states only. */
  historyType?: HistoryType;
}

export interface MachineDefinition {
  id: string;
  name: string;
  /** Initial top-level state ID. */
  initial: string;
  /** All states keyed by ID. */
  states: Record<string, StateNode>;
  /** All transitions. */
  transitions: Transition[];
  /** Initial extended state context. */
  context: Record<string, unknown>;
  /** Owner user ID. */
  userId: string;
}

export interface TransitionLogEntry {
  timestamp: number;
  event: string;
  fromStates: string[];
  toStates: string[];
  beforeContext: Record<string, unknown>;
  afterContext: Record<string, unknown>;
  guardEvaluated?: string;
  actionsExecuted: Action[];
}

export interface MachineInstance {
  definition: MachineDefinition;
  /** Currently active state IDs (multiple for parallel regions). */
  currentStates: string[];
  /** Current extended state context. */
  context: Record<string, unknown>;
  /** History storage: stateId -> remembered child state IDs. */
  history: Record<string, string[]>;
  /** Transition log for debugging/replay. */
  transitionLog: TransitionLogEntry[];
  /** Initial context snapshot for reset. */
  initialContext: Record<string, unknown>;
}

export interface ValidationIssue {
  level: "warning" | "error";
  message: string;
  stateId?: string;
  transitionId?: string;
}

export interface MachineExport {
  definition: MachineDefinition;
  currentStates: string[];
  context: Record<string, unknown>;
  history: Record<string, string[]>;
  transitionLog: TransitionLogEntry[];
}

export interface MachineSummary {
  id: string;
  name: string;
  currentStates: string[];
  stateCount: number;
  transitionCount: number;
}
