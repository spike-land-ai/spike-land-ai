/**
 * CRDT Playground - Simulation Engine
 *
 * Pure business logic with in-memory storage.
 * Deterministic simulation of G-Counter, PN-Counter, LWW-Register, and OR-Set CRDTs.
 */

import type {
  ConvergenceDiff,
  ConvergenceResult,
  CrdtReplica,
  CrdtSet,
  CrdtType,
  CreateSetOptions,
  GCounterState,
  LWWRegisterState,
  OperationLog,
  ORSetState,
  PNCounterState,
  ReplicaState,
  ReplicaView,
  SetStateView,
  SetSummary,
} from "./types";

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------

const sets = new Map<string, CrdtSet>();

export function clearSets(): void {
  sets.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  return `crdt-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function generateOpId(set: CrdtSet): string {
  return `op-${set.operationLog.length + 1}`;
}

// ---------------------------------------------------------------------------
// CRDT value resolution
// ---------------------------------------------------------------------------

function resolveGCounterValue(state: GCounterState): number {
  let sum = 0;
  for (const key of Object.keys(state.counts)) {
    sum += state.counts[key]!;
  }
  return sum;
}

function resolvePNCounterValue(state: PNCounterState): number {
  let pos = 0;
  for (const key of Object.keys(state.positive)) {
    pos += state.positive[key]!;
  }
  let neg = 0;
  for (const key of Object.keys(state.negative)) {
    neg += state.negative[key]!;
  }
  return pos - neg;
}

function resolveLWWRegisterValue(state: LWWRegisterState): string {
  return state.value ?? "(null)";
}

function resolveORSetValue(state: ORSetState): string {
  const values: string[] = [];
  for (const [val, tags] of Object.entries(state.elements)) {
    if (tags.length > 0) {
      values.push(val);
    }
  }
  values.sort();
  return values.length > 0 ? `{${values.join(", ")}}` : "{}";
}

function resolveValue(state: ReplicaState): string {
  switch (state.type) {
    case "g_counter":
      return String(resolveGCounterValue(state));
    case "pn_counter":
      return String(resolvePNCounterValue(state));
    case "lww_register":
      return resolveLWWRegisterValue(state);
    case "or_set":
      return resolveORSetValue(state);
  }
}

// ---------------------------------------------------------------------------
// Initial state factories
// ---------------------------------------------------------------------------

function createInitialState(crdtType: CrdtType): ReplicaState {
  switch (crdtType) {
    case "g_counter":
      return { type: "g_counter", counts: {} };
    case "pn_counter":
      return { type: "pn_counter", positive: {}, negative: {} };
    case "lww_register":
      return { type: "lww_register", value: null, timestamp: 0 };
    case "or_set":
      return { type: "or_set", elements: {} };
  }
}

// ---------------------------------------------------------------------------
// Deep clone for state (avoids shared references)
// ---------------------------------------------------------------------------

function cloneState(state: ReplicaState): ReplicaState {
  switch (state.type) {
    case "g_counter":
      return { type: "g_counter", counts: { ...state.counts } };
    case "pn_counter":
      return {
        type: "pn_counter",
        positive: { ...state.positive },
        negative: { ...state.negative },
      };
    case "lww_register":
      return {
        type: "lww_register",
        value: state.value,
        timestamp: state.timestamp,
      };
    case "or_set": {
      const elements: Record<string, string[]> = {};
      for (const [val, tags] of Object.entries(state.elements)) {
        elements[val] = [...tags];
      }
      return { type: "or_set", elements };
    }
  }
}

// ---------------------------------------------------------------------------
// CRDT operations (apply)
// ---------------------------------------------------------------------------

function applyGCounter(
  state: GCounterState,
  replicaId: string,
  operation: string,
  value?: string,
): void {
  if (operation !== "increment") {
    throw new Error(
      `Invalid operation "${operation}" for G-Counter. Use "increment".`,
    );
  }
  const amount = value ? parseInt(value, 10) : 1;
  if (isNaN(amount) || amount < 1) {
    throw new Error("Increment value must be a positive integer");
  }
  state.counts[replicaId] = (state.counts[replicaId] ?? 0) + amount;
}

function applyPNCounter(
  state: PNCounterState,
  replicaId: string,
  operation: string,
  value?: string,
): void {
  if (operation !== "increment" && operation !== "decrement") {
    throw new Error(
      `Invalid operation "${operation}" for PN-Counter. Use "increment" or "decrement".`,
    );
  }
  const amount = value ? parseInt(value, 10) : 1;
  if (isNaN(amount) || amount < 1) {
    throw new Error("Value must be a positive integer");
  }
  if (operation === "increment") {
    state.positive[replicaId] = (state.positive[replicaId] ?? 0) + amount;
  } else {
    state.negative[replicaId] = (state.negative[replicaId] ?? 0) + amount;
  }
}

function applyLWWRegister(
  state: LWWRegisterState,
  _replicaId: string,
  operation: string,
  value: string | undefined,
  timestamp: number,
): void {
  if (operation !== "set") {
    throw new Error(
      `Invalid operation "${operation}" for LWW-Register. Use "set".`,
    );
  }
  if (value === undefined) {
    throw new Error("LWW-Register \"set\" operation requires a value");
  }
  state.value = value;
  state.timestamp = timestamp;
}

function applyORSet(
  state: ORSetState,
  _replicaId: string,
  operation: string,
  value: string | undefined,
  tag: string,
): void {
  if (operation !== "add" && operation !== "remove") {
    throw new Error(
      `Invalid operation "${operation}" for OR-Set. Use "add" or "remove".`,
    );
  }
  if (value === undefined) {
    throw new Error(`OR-Set "${operation}" operation requires a value`);
  }

  if (operation === "add") {
    if (!state.elements[value]) {
      state.elements[value] = [];
    }
    state.elements[value]!.push(tag);
  } else {
    // remove: remove all known tags for this value
    state.elements[value] = [];
  }
}

// ---------------------------------------------------------------------------
// CRDT merge
// ---------------------------------------------------------------------------

function mergeGCounter(
  target: GCounterState,
  source: GCounterState,
): void {
  const allKeys = new Set([
    ...Object.keys(target.counts),
    ...Object.keys(source.counts),
  ]);
  for (const key of allKeys) {
    target.counts[key] = Math.max(
      target.counts[key] ?? 0,
      source.counts[key] ?? 0,
    );
  }
}

function mergePNCounter(
  target: PNCounterState,
  source: PNCounterState,
): void {
  // Merge positive
  const posKeys = new Set([
    ...Object.keys(target.positive),
    ...Object.keys(source.positive),
  ]);
  for (const key of posKeys) {
    target.positive[key] = Math.max(
      target.positive[key] ?? 0,
      source.positive[key] ?? 0,
    );
  }
  // Merge negative
  const negKeys = new Set([
    ...Object.keys(target.negative),
    ...Object.keys(source.negative),
  ]);
  for (const key of negKeys) {
    target.negative[key] = Math.max(
      target.negative[key] ?? 0,
      source.negative[key] ?? 0,
    );
  }
}

function mergeLWWRegister(
  target: LWWRegisterState,
  source: LWWRegisterState,
): void {
  if (source.timestamp > target.timestamp) {
    target.value = source.value;
    target.timestamp = source.timestamp;
  }
}

function mergeORSet(target: ORSetState, source: ORSetState): void {
  const allValues = new Set([
    ...Object.keys(target.elements),
    ...Object.keys(source.elements),
  ]);
  for (const val of allValues) {
    const targetTags = target.elements[val] ?? [];
    const sourceTags = source.elements[val] ?? [];
    // Union of all tags
    const merged = new Set([...targetTags, ...sourceTags]);
    target.elements[val] = [...merged];
  }
}

function mergeStates(target: ReplicaState, source: ReplicaState): void {
  if (target.type !== source.type) {
    throw new Error("Cannot merge different CRDT types");
  }
  switch (target.type) {
    case "g_counter":
      mergeGCounter(target, source as GCounterState);
      break;
    case "pn_counter":
      mergePNCounter(target, source as PNCounterState);
      break;
    case "lww_register":
      mergeLWWRegister(target, source as LWWRegisterState);
      break;
    case "or_set":
      mergeORSet(target, source as ORSetState);
      break;
  }
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

function getSet(setId: string, userId: string): CrdtSet {
  const set = sets.get(setId);
  if (!set) throw new Error(`Set ${setId} not found`);
  if (set.userId !== userId) throw new Error("Access denied");
  return set;
}

function getReplica(set: CrdtSet, replicaId: string): CrdtReplica {
  const replica = set.replicas.get(replicaId);
  if (!replica) throw new Error(`Replica ${replicaId} not found`);
  return replica;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSet(opts: CreateSetOptions): CrdtSet {
  if (opts.replicaCount < 2 || opts.replicaCount > 7) {
    throw new Error("Replica count must be between 2 and 7");
  }

  const id = generateId();
  const replicas = new Map<string, CrdtReplica>();
  const replicaOrder: string[] = [];

  for (let i = 1; i <= opts.replicaCount; i++) {
    const replicaId = `replica-${i}`;
    replicas.set(replicaId, {
      id: replicaId,
      state: createInitialState(opts.crdtType),
    });
    replicaOrder.push(replicaId);
  }

  const set: CrdtSet = {
    id,
    userId: opts.userId,
    name: opts.name,
    crdtType: opts.crdtType,
    replicas,
    replicaOrder,
    operationLog: [],
    timestampCounter: 0,
    tagCounter: 0,
    createdAt: Date.now(),
  };

  sets.set(id, set);
  return set;
}

export function destroySet(setId: string, userId: string): void {
  const set = getSet(setId, userId);
  sets.delete(set.id);
}

export function listSets(userId: string): SetSummary[] {
  const result: SetSummary[] = [];
  for (const set of sets.values()) {
    if (set.userId !== userId) continue;
    result.push({
      id: set.id,
      name: set.name,
      crdtType: set.crdtType,
      replicaCount: set.replicaOrder.length,
      operationCount: set.operationLog.length,
      createdAt: set.createdAt,
    });
  }
  return result;
}

export function update(
  setId: string,
  userId: string,
  replicaId: string,
  operation: string,
  value?: string,
): { replica: ReplicaView; opLog: OperationLog; } {
  const set = getSet(setId, userId);
  const replica = getReplica(set, replicaId);

  switch (replica.state.type) {
    case "g_counter":
      applyGCounter(replica.state, replicaId, operation, value);
      break;
    case "pn_counter":
      applyPNCounter(replica.state, replicaId, operation, value);
      break;
    case "lww_register": {
      set.timestampCounter++;
      applyLWWRegister(
        replica.state,
        replicaId,
        operation,
        value,
        set.timestampCounter,
      );
      break;
    }
    case "or_set": {
      set.tagCounter++;
      const tag = `tag-${set.tagCounter}`;
      applyORSet(replica.state, replicaId, operation, value, tag);
      break;
    }
  }

  const opLog: OperationLog = {
    id: generateOpId(set),
    replicaId,
    operation,
    value,
    timestamp: set.timestampCounter,
  };
  set.operationLog.push(opLog);

  return {
    replica: {
      id: replica.id,
      state: replica.state,
      resolvedValue: resolveValue(replica.state),
    },
    opLog,
  };
}

export function syncPair(
  setId: string,
  userId: string,
  fromReplicaId: string,
  toReplicaId: string,
): { from: ReplicaView; to: ReplicaView; } {
  const set = getSet(setId, userId);
  const fromReplica = getReplica(set, fromReplicaId);
  const toReplica = getReplica(set, toReplicaId);

  // Clone the source state before merge so the merge doesn't create
  // shared references
  const sourceClone = cloneState(fromReplica.state);
  mergeStates(toReplica.state, sourceClone);

  return {
    from: {
      id: fromReplica.id,
      state: fromReplica.state,
      resolvedValue: resolveValue(fromReplica.state),
    },
    to: {
      id: toReplica.id,
      state: toReplica.state,
      resolvedValue: resolveValue(toReplica.state),
    },
  };
}

export function syncAll(
  setId: string,
  userId: string,
): { replicas: ReplicaView[]; converged: boolean; } {
  const set = getSet(setId, userId);

  // Gather all states, merge them all into a single merged state
  const allStates = set.replicaOrder.map(
    rid => set.replicas.get(rid)!.state,
  );

  // Create a merged state by cloning the first and merging all others
  const merged = cloneState(allStates[0]!);
  for (let i = 1; i < allStates.length; i++) {
    mergeStates(merged, cloneState(allStates[i]!));
  }

  // Apply the merged state to all replicas
  for (const replicaId of set.replicaOrder) {
    const replica = set.replicas.get(replicaId)!;
    replica.state = cloneState(merged);
  }

  const replicas: ReplicaView[] = set.replicaOrder.map(rid => {
    const replica = set.replicas.get(rid)!;
    return {
      id: replica.id,
      state: replica.state,
      resolvedValue: resolveValue(replica.state),
    };
  });

  return { replicas, converged: true };
}

export function inspect(
  setId: string,
  userId: string,
  replicaId?: string,
): SetStateView {
  const set = getSet(setId, userId);

  const replicaIds = replicaId ? [replicaId] : set.replicaOrder;
  const replicas: ReplicaView[] = replicaIds.map(rid => {
    const replica = getReplica(set, rid);
    return {
      id: replica.id,
      state: replica.state,
      resolvedValue: resolveValue(replica.state),
    };
  });

  return {
    id: set.id,
    name: set.name,
    crdtType: set.crdtType,
    replicas,
    operationCount: set.operationLog.length,
  };
}

export function checkConvergence(
  setId: string,
  userId: string,
): ConvergenceResult {
  const set = getSet(setId, userId);
  const diffs: ConvergenceDiff[] = [];

  const replicaValues: Array<{ id: string; value: string; }> = set.replicaOrder
    .map(rid => {
      const replica = set.replicas.get(rid)!;
      return { id: rid, value: resolveValue(replica.state) };
    });

  // Compare all pairs
  for (let i = 0; i < replicaValues.length; i++) {
    for (let j = i + 1; j < replicaValues.length; j++) {
      const a = replicaValues[i]!;
      const b = replicaValues[j]!;
      if (a.value !== b.value) {
        diffs.push({
          replicaA: a.id,
          replicaB: b.id,
          valueA: a.value,
          valueB: b.value,
        });
      }
    }
  }

  return { converged: diffs.length === 0, diffs };
}

export function compareWithConsensus(
  setId: string,
  userId: string,
  scenarioDescription: string,
): string {
  const set = getSet(setId, userId);
  const convergence = checkConvergence(setId, userId);

  const typeDescriptions: Record<CrdtType, string> = {
    g_counter: "G-Counter (Grow-only Counter) uses per-replica counters merged via max. "
      + "It is an AP data structure: every replica can increment independently without coordination. "
      + "In a CP system like Raft, a counter would require leader-mediated writes, "
      + "ensuring a single total order but requiring availability sacrifices during network partitions.",
    pn_counter:
      "PN-Counter (Positive-Negative Counter) extends G-Counter with a separate decrement counter. "
      + "Both halves merge independently via max, making it fully AP. "
      + "A CP counter would serialize increments and decrements through a leader, "
      + "preventing any temporary divergence but blocking writes during partitions.",
    lww_register:
      "LWW-Register (Last-Writer-Wins Register) resolves conflicts by choosing the value with the highest timestamp. "
      + "It is AP: concurrent writes are both accepted, and the latest timestamp wins on merge. "
      + "In a CP system, writes would be serialized through a leader using a replicated log, "
      + "giving strong consistency but requiring a quorum for every write.",
    or_set:
      "OR-Set (Observed-Remove Set) uses unique tags per add operation, and remove deletes only known tags. "
      + "Concurrent add and remove of the same element results in the element being present (add wins). "
      + "This is AP: no coordination needed for add/remove. "
      + "A CP set would use a replicated log to serialize add/remove operations, "
      + "ensuring a single consistent view but requiring leader availability.",
  };

  const currentState = convergence.converged
    ? "All replicas have **converged** to the same value."
    : `Replicas have **not converged** yet. There are ${convergence.diffs.length} difference(s) between replica pairs.`;

  return (
    `## AP (CRDT) vs CP (Raft/Paxos) Comparison\n\n`
    + `**CRDT Type:** ${set.crdtType}\n`
    + `**Scenario:** ${scenarioDescription}\n`
    + `**Current State:** ${currentState}\n\n`
    + `### How this CRDT works\n\n`
    + `${typeDescriptions[set.crdtType]}\n\n`
    + `### Tradeoffs for this scenario\n\n`
    + `**AP (this CRDT):**\n`
    + `- Every replica can accept writes independently (high availability)\n`
    + `- Replicas may temporarily disagree (eventual consistency)\n`
    + `- Merge function guarantees convergence without coordination\n`
    + `- No single point of failure\n\n`
    + `**CP (Raft consensus):**\n`
    + `- All reads return the latest committed value (strong consistency)\n`
    + `- Writes require a leader and majority quorum\n`
    + `- Unavailable during network partitions that prevent quorum\n`
    + `- Total ordering of all operations\n\n`
    + `### Recommendation\n\n`
    + `For "${scenarioDescription}": `
    + (set.crdtType === "lww_register"
      ? "If conflict resolution by last-write-wins is acceptable, the CRDT approach provides higher availability. If exact ordering matters, prefer CP."
      : set.crdtType === "or_set"
      ? "If add-wins semantics for concurrent add/remove are acceptable, use the CRDT. If remove must be authoritative, prefer CP with serialized operations."
      : "If temporary divergence between replicas is acceptable, the CRDT provides better availability and partition tolerance. If exact agreement at all times is required, prefer CP.")
  );
}
