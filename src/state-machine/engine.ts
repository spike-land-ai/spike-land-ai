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
} from "./types.js";
import { evaluateExpression, evaluateGuard } from "./parser.js";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const machines = new Map<string, MachineInstance>();

/** Exported for test cleanup */
export function clearMachines(): void {
  machines.clear();
}

// ---------------------------------------------------------------------------
// State resolution helpers
// ---------------------------------------------------------------------------

function getAncestors(instance: MachineInstance, stateId: string): string[] {
  const ancestors: string[] = [];
  let current = instance.definition.states[stateId];
  while (current?.parent) {
    ancestors.unshift(current.parent);
    current = instance.definition.states[current.parent];
  }
  return ancestors;
}

function resolveEntry(
  machineId: string,
  stateId: string,
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(stateId)) {
    throw new Error(
      `Circular initial reference detected in machine "${machineId}": state "${stateId}" was already visited`,
    );
  }
  visited.add(stateId);

  const instance = getMachine(machineId);
  const state = instance.definition.states[stateId];
  if (!state) {
    throw new Error(`State "${stateId}" not found in machine "${machineId}"`);
  }

  // Include ancestors of the entry state
  const ancestors = getAncestors(instance, stateId);

  let results: string[] = [stateId];

  switch (state.type) {
    case "compound": {
      if (!state.initial) {
        throw new Error(`Compound state "${stateId}" has no initial child state`);
      }
      results = [...results, ...resolveEntry(machineId, state.initial, new Set(visited))];
      break;
    }

    case "parallel":
      results = [
        ...results,
        ...state.children.flatMap((childId: string) =>
          resolveEntry(machineId, childId, new Set(visited)),
        ),
      ];
      break;

    case "history": {
      const remembered = instance.history[stateId];
      if (remembered && remembered.length > 0) {
        results = remembered.flatMap((id: string) => resolveEntry(machineId, id, new Set(visited)));
      } else if (state.parent) {
        // Fall back to initial of parent
        const parent = instance.definition.states[state.parent];
        if (parent?.initial) {
          results = resolveEntry(machineId, parent.initial, new Set(visited));
        }
      }
      break;
    }
  }

  return [...new Set([...ancestors, ...results])];
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
            typeof value === "string" &&
            (value.includes("context.") || /[\+\-\*\/\(\)]/.test(value))
          ) {
            try {
              instance.context[key] = evaluateExpression(value, instance.context);
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
        if ("event" in action.params && typeof action.params.event === "string") {
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
    const ancestors = getAncestors(instance, stateId);
    for (const a of ancestors) {
      active.add(a);
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
  def: Partial<MachineDefinition> & { name: string; userId: string },
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
    throw new Error(`State "${stateId}" not found in machine "${machineId}"`);
  }

  // Remove from parent's children array
  if (state.parent) {
    const parent = instance.definition.states[state.parent];
    if (parent) {
      parent.children = parent.children.filter((id: string) => id !== stateId);
    }
  }

  // Remove all transitions referencing this state
  instance.definition.transitions = instance.definition.transitions.filter(
    (t: Transition) => t.source !== stateId && t.target !== stateId,
  );

  // Remove the state
  delete instance.definition.states[stateId];

  // Remove from active states if present
  instance.currentStates = instance.currentStates.filter((id: string) => id !== stateId);
}

/** Add a transition to a machine. */
export function addTransition(
  machineId: string,
  transition: Omit<Transition, "id"> & { id?: string },
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
export function removeTransition(machineId: string, transitionId: string): void {
  const instance = getMachine(machineId);
  const before = instance.definition.transitions.length;
  instance.definition.transitions = instance.definition.transitions.filter(
    (t: Transition) => t.id !== transitionId,
  );
  if (instance.definition.transitions.length === before) {
    throw new Error(`Transition "${transitionId}" not found in machine "${machineId}"`);
  }
}

/** Merge context values into the machine's current context. */
export function setContext(machineId: string, context: Record<string, unknown>): void {
  const instance = getMachine(machineId);
  Object.assign(instance.context, context);
}

function getLCA(instance: MachineInstance, s1: string, s2: string): string | undefined {
  const anc1 = [s1, ...getAncestors(instance, s1)];
  const anc2 = [s2, ...getAncestors(instance, s2)];

  let common: string | undefined;
  for (const a of anc1.reverse()) {
    if (anc2.includes(a)) {
      common = a;
      break;
    }
  }
  return common;
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
    (t: Transition) => t.event === event && activeSet.has(t.source),
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
    // Find LCA of source and target
    const lca = getLCA(instance, matchedTransition.source, matchedTransition.target);

    // Calculate which states to exit: current states that are descendants of LCA (or the LCA branch)
    // Actually, it's easier to just exit everything that is a descendant of the LCA
    const statesToExit: string[] = [];
    const statesToKeep: string[] = [];

    for (const stateId of instance.currentStates) {
      const ancestors = [stateId, ...getAncestors(instance, stateId)];
      if (lca && ancestors.includes(lca)) {
        statesToExit.push(stateId);
      } else if (!lca) {
        // If no LCA (top level), exit everything
        statesToExit.push(stateId);
      } else {
        statesToKeep.push(stateId);
      }
    }

    // Execute exit actions for statesToExit (in reverse order)
    for (const stateId of [...statesToExit].reverse()) {
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

    // Resolve target states (including children/parallel)
    const newEnteredStates = resolveEntry(machineId, matchedTransition.target);

    // The new current states are the ones we kept plus the ones we just entered
    instance.currentStates = [...new Set([...statesToKeep, ...newEnteredStates])];

    // Execute entry actions for ALL newly entered states (those not in statesToKeep)
    for (const stateId of newEnteredStates) {
      if (!statesToKeep.includes(stateId)) {
        const state = instance.definition.states[stateId];
        if (state?.entryActions.length) {
          executeActions(instance, state.entryActions, pendingEvents);
          allActionsExecuted.push(...state.entryActions);
        }
      }
    }

    // Check for final states - raise done events
    for (const stateId of newEnteredStates) {
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
  if (instance.definition.initial && instance.definition.states[instance.definition.initial]) {
    instance.currentStates = resolveEntry(machineId, instance.definition.initial);
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
  for (const [stateId, stateNode] of Object.entries(states)) {
    const state = stateNode as StateNode;
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
          message: `Compound state "${stateId}" initial child "${state.initial}" does not exist in states`,
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
  const targetedStates = new Set(transitions.map((t: Transition) => t.target));
  const initialStates = new Set<string>();
  if (instance.definition.initial) {
    initialStates.add(instance.definition.initial);
  }
  for (const stateNode of Object.values(states)) {
    const state = stateNode as StateNode;
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
    const state = states[stateId] as StateNode;
    if (!targetedStates.has(stateId) && !initialStates.has(stateId) && state.type !== "history") {
      issues.push({
        level: "warning",
        message: `State "${stateId}" is unreachable (no incoming transitions and not an initial state)`,
        stateId,
      });
    }
  }

  // Check for dead-end states (no outgoing transitions and not final)
  const sourceStates = new Set(transitions.map((t: Transition) => t.source));
  for (const stateId of stateIds) {
    const state = states[stateId] as StateNode;
    if (
      !sourceStates.has(stateId) &&
      state.type !== "final" &&
      state.type !== "history" &&
      state.type !== "parallel" &&
      state.children.length === 0
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
