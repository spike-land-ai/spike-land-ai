/**
 * Causality - Lamport & Vector Clock Simulation Engine
 *
 * Pure business logic with in-memory storage.
 * Deterministic simulation of Lamport timestamps and vector clocks
 * for reasoning about happens-before relationships in distributed systems.
 */

import type {
  CausalEvent,
  CausalQueryResult,
  CausalRelation,
  CausalSystem,
  CreateSystemOptions,
  LamportClock,
  LogicalClock,
  SystemStateView,
  SystemSummary,
  VectorClock,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const systems = new Map<string, CausalSystem>();

export function clearSystems(): void {
  systems.clear();
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  return `causal-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateEventId(system: CausalSystem): string {
  system.eventCounter++;
  return `evt-${system.eventCounter}`;
}

// ---------------------------------------------------------------------------
// Clock factories and utilities
// ---------------------------------------------------------------------------

function createInitialClock(
  clockType: "lamport",
  _processIds: string[],
): LamportClock;
function createInitialClock(
  clockType: "vector",
  processIds: string[],
): VectorClock;
function createInitialClock(
  clockType: "lamport" | "vector",
  processIds: string[],
): LogicalClock;
function createInitialClock(
  clockType: "lamport" | "vector",
  processIds: string[],
): LogicalClock {
  if (clockType === "lamport") {
    return { type: "lamport", time: 0 };
  }
  const entries: Record<string, number> = {};
  for (const pid of processIds) {
    entries[pid] = 0;
  }
  return { type: "vector", entries };
}

function cloneClock(clock: LogicalClock): LogicalClock {
  if (clock.type === "lamport") {
    return { type: "lamport", time: clock.time };
  }
  return { type: "vector", entries: { ...clock.entries } };
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

function getSystem(systemId: string, userId: string): CausalSystem {
  const system = systems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);
  if (system.userId !== userId) throw new Error("Access denied");
  return system;
}

function getProcessClock(
  system: CausalSystem,
  processId: string,
): LogicalClock {
  const clock = system.processes.get(processId);
  if (!clock) throw new Error(`Process ${processId} not found`);
  return clock;
}

function getLatestEventForProcess(
  system: CausalSystem,
  processId: string,
): CausalEvent | undefined {
  for (let i = system.events.length - 1; i >= 0; i--) {
    if (system.events[i]!.processId === processId) {
      return system.events[i]!;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Clock operations
// ---------------------------------------------------------------------------

function incrementLamport(clock: LamportClock): void {
  clock.time += 1;
}

function incrementVector(clock: VectorClock, processId: string): void {
  clock.entries[processId] = (clock.entries[processId] ?? 0) + 1;
}

function mergeLamportClocks(
  local: LamportClock,
  received: LamportClock,
): void {
  local.time = Math.max(local.time, received.time) + 1;
}

function mergeVectorClocks(
  local: VectorClock,
  received: VectorClock,
  localProcessId: string,
): void {
  const allKeys = new Set([
    ...Object.keys(local.entries),
    ...Object.keys(received.entries),
  ]);
  for (const key of allKeys) {
    local.entries[key] = Math.max(
      local.entries[key] ?? 0,
      received.entries[key] ?? 0,
    );
  }
  // Increment the receiver's own entry
  local.entries[localProcessId] = (local.entries[localProcessId] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Causal comparison
// ---------------------------------------------------------------------------

function compareLamport(
  a: LamportClock,
  b: LamportClock,
): CausalRelation {
  if (a.time === b.time) return "same";
  if (a.time < b.time) return "happens_before";
  // Lamport clocks only give partial ordering: if a.time > b.time,
  // we cannot conclude a happens_before b, but for the inverse we can say
  // b happens_before a. However, since the caller asks about a->b specifically,
  // we report "concurrent" because Lamport timestamps alone cannot distinguish
  // true concurrency from happens-after without additional causal information.
  // We use causal parents for definitive ordering.
  return "concurrent";
}

function determineRelation(
  clockA: LogicalClock,
  clockB: LogicalClock,
): CausalRelation {
  if (clockA.type === "lamport" && clockB.type === "lamport") {
    return compareLamport(clockA, clockB);
  }
  if (clockA.type === "vector" && clockB.type === "vector") {
    // Full directional comparison
    const allKeys = new Set([
      ...Object.keys(clockA.entries),
      ...Object.keys(clockB.entries),
    ]);

    let aLeqB = true;
    let bLeqA = true;
    let aStrictlyLessB = false;
    let bStrictlyLessA = false;

    for (const key of allKeys) {
      const aVal = clockA.entries[key] ?? 0;
      const bVal = clockB.entries[key] ?? 0;
      if (aVal > bVal) {
        aLeqB = false;
        bStrictlyLessA = true;
      }
      if (bVal > aVal) {
        bLeqA = false;
        aStrictlyLessB = true;
      }
    }

    if (!aStrictlyLessB && !bStrictlyLessA) return "same";
    if (aLeqB && aStrictlyLessB) return "happens_before";
    if (bLeqA && bStrictlyLessA) return "concurrent"; // b -> a, from a's perspective this is "concurrent" in terms of a NOT happening before b
    return "concurrent";
  }
  throw new Error("Cannot compare clocks of different types");
}

// ---------------------------------------------------------------------------
// Topological sort helpers
// ---------------------------------------------------------------------------

function topologicalSort(events: CausalEvent[]): CausalEvent[] {
  const eventMap = new Map<string, CausalEvent>();
  for (const evt of events) {
    eventMap.set(evt.id, evt);
  }

  const visited = new Set<string>();
  const result: CausalEvent[] = [];

  function visit(eventId: string): void {
    if (visited.has(eventId)) return;
    visited.add(eventId);

    const evt = eventMap.get(eventId);
    if (!evt) return;

    for (const parentId of evt.causalParents) {
      visit(parentId);
    }

    result.push(evt);
  }

  for (const evt of events) {
    visit(evt.id);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Explanation helpers
// ---------------------------------------------------------------------------

function buildExplanation(
  clockA: LogicalClock,
  clockB: LogicalClock,
  relation: CausalRelation,
  eventIdA: string,
  eventIdB: string,
): string {
  if (clockA.type === "lamport" && clockB.type === "lamport") {
    switch (relation) {
      case "happens_before":
        return (
          `Lamport clock: ${eventIdA} has time ${clockA.time} < ${clockB.time} of ${eventIdB}. `
          + `${eventIdA} happens before ${eventIdB}.`
        );
      case "same":
        return (
          `Lamport clock: ${eventIdA} and ${eventIdB} both have time ${clockA.time}. `
          + `With Lamport clocks, equal timestamps indicate potential concurrency.`
        );
      case "concurrent":
        return (
          `Lamport clock: ${eventIdA} has time ${clockA.time}, ${eventIdB} has time ${clockB.time}. `
          + `Lamport timestamps alone cannot determine a causal relationship; these events are concurrent.`
        );
    }
  }

  if (clockA.type === "vector" && clockB.type === "vector") {
    const aEntries = JSON.stringify(clockA.entries);
    const bEntries = JSON.stringify(clockB.entries);

    switch (relation) {
      case "happens_before":
        return (
          `Vector clock: ${eventIdA} ${aEntries} <= ${eventIdB} ${bEntries} with at least one strict inequality. `
          + `${eventIdA} happens before ${eventIdB}.`
        );
      case "same":
        return (
          `Vector clock: ${eventIdA} ${aEntries} and ${eventIdB} ${bEntries} are identical. `
          + `These represent the same causal point.`
        );
      case "concurrent":
        return (
          `Vector clock: ${eventIdA} ${aEntries} and ${eventIdB} ${bEntries} are incomparable. `
          + `Neither dominates the other, so these events are concurrent.`
        );
    }
  }

  return "Cannot compare clocks of different types.";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSystem(opts: CreateSystemOptions): CausalSystem {
  if (opts.processCount < 2 || opts.processCount > 7) {
    throw new Error("Process count must be between 2 and 7");
  }

  const id = generateId();
  const processes = new Map<string, LogicalClock>();
  const processOrder: string[] = [];
  const processIds: string[] = [];

  for (let i = 1; i <= opts.processCount; i++) {
    processIds.push(`process-${i}`);
  }

  for (const pid of processIds) {
    processes.set(pid, createInitialClock(opts.clockType, processIds));
    processOrder.push(pid);
  }

  const system: CausalSystem = {
    id,
    userId: opts.userId,
    name: opts.name,
    clockType: opts.clockType,
    processes,
    processOrder,
    events: [],
    eventCounter: 0,
    createdAt: Date.now(),
  };

  systems.set(id, system);
  return system;
}

export function destroySystem(systemId: string, userId: string): void {
  const system = getSystem(systemId, userId);
  systems.delete(system.id);
}

export function listSystems(userId: string): SystemSummary[] {
  const result: SystemSummary[] = [];
  for (const system of systems.values()) {
    if (system.userId !== userId) continue;
    result.push({
      id: system.id,
      name: system.name,
      clockType: system.clockType,
      processCount: system.processOrder.length,
      eventCount: system.events.length,
      createdAt: system.createdAt,
    });
  }
  return result;
}

export function localEvent(
  systemId: string,
  userId: string,
  processId: string,
  label: string,
): CausalEvent {
  const system = getSystem(systemId, userId);
  const clock = getProcessClock(system, processId);

  // Increment the clock
  if (clock.type === "lamport") {
    incrementLamport(clock);
  } else {
    incrementVector(clock, processId);
  }

  // Determine causal parents: the most recent event on this process
  const causalParents: string[] = [];
  const latestEvent = getLatestEventForProcess(system, processId);
  if (latestEvent) {
    causalParents.push(latestEvent.id);
  }

  const eventId = generateEventId(system);
  const event: CausalEvent = {
    id: eventId,
    processId,
    label,
    clock: cloneClock(clock),
    causalParents,
    timestamp: system.eventCounter,
  };

  system.events.push(event);
  return event;
}

export function sendEvent(
  systemId: string,
  userId: string,
  fromProcessId: string,
  toProcessId: string,
  label: string,
): { sendEvent: CausalEvent; receiveEvent: CausalEvent; } {
  const system = getSystem(systemId, userId);

  if (fromProcessId === toProcessId) {
    throw new Error("Cannot send a message to the same process");
  }

  // Validate both processes exist
  getProcessClock(system, fromProcessId);
  getProcessClock(system, toProcessId);

  // Step 1: Create send event on sender (increments sender's clock)
  const senderClock = getProcessClock(system, fromProcessId);

  if (senderClock.type === "lamport") {
    incrementLamport(senderClock);
  } else {
    incrementVector(senderClock, fromProcessId);
  }

  const sendParents: string[] = [];
  const latestSenderEvent = getLatestEventForProcess(system, fromProcessId);
  if (latestSenderEvent) {
    sendParents.push(latestSenderEvent.id);
  }

  const sendEventId = generateEventId(system);
  const sendEvt: CausalEvent = {
    id: sendEventId,
    processId: fromProcessId,
    label: `send(${label})`,
    clock: cloneClock(senderClock),
    causalParents: sendParents,
    timestamp: system.eventCounter,
  };
  system.events.push(sendEvt);

  // Step 2: Create receive event on receiver (merges clocks)
  const receiverClock = getProcessClock(system, toProcessId);

  if (receiverClock.type === "lamport" && senderClock.type === "lamport") {
    mergeLamportClocks(receiverClock, senderClock);
  } else if (
    receiverClock.type === "vector" && senderClock.type === "vector"
  ) {
    mergeVectorClocks(receiverClock, senderClock, toProcessId);
  }

  const receiveParents: string[] = [sendEventId];
  const latestReceiverEvent = getLatestEventForProcess(system, toProcessId);
  // The latest receiver event is before the receive event we're about to create
  // (the send event is already recorded, so getLatestEventForProcess won't return it
  // for toProcessId because it belongs to fromProcessId)
  if (latestReceiverEvent) {
    receiveParents.push(latestReceiverEvent.id);
  }

  const receiveEventId = generateEventId(system);
  const receiveEvt: CausalEvent = {
    id: receiveEventId,
    processId: toProcessId,
    label: `receive(${label})`,
    clock: cloneClock(receiverClock),
    causalParents: receiveParents,
    timestamp: system.eventCounter,
  };
  system.events.push(receiveEvt);

  return { sendEvent: sendEvt, receiveEvent: receiveEvt };
}

export function compareEvents(
  systemId: string,
  userId: string,
  eventIdA: string,
  eventIdB: string,
): CausalQueryResult {
  const system = getSystem(systemId, userId);

  const eventA = system.events.find(e => e.id === eventIdA);
  const eventB = system.events.find(e => e.id === eventIdB);

  if (!eventA) throw new Error(`Event ${eventIdA} not found`);
  if (!eventB) throw new Error(`Event ${eventIdB} not found`);

  if (eventIdA === eventIdB) {
    return {
      eventA: eventIdA,
      eventB: eventIdB,
      relation: "same",
      explanation: `${eventIdA} and ${eventIdB} are the same event.`,
    };
  }

  const relation = determineRelation(eventA.clock, eventB.clock);
  const explanation = buildExplanation(
    eventA.clock,
    eventB.clock,
    relation,
    eventIdA,
    eventIdB,
  );

  return {
    eventA: eventIdA,
    eventB: eventIdB,
    relation,
    explanation,
  };
}

export function inspect(
  systemId: string,
  userId: string,
  processId?: string,
): SystemStateView {
  const system = getSystem(systemId, userId);

  const processIds = processId ? [processId] : system.processOrder;
  const processes: Array<{ id: string; clock: LogicalClock; }> = processIds.map(
    pid => {
      const clock = getProcessClock(system, pid);
      return { id: pid, clock: cloneClock(clock) };
    },
  );

  const events = processId
    ? system.events.filter(e => e.processId === processId)
    : [...system.events];

  return {
    id: system.id,
    name: system.name,
    clockType: system.clockType,
    processes,
    events,
  };
}

export function getTimeline(
  systemId: string,
  userId: string,
): CausalEvent[] {
  const system = getSystem(systemId, userId);
  return topologicalSort([...system.events]);
}
