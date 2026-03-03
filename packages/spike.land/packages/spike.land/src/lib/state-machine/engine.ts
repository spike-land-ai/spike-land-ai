/**
 * Statechart Engine
 *
 * Core engine for hierarchical/nested state machines with support for
 * compound states, parallel regions, guards, actions, history states,
 * and final states. Uses in-memory Map storage following the orchestrator pattern.
 */

import { randomUUID } from "node:crypto";
import type {
  Action,
  MachineDefinition,
  MachineExport,
  MachineInstance,
  MachineSummary,
  StateNode,
  Transition,
  TransitionLogEntry,
  ValidationIssue,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const machines = new Map<string, MachineInstance>();

/** Exported for test cleanup */
export function clearMachines(): void {
  machines.clear();
}

// ---------------------------------------------------------------------------
// Safe guard expression evaluator (recursive-descent parser)
// ---------------------------------------------------------------------------

interface Parser {
  input: string;
  pos: number;
  context: Record<string, unknown>;
}

function createParser(
  expression: string,
  context: Record<string, unknown>,
): Parser {
  return { input: expression, pos: 0, context };
}

function skipWhitespace(p: Parser): void {
  while (p.pos < p.input.length && /\s/.test(p.input[p.pos]!)) {
    p.pos++;
  }
}

function peek(p: Parser, expected: string): boolean {
  skipWhitespace(p);
  return p.input.startsWith(expected, p.pos);
}

function consume(p: Parser, expected: string): void {
  skipWhitespace(p);
  if (!p.input.startsWith(expected, p.pos)) {
    throw new Error(
      `Guard parse error at position ${p.pos}: expected "${expected}", found "${
        p.input.slice(p.pos, p.pos + 10)
      }"`,
    );
  }
  p.pos += expected.length;
}

function parseExpr(p: Parser): unknown {
  return parseOrExpr(p);
}

function parseOrExpr(p: Parser): unknown {
  let left = parseAndExpr(p);
  while (peek(p, "||")) {
    consume(p, "||");
    const right = parseAndExpr(p);
    left = Boolean(left) || Boolean(right);
  }
  return left;
}

function parseAndExpr(p: Parser): unknown {
  let left = parseNotExpr(p);
  while (peek(p, "&&")) {
    consume(p, "&&");
    const right = parseNotExpr(p);
    left = Boolean(left) && Boolean(right);
  }
  return left;
}

function parseNotExpr(p: Parser): unknown {
  skipWhitespace(p);
  if (peek(p, "!") && !peek(p, "!=")) {
    consume(p, "!");
    const val = parseNotExpr(p);
    return !val;
  }
  return parseCompare(p);
}

function parseCompare(p: Parser): unknown {
  const left = parseAddSub(p);
  skipWhitespace(p);

  const ops = ["==", "!=", ">=", "<=", ">", "<"];
  for (const op of ops) {
    if (peek(p, op)) {
      consume(p, op);
      const right = parseAddSub(p);
      switch (op) {
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return (left as number) > (right as number);
        case "<":
          return (left as number) < (right as number);
        case ">=":
          return (left as number) >= (right as number);
        case "<=":
          return (left as number) <= (right as number);
      }
    }
  }

  return left;
}

function parseAddSub(p: Parser): unknown {
  let left = parseMulDiv(p);
  while (
    peek(p, "+") || peek(p, "-")
  ) {
    if (peek(p, "+")) {
      consume(p, "+");
      const right = parseMulDiv(p);
      left = (left as number) + (right as number);
    } else {
      consume(p, "-");
      const right = parseMulDiv(p);
      left = (left as number) - (right as number);
    }
  }
  return left;
}

function parseMulDiv(p: Parser): unknown {
  let left = parsePow(p);
  while (peek(p, "*") || peek(p, "/")) {
    if (peek(p, "*")) {
      consume(p, "*");
      const right = parsePow(p);
      left = (left as number) * (right as number);
    } else {
      consume(p, "/");
      const right = parsePow(p);
      if (right === 0) {
        throw new Error("Division by zero in guard expression");
      }
      left = (left as number) / (right as number);
    }
  }
  return left;
}

function parsePow(p: Parser): unknown {
  let left = parsePrimary(p);
  while (peek(p, "**")) {
    consume(p, "**");
    const right = parsePrimary(p);
    left = Math.pow(left as number, right as number);
  }
  return left;
}

function parsePrimary(p: Parser): unknown {
  skipWhitespace(p);

  // Parenthesized expression
  if (peek(p, "(")) {
    consume(p, "(");
    const val = parseExpr(p);
    consume(p, ")");
    return val;
  }

  // String literal (double-quoted)
  if (p.pos < p.input.length && p.input[p.pos] === "\"") {
    p.pos++; // skip opening quote
    let str = "";
    while (p.pos < p.input.length && p.input[p.pos] !== "\"") {
      if (p.input[p.pos] === "\\") {
        p.pos++;
        if (p.pos >= p.input.length) {
          throw new Error("Guard parse error: unterminated string escape");
        }
      }
      str += p.input[p.pos];
      p.pos++;
    }
    if (p.pos >= p.input.length) {
      throw new Error("Guard parse error: unterminated string literal");
    }
    p.pos++; // skip closing quote
    return str;
  }

  // String literal (single-quoted)
  if (p.pos < p.input.length && p.input[p.pos] === "'") {
    p.pos++; // skip opening quote
    let str = "";
    while (p.pos < p.input.length && p.input[p.pos] !== "'") {
      if (p.input[p.pos] === "\\") {
        p.pos++;
        if (p.pos >= p.input.length) {
          throw new Error("Guard parse error: unterminated string escape");
        }
      }
      str += p.input[p.pos];
      p.pos++;
    }
    if (p.pos >= p.input.length) {
      throw new Error("Guard parse error: unterminated string literal");
    }
    p.pos++; // skip closing quote
    return str;
  }

  // Number literal
  if (
    p.pos < p.input.length
    && (/\d/.test(p.input[p.pos]!)
      || (p.input[p.pos] === "-" && p.pos + 1 < p.input.length
        && /\d/.test(p.input[p.pos + 1]!)))
  ) {
    let numStr = "";
    if (p.input[p.pos] === "-") {
      numStr += "-";
      p.pos++;
    }
    while (p.pos < p.input.length && /[\d.]/.test(p.input[p.pos]!)) {
      numStr += p.input[p.pos]!;
      p.pos++;
    }
    const num = Number(numStr);
    if (isNaN(num)) {
      throw new Error(`Guard parse error: invalid number "${numStr}"`);
    }
    return num;
  }

  // Boolean / null keywords and context access
  skipWhitespace(p);
  const identStart = p.pos;
  while (p.pos < p.input.length && /[a-zA-Z0-9_.]/.test(p.input[p.pos]!)) {
    p.pos++;
  }
  const ident = p.input.slice(identStart, p.pos);

  if (ident === "") {
    throw new Error(
      `Guard parse error at position ${p.pos}: unexpected character "${p.input[p.pos] ?? "EOF"}"`,
    );
  }

  if (ident === "true") return true;
  if (ident === "false") return false;
  if (ident === "null") return null;

  // Context access: context.field.subfield
  if (ident.startsWith("context.")) {
    const path = ident.slice("context.".length).split(".");
    let value: unknown = p.context;
    for (const key of path) {
      if (value === null || value === undefined) return undefined;
      if (typeof value === "object") {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  throw new Error(
    `Guard parse error: unknown identifier "${ident}". Use "context.fieldName" for context access.`,
  );
}

function evaluateGuard(
  expression: string,
  context: Record<string, unknown>,
): boolean {
  return Boolean(evaluateExpression(expression, context));
}

function evaluateExpression(
  expression: string,
  context: Record<string, unknown>,
): unknown {
  const p = createParser(expression, context);
  const result = parseExpr(p);
  skipWhitespace(p);
  if (p.pos < p.input.length) {
    throw new Error(
      `Expression parse error: unexpected trailing content at position ${p.pos}: "${
        p.input.slice(p.pos)
      }"`,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// State resolution helpers
// ---------------------------------------------------------------------------

function resolveEntry(
  machineId: string,
  stateId: string,
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(stateId)) {
    throw new Error(
      `Circular initial reference detected in machine "${machineId}": state "${stateId}" was already visited (cycle: ${
        [...visited, stateId].join(" -> ")
      })`,
    );
  }
  visited.add(stateId);

  const instance = getMachine(machineId);
  const state = instance.definition.states[stateId];
  if (!state) {
    throw new Error(`State "${stateId}" not found in machine "${machineId}"`);
  }

  switch (state.type) {
    case "atomic":
    case "final":
      return [stateId];

    case "compound": {
      if (!state.initial) {
        throw new Error(
          `Compound state "${stateId}" has no initial child state`,
        );
      }
      return [stateId, ...resolveEntry(machineId, state.initial, new Set(visited))];
    }

    case "parallel":
      return [
        stateId,
        ...state.children.flatMap(childId => resolveEntry(machineId, childId, new Set(visited))),
      ];

    case "history": {
      const remembered = instance.history[stateId];
      if (remembered && remembered.length > 0) {
        return remembered.flatMap(id => resolveEntry(machineId, id, new Set(visited)));
      }
      // Fall back to initial of parent
      if (state.parent) {
        const parent = instance.definition.states[state.parent];
        if (parent?.initial) {
          return resolveEntry(machineId, parent.initial, new Set(visited));
        }
      }
      return [];
    }

    default:
      return [stateId];
  }
}

function executeActions(
  instance: MachineInstance,
  actions: Action[],
  pendingEvents: string[],
): void {
  for (const action of actions) {
    switch (action.type) {
      case "assign": {
        for (const [key, value] of Object.entries(action.params)) {
          if (
            typeof value === "string"
            && (value.includes("context.") || /[\+\-\*\/\(\)]/.test(value))
          ) {
            try {
              instance.context[key] = evaluateExpression(
                value,
                instance.context,
              );
            } catch {
              instance.context[key] = value;
            }
          } else {
            instance.context[key] = value;
          }
        }
        break;
      }
      case "raise":
        if (typeof action.params.event === "string") {
          pendingEvents.push(action.params.event);
        }
        break;
      case "log":
      case "custom":
        // No-op in engine
        break;
    }
  }
}

/**
 * Collect all ancestor state IDs (from child up to root) that should
 * be considered "active" for a set of leaf active states. This is used
 * to find matching transitions on parent states.
 */
function getActiveStateSet(instance: MachineInstance): Set<string> {
  const active = new Set<string>(instance.currentStates);
  for (const stateId of instance.currentStates) {
    let current = instance.definition.states[stateId];
    while (current?.parent) {
      active.add(current.parent);
      current = instance.definition.states[current.parent];
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get a machine instance by ID. Throws if not found. */
export function getMachine(machineId: string): MachineInstance {
  const instance = machines.get(machineId);
  if (!instance) {
    throw new Error(`Machine "${machineId}" not found`);
  }
  return instance;
}

/** Create a new machine with the given definition. */
export function createMachine(
  def: Partial<MachineDefinition> & { name: string; userId: string; },
): MachineInstance {
  const id = def.id ?? randomUUID();

  if (machines.has(id)) {
    throw new Error(
      `Machine with ID "${id}" already exists. Use a unique ID or omit it to auto-generate.`,
    );
  }

  const context = def.context ? { ...def.context } : {};
  const initial = def.initial ?? "";

  const definition: MachineDefinition = {
    id,
    name: def.name,
    initial,
    states: def.states ? { ...def.states } : {},
    transitions: def.transitions ? [...def.transitions] : [],
    context,
    userId: def.userId,
  };

  const instance: MachineInstance = {
    definition,
    currentStates: [],
    context: { ...context },
    history: {},
    transitionLog: [],
    initialContext: { ...context },
  };

  machines.set(id, instance);

  // Auto-enter initial state if defined and state exists
  if (initial && definition.states[initial]) {
    instance.currentStates = resolveEntry(id, initial);
    // Execute entry actions for all entered states
    const pendingEvents: string[] = [];
    for (const stateId of instance.currentStates) {
      const state = definition.states[stateId];
      if (state?.entryActions.length) {
        executeActions(instance, state.entryActions, pendingEvents);
      }
    }
    // Process any raised events from entry actions
    for (const event of pendingEvents) {
      sendEvent(id, event);
    }
  }

  return instance;
}

/** Add a state to a machine. */
export function addState(
  machineId: string,
  state: Omit<StateNode, "children" | "entryActions" | "exitActions"> & {
    children?: string[];
    entryActions?: Action[];
    exitActions?: Action[];
  },
): StateNode {
  const instance = getMachine(machineId);

  const stateNode: StateNode = {
    id: state.id,
    type: state.type,
    parent: state.parent,
    children: state.children ?? [],
    initial: state.initial,
    entryActions: state.entryActions ?? [],
    exitActions: state.exitActions ?? [],
    historyType: state.historyType,
  };

  instance.definition.states[stateNode.id] = stateNode;

  // Link to parent's children array if parent specified
  if (stateNode.parent) {
    const parent = instance.definition.states[stateNode.parent];
    if (parent && !parent.children.includes(stateNode.id)) {
      parent.children.push(stateNode.id);
    }
  }

  return stateNode;
}

/** Remove a state and all transitions referencing it. */
export function removeState(machineId: string, stateId: string): void {
  const instance = getMachine(machineId);
  const state = instance.definition.states[stateId];
  if (!state) {
    throw new Error(
      `State "${stateId}" not found in machine "${machineId}"`,
    );
  }

  // Remove from parent's children array
  if (state.parent) {
    const parent = instance.definition.states[state.parent];
    if (parent) {
      parent.children = parent.children.filter(id => id !== stateId);
    }
  }

  // Remove all transitions referencing this state
  instance.definition.transitions = instance.definition.transitions.filter(
    t => t.source !== stateId && t.target !== stateId,
  );

  // Remove the state
  delete instance.definition.states[stateId];

  // Remove from active states if present
  instance.currentStates = instance.currentStates.filter(
    id => id !== stateId,
  );
}

/** Add a transition to a machine. */
export function addTransition(
  machineId: string,
  transition: Omit<Transition, "id"> & { id?: string; },
): Transition {
  const instance = getMachine(machineId);

  const t: Transition = {
    id: transition.id ?? randomUUID(),
    source: transition.source,
    target: transition.target,
    event: transition.event,
    guard: transition.guard,
    actions: transition.actions,
    internal: transition.internal,
    ...(transition.delayExpression !== undefined
      ? { delayExpression: transition.delayExpression }
      : {}),
  };

  instance.definition.transitions.push(t);
  return t;
}

/** Remove a transition by ID. */
export function removeTransition(
  machineId: string,
  transitionId: string,
): void {
  const instance = getMachine(machineId);
  const before = instance.definition.transitions.length;
  instance.definition.transitions = instance.definition.transitions.filter(
    t => t.id !== transitionId,
  );
  if (instance.definition.transitions.length === before) {
    throw new Error(
      `Transition "${transitionId}" not found in machine "${machineId}"`,
    );
  }
}

/** Merge context values into the machine's current context. */
export function setContext(
  machineId: string,
  context: Record<string, unknown>,
): void {
  const instance = getMachine(machineId);
  Object.assign(instance.context, context);
}

/** Send an event to the machine, triggering transitions. */
export function sendEvent(
  machineId: string,
  event: string,
  payload?: Record<string, unknown>,
): TransitionLogEntry {
  const instance = getMachine(machineId);
  const activeSet = getActiveStateSet(instance);

  // Merge payload into context temporarily for guard evaluation
  if (payload) {
    Object.assign(instance.context, { ["_event"]: payload });
  }

  // Find matching transitions from any active state
  const candidateTransitions = instance.definition.transitions.filter(
    t => t.event === event && activeSet.has(t.source),
  );

  // Evaluate guards and pick first matching
  let matchedTransition: Transition | undefined;
  let guardExpression: string | undefined;

  for (const t of candidateTransitions) {
    if (t.guard) {
      guardExpression = t.guard.expression;
      if (evaluateGuard(t.guard.expression, instance.context)) {
        matchedTransition = t;
        break;
      }
    } else {
      matchedTransition = t;
      break;
    }
  }

  // Clean up event payload from context
  if (payload) {
    delete instance.context._event;
  }

  if (!matchedTransition) {
    throw new Error(`No matching transition for event "${event}"`);
  }

  const beforeContext = { ...instance.context };
  const fromStates = [...instance.currentStates];
  const allActionsExecuted: Action[] = [];
  const pendingEvents: string[] = [];

  if (!matchedTransition.internal) {
    // Store history before leaving states
    for (const stateId of instance.currentStates) {
      const state = instance.definition.states[stateId];
      if (state?.parent) {
        const parent = instance.definition.states[state.parent];
        if (parent) {
          // For each parent, remember its direct active children
          const activeChildren = instance.currentStates.filter(id => {
            const s = instance.definition.states[id];
            return s?.parent === state.parent;
          });
          if (activeChildren.length > 0) {
            instance.history[state.parent] = activeChildren;
          }
        }
      }
    }

    // Execute exit actions (in reverse order of current states)
    const exitStates = [...instance.currentStates].reverse();
    for (const stateId of exitStates) {
      const state = instance.definition.states[stateId];
      if (state?.exitActions.length) {
        executeActions(instance, state.exitActions, pendingEvents);
        allActionsExecuted.push(...state.exitActions);
      }
    }

    // Execute transition actions
    if (matchedTransition.actions.length) {
      executeActions(instance, matchedTransition.actions, pendingEvents);
      allActionsExecuted.push(...matchedTransition.actions);
    }

    // Resolve target state
    const targetState = instance.definition.states[matchedTransition.target];
    if (!targetState) {
      throw new Error(
        `Target state "${matchedTransition.target}" not found in machine "${machineId}"`,
      );
    }

    // Enter new states
    const newStates = resolveEntry(machineId, matchedTransition.target);
    instance.currentStates = newStates;

    // Execute entry actions for all entered states
    for (const stateId of newStates) {
      const state = instance.definition.states[stateId];
      if (state?.entryActions.length) {
        executeActions(instance, state.entryActions, pendingEvents);
        allActionsExecuted.push(...state.entryActions);
      }
    }

    // Check for final states - raise done events
    for (const stateId of newStates) {
      const state = instance.definition.states[stateId];
      if (state?.type === "final" && state.parent) {
        pendingEvents.push(`done.state.${state.parent}`);
      }
    }
  } else {
    // Internal transition: execute transition actions only, no exit/entry
    if (matchedTransition.actions.length) {
      executeActions(instance, matchedTransition.actions, pendingEvents);
      allActionsExecuted.push(...matchedTransition.actions);
    }
  }

  const logEntry: TransitionLogEntry = {
    timestamp: Date.now(),
    event,
    fromStates,
    toStates: [...instance.currentStates],
    beforeContext,
    afterContext: { ...instance.context },
    guardEvaluated: guardExpression,
    actionsExecuted: allActionsExecuted,
  };

  instance.transitionLog.push(logEntry);

  // Process any raised events
  for (const raisedEvent of pendingEvents) {
    try {
      sendEvent(machineId, raisedEvent);
    } catch {
      // Raised events that have no matching transition are silently ignored
    }
  }

  return logEntry;
}

/** Get current active states and context. */
export function getState(machineId: string): {
  activeStates: string[];
  context: Record<string, unknown>;
} {
  const instance = getMachine(machineId);
  return {
    activeStates: [...instance.currentStates],
    context: { ...instance.context },
  };
}

/** Get the transition log history. */
export function getHistory(machineId: string): TransitionLogEntry[] {
  const instance = getMachine(machineId);
  return [...instance.transitionLog];
}

/** Reset machine to initial state, context, and clear history/log. */
export function resetMachine(machineId: string): void {
  const instance = getMachine(machineId);

  instance.context = { ...instance.initialContext };
  instance.history = {};
  instance.transitionLog = [];

  // Re-enter initial state
  if (
    instance.definition.initial
    && instance.definition.states[instance.definition.initial]
  ) {
    instance.currentStates = resolveEntry(
      machineId,
      instance.definition.initial,
    );
    // Execute entry actions for all entered states
    const pendingEvents: string[] = [];
    for (const stateId of instance.currentStates) {
      const state = instance.definition.states[stateId];
      if (state?.entryActions.length) {
        executeActions(instance, state.entryActions, pendingEvents);
      }
    }
    for (const event of pendingEvents) {
      try {
        sendEvent(machineId, event);
      } catch {
        // Silently ignore raised events with no matching transition
      }
    }
  } else {
    instance.currentStates = [];
  }
}

/** Validate a machine definition and return issues. */
export function validateMachine(machineId: string): ValidationIssue[] {
  const instance = getMachine(machineId);
  const { states, transitions } = instance.definition;
  const issues: ValidationIssue[] = [];

  const stateIds = new Set(Object.keys(states));

  // Check machine initial state exists
  if (instance.definition.initial && !stateIds.has(instance.definition.initial)) {
    issues.push({
      level: "error",
      message: `Machine initial state "${instance.definition.initial}" does not exist in states`,
    });
  }

  // Check compound states have initial child and that initial child exists
  for (const [stateId, state] of Object.entries(states)) {
    if (state.type === "compound") {
      if (!state.initial) {
        issues.push({
          level: "error",
          message: `Compound state "${stateId}" is missing an initial child state`,
          stateId,
        });
      } else if (!stateIds.has(state.initial)) {
        issues.push({
          level: "error",
          message:
            `Compound state "${stateId}" initial child "${state.initial}" does not exist in states`,
          stateId,
        });
      }
    }
  }

  // Check for transitions referencing non-existent states
  for (const t of transitions) {
    if (!stateIds.has(t.source)) {
      issues.push({
        level: "error",
        message: `Transition "${t.id}" references non-existent source state "${t.source}"`,
        transitionId: t.id,
      });
    }
    if (!stateIds.has(t.target)) {
      issues.push({
        level: "error",
        message: `Transition "${t.id}" references non-existent target state "${t.target}"`,
        transitionId: t.id,
      });
    }
  }

  // Check for duplicate transition IDs
  const transitionIds = new Map<string, number>();
  for (const t of transitions) {
    transitionIds.set(t.id, (transitionIds.get(t.id) ?? 0) + 1);
  }
  for (const [tid, count] of transitionIds) {
    if (count > 1) {
      issues.push({
        level: "error",
        message: `Duplicate transition ID "${tid}" (appears ${count} times)`,
        transitionId: tid,
      });
    }
  }

  // Check for unreachable states (no incoming transitions and not initial)
  const targetedStates = new Set(transitions.map(t => t.target));
  const initialStates = new Set<string>();
  if (instance.definition.initial) {
    initialStates.add(instance.definition.initial);
  }
  for (const state of Object.values(states)) {
    if (state.initial) {
      initialStates.add(state.initial);
    }
    // Parallel state children are always entered when the parallel state is entered
    if (state.type === "parallel") {
      for (const childId of state.children) {
        initialStates.add(childId);
      }
    }
  }

  for (const stateId of stateIds) {
    const state = states[stateId]!;
    if (
      !targetedStates.has(stateId)
      && !initialStates.has(stateId)
      && state.type !== "history"
    ) {
      issues.push({
        level: "warning",
        message:
          `State "${stateId}" is unreachable (no incoming transitions and not an initial state)`,
        stateId,
      });
    }
  }

  // Check for dead-end states (no outgoing transitions and not final)
  const sourceStates = new Set(transitions.map(t => t.source));
  for (const stateId of stateIds) {
    const state = states[stateId]!;
    if (
      !sourceStates.has(stateId)
      && state.type !== "final"
      && state.type !== "history"
      && state.type !== "parallel"
      && state.children.length === 0
    ) {
      issues.push({
        level: "warning",
        message: `State "${stateId}" is a dead-end (no outgoing transitions and not a final state)`,
        stateId,
      });
    }
  }

  return issues;
}

/** Export full machine state for serialization. */
export function exportMachine(machineId: string): MachineExport {
  const instance = getMachine(machineId);
  return {
    definition: { ...instance.definition },
    currentStates: [...instance.currentStates],
    context: { ...instance.context },
    history: { ...instance.history },
    transitionLog: [...instance.transitionLog],
  };
}

/** Share a machine by creating/updating a database entry and returning a token. */
export async function shareMachine(
  machineId: string,
  userId: string,
  machineData?: MachineExport,
): Promise<string> {
  const instance = machineData
    ? {
      definition: machineData.definition,
      currentStates: machineData.currentStates,
      context: machineData.context,
      history: machineData.history,
      transitionLog: machineData.transitionLog,
      initialContext: machineData.context,
    }
    : getMachine(machineId);
  const prisma = (await import("@/lib/prisma")).default;
  const { randomBytes } = await import("node:crypto");

  const existing = await prisma.stateMachine.findFirst({
    where: {
      userId,
      forkedFrom: null, // Only original machines get tokens for now
      name: instance.definition.name,
    },
  });

  const shareToken = existing?.shareToken ?? randomBytes(16).toString("hex");

  await prisma.stateMachine.upsert({
    where: { id: existing?.id ?? "" },
    create: {
      userId,
      name: instance.definition.name,
      definition: JSON.parse(JSON.stringify(instance.definition)),
      currentStates: instance.currentStates,
      context: JSON.parse(JSON.stringify(instance.context)),
      history: JSON.parse(JSON.stringify(instance.history)),
      transitionLog: JSON.parse(JSON.stringify(instance.transitionLog)),
      initialContext: JSON.parse(JSON.stringify(instance.initialContext)),
      shareToken,
      isPublic: true,
    },
    update: {
      definition: JSON.parse(JSON.stringify(instance.definition)),
      currentStates: instance.currentStates,
      context: JSON.parse(JSON.stringify(instance.context)),
      history: JSON.parse(JSON.stringify(instance.history)),
      transitionLog: JSON.parse(JSON.stringify(instance.transitionLog)),
      isPublic: true,
    },
  });

  return shareToken;
}

/** Get a shared machine by token. */
export async function getSharedMachine(token: string): Promise<MachineExport> {
  const prisma = (await import("@/lib/prisma")).default;
  const shared = await prisma.stateMachine.findUnique({
    where: { shareToken: token },
  });

  if (!shared) {
    throw new Error("Shared state machine not found");
  }

  return {
    definition: JSON.parse(
      JSON.stringify(shared.definition),
    ) as MachineDefinition,
    currentStates: shared.currentStates,
    context: (shared.context ?? {}) as Record<string, unknown>,
    history: (shared.history ?? {}) as Record<string, string[]>,
    transitionLog: JSON.parse(
      JSON.stringify(shared.transitionLog ?? []),
    ) as TransitionLogEntry[],
  };
}

/** List all machines for a given user. */
export function listMachines(userId: string): MachineSummary[] {
  const result: MachineSummary[] = [];
  for (const instance of machines.values()) {
    if (instance.definition.userId === userId) {
      result.push({
        id: instance.definition.id,
        name: instance.definition.name,
        currentStates: [...instance.currentStates],
        stateCount: Object.keys(instance.definition.states).length,
        transitionCount: instance.definition.transitions.length,
      });
    }
  }
  return result;
}
