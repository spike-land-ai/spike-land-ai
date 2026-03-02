/**
 * CRDT Playground MCP Tools
 *
 * Conflict-free Replicated Data Types simulation.
 * Ported from spike.land — pure in-memory computation, no DB needed.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

type CrdtType = "g_counter" | "pn_counter" | "lww_register" | "or_set";

interface GCounterState {
  type: "g_counter";
  counts: Record<string, number>;
}

interface PNCounterState {
  type: "pn_counter";
  positive: Record<string, number>;
  negative: Record<string, number>;
}

interface LWWRegisterState {
  type: "lww_register";
  value: string | null;
  timestamp: number;
}

interface ORSetState {
  type: "or_set";
  elements: Record<string, string[]>;
}

type ReplicaState = GCounterState | PNCounterState | LWWRegisterState | ORSetState;

interface CrdtReplica {
  id: string;
  state: ReplicaState;
}

interface OperationLog {
  id: string;
  replicaId: string;
  operation: string;
  value?: string;
  timestamp: number;
}

interface CrdtSet {
  id: string;
  userId: string;
  name: string;
  crdtType: CrdtType;
  replicas: Map<string, CrdtReplica>;
  replicaOrder: string[];
  operationLog: OperationLog[];
  timestampCounter: number;
  tagCounter: number;
  createdAt: number;
}

/** Used by tool handlers to format replica state for display. */
export interface ReplicaView {
  id: string;
  state: ReplicaState;
  resolvedValue: string;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const sets = new Map<string, CrdtSet>();

export function clearSets(): void {
  sets.clear();
}

let idCounter = 0;

function generateId(): string {
  return `crdt-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

// ─── Value resolution ────────────────────────────────────────────────────────

function resolveValue(state: ReplicaState): string {
  switch (state.type) {
    case "g_counter": {
      let sum = 0;
      for (const key of Object.keys(state.counts)) sum += state.counts[key]!;
      return String(sum);
    }
    case "pn_counter": {
      let pos = 0;
      for (const key of Object.keys(state.positive)) pos += state.positive[key]!;
      let neg = 0;
      for (const key of Object.keys(state.negative)) neg += state.negative[key]!;
      return String(pos - neg);
    }
    case "lww_register":
      return state.value ?? "(null)";
    case "or_set": {
      const values: string[] = [];
      for (const [val, tags] of Object.entries(state.elements)) {
        if (tags.length > 0) values.push(val);
      }
      values.sort();
      return values.length > 0 ? `{${values.join(", ")}}` : "{}";
    }
  }
}

// ─── State helpers ───────────────────────────────────────────────────────────

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
      return { type: "lww_register", value: state.value, timestamp: state.timestamp };
    case "or_set": {
      const elements: Record<string, string[]> = {};
      for (const [val, tags] of Object.entries(state.elements)) elements[val] = [...tags];
      return { type: "or_set", elements };
    }
  }
}

// ─── CRDT operations ─────────────────────────────────────────────────────────

function applyOperation(
  state: ReplicaState,
  replicaId: string,
  operation: string,
  value: string | undefined,
  set: CrdtSet,
): void {
  switch (state.type) {
    case "g_counter": {
      if (operation !== "increment")
        throw new Error(`Invalid operation "${operation}" for G-Counter. Use "increment".`);
      const amount = value ? parseInt(value, 10) : 1;
      if (isNaN(amount) || amount < 1)
        throw new Error("Increment value must be a positive integer");
      state.counts[replicaId] = (state.counts[replicaId] ?? 0) + amount;
      break;
    }
    case "pn_counter": {
      if (operation !== "increment" && operation !== "decrement")
        throw new Error(`Invalid operation "${operation}" for PN-Counter.`);
      const amount = value ? parseInt(value, 10) : 1;
      if (isNaN(amount) || amount < 1) throw new Error("Value must be a positive integer");
      if (operation === "increment")
        state.positive[replicaId] = (state.positive[replicaId] ?? 0) + amount;
      else state.negative[replicaId] = (state.negative[replicaId] ?? 0) + amount;
      break;
    }
    case "lww_register": {
      if (operation !== "set")
        throw new Error(`Invalid operation "${operation}" for LWW-Register. Use "set".`);
      if (value === undefined) throw new Error('LWW-Register "set" operation requires a value');
      set.timestampCounter++;
      state.value = value;
      state.timestamp = set.timestampCounter;
      break;
    }
    case "or_set": {
      if (operation !== "add" && operation !== "remove")
        throw new Error(`Invalid operation "${operation}" for OR-Set.`);
      if (value === undefined) throw new Error(`OR-Set "${operation}" operation requires a value`);
      if (operation === "add") {
        if (!state.elements[value]) state.elements[value] = [];
        set.tagCounter++;
        state.elements[value]!.push(`tag-${set.tagCounter}`);
      } else {
        state.elements[value] = [];
      }
      break;
    }
  }
}

// ─── CRDT merge ──────────────────────────────────────────────────────────────

function mergeStates(target: ReplicaState, source: ReplicaState): void {
  if (target.type !== source.type) throw new Error("Cannot merge different CRDT types");
  switch (target.type) {
    case "g_counter": {
      const s = source as GCounterState;
      const allKeys = new Set([...Object.keys(target.counts), ...Object.keys(s.counts)]);
      for (const key of allKeys)
        target.counts[key] = Math.max(target.counts[key] ?? 0, s.counts[key] ?? 0);
      break;
    }
    case "pn_counter": {
      const s = source as PNCounterState;
      for (const key of new Set([...Object.keys(target.positive), ...Object.keys(s.positive)])) {
        target.positive[key] = Math.max(target.positive[key] ?? 0, s.positive[key] ?? 0);
      }
      for (const key of new Set([...Object.keys(target.negative), ...Object.keys(s.negative)])) {
        target.negative[key] = Math.max(target.negative[key] ?? 0, s.negative[key] ?? 0);
      }
      break;
    }
    case "lww_register": {
      const s = source as LWWRegisterState;
      if (s.timestamp > target.timestamp) {
        target.value = s.value;
        target.timestamp = s.timestamp;
      }
      break;
    }
    case "or_set": {
      const s = source as ORSetState;
      const allValues = new Set([...Object.keys(target.elements), ...Object.keys(s.elements)]);
      for (const val of allValues) {
        const merged = new Set([...(target.elements[val] ?? []), ...(s.elements[val] ?? [])]);
        target.elements[val] = [...merged];
      }
      break;
    }
  }
}

// ─── Access helpers ──────────────────────────────────────────────────────────

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

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatReplicaState(replicaId: string, state: ReplicaState, resolvedValue: string): string {
  let stateDetail: string;
  switch (state.type) {
    case "g_counter": {
      const entries = Object.entries(state.counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      stateDetail = `counts: {${entries}}`;
      break;
    }
    case "pn_counter": {
      const posEntries = Object.entries(state.positive)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const negEntries = Object.entries(state.negative)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      stateDetail = `positive: {${posEntries}}, negative: {${negEntries}}`;
      break;
    }
    case "lww_register":
      stateDetail = `value: "${state.value ?? "null"}", timestamp: ${state.timestamp}`;
      break;
    case "or_set": {
      const entries = Object.entries(state.elements)
        .map(([k, tags]) => `"${k}": [${tags.join(", ")}]`)
        .join(", ");
      stateDetail = `elements: {${entries}}`;
      break;
    }
    default:
      stateDetail = JSON.stringify(state);
  }
  return `| ${replicaId} | ${resolvedValue} | ${stateDetail} |`;
}

// ─── Registration ────────────────────────────────────────────────────────────

const CrdtTypeEnum = z
  .enum(["g_counter", "pn_counter", "lww_register", "or_set"])
  .describe("Type of CRDT: g_counter, pn_counter, lww_register, or or_set.");

export function registerCrdtTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "crdt_create_set",
        "Create a CRDT replica set. Choose a type (g_counter, pn_counter, lww_register, or_set) and number of replicas (2-7). Returns the set ID, replica list, and initial state.",
        {
          name: z.string().min(1).describe("Name for the CRDT set."),
          replica_count: z.number().int().min(2).max(7).describe("Number of replicas (2-7)."),
          type: CrdtTypeEnum,
        },
      )
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const id = generateId();
        const replicas = new Map<string, CrdtReplica>();
        const replicaOrder: string[] = [];
        for (let i = 1; i <= input.replica_count; i++) {
          const replicaId = `replica-${i}`;
          replicas.set(replicaId, { id: replicaId, state: createInitialState(input.type) });
          replicaOrder.push(replicaId);
        }
        const set: CrdtSet = {
          id,
          userId,
          name: input.name,
          crdtType: input.type,
          replicas,
          replicaOrder,
          operationLog: [],
          timestampCounter: 0,
          tagCounter: 0,
          createdAt: Date.now(),
        };
        sets.set(id, set);
        return textResult(
          `**CRDT Set Created**\n\n**ID:** ${set.id}\n**Name:** ${set.name}\n**Type:** ${set.crdtType}\n**Replicas:** ${set.replicaOrder.join(", ")}\n\nUse \`crdt_update\` to apply operations to individual replicas, then \`crdt_sync_pair\` or \`crdt_sync_all\` to merge state.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("crdt_update", "Apply an operation to a specific replica.", {
        set_id: z.string().min(1).describe("ID of the CRDT set."),
        replica_id: z.string().min(1).describe("ID of the replica to update."),
        operation: z.string().min(1).describe("Operation to apply."),
        value: z.string().optional().describe("Value for the operation."),
      })
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const replica = getReplica(set, input.replica_id);
        applyOperation(replica.state, input.replica_id, input.operation, input.value, set);
        const opLog: OperationLog = {
          id: `op-${set.operationLog.length + 1}`,
          replicaId: input.replica_id,
          operation: input.operation,
          ...(input.value !== undefined ? { value: input.value } : {}),
          timestamp: set.timestampCounter,
        };
        set.operationLog.push(opLog);
        const stateRow = formatReplicaState(replica.id, replica.state, resolveValue(replica.state));
        return textResult(
          `**Operation Applied**\n\n**Replica:** ${input.replica_id}\n**Operation:** ${input.operation}${input.value ? ` (value: "${input.value}")` : ""}\n**Resolved Value:** ${resolveValue(replica.state)}\n\n| Replica | Value | Internal State |\n|---|---|---|\n${stateRow}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("crdt_sync_pair", "Sync (merge) state from one replica to another.", {
        set_id: z.string().min(1).describe("ID of the CRDT set."),
        from_replica: z.string().min(1).describe("Source replica ID."),
        to_replica: z.string().min(1).describe("Target replica ID."),
      })
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const fromReplica = getReplica(set, input.from_replica);
        const toReplica = getReplica(set, input.to_replica);
        mergeStates(toReplica.state, cloneState(fromReplica.state));
        const fromRow = formatReplicaState(
          fromReplica.id,
          fromReplica.state,
          resolveValue(fromReplica.state),
        );
        const toRow = formatReplicaState(
          toReplica.id,
          toReplica.state,
          resolveValue(toReplica.state),
        );
        return textResult(
          `**Sync Complete** (${input.from_replica} -> ${input.to_replica})\n\n| Replica | Value | Internal State |\n|---|---|---|\n${fromRow}\n${toRow}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("crdt_sync_all", "Synchronize all replicas in the set.", {
        set_id: z.string().min(1).describe("ID of the CRDT set."),
      })
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const allStates = set.replicaOrder.map((rid) => set.replicas.get(rid)!.state);
        const merged = cloneState(allStates[0]!);
        for (let i = 1; i < allStates.length; i++) mergeStates(merged, cloneState(allStates[i]!));
        for (const replicaId of set.replicaOrder)
          set.replicas.get(replicaId)!.state = cloneState(merged);
        const rows = set.replicaOrder
          .map((rid) => {
            const r = set.replicas.get(rid)!;
            return formatReplicaState(r.id, r.state, resolveValue(r.state));
          })
          .join("\n");
        return textResult(
          `**All Replicas Synchronized**\n\n**Converged:** Yes\n\n| Replica | Value | Internal State |\n|---|---|---|\n${rows}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("crdt_inspect", "Inspect the internal CRDT state of one or all replicas.", {
        set_id: z.string().min(1).describe("ID of the CRDT set."),
        replica_id: z.string().optional().describe("Optional replica ID to inspect."),
      })
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const replicaIds = input.replica_id ? [input.replica_id] : set.replicaOrder;
        const rows = replicaIds
          .map((rid) => {
            const replica = getReplica(set, rid);
            return formatReplicaState(replica.id, replica.state, resolveValue(replica.state));
          })
          .join("\n");
        return textResult(
          `**CRDT Set: ${set.name}** (${set.crdtType})\n\n**Operations logged:** ${set.operationLog.length}\n\n| Replica | Value | Internal State |\n|---|---|---|\n${rows}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "crdt_check_convergence",
        "Check whether all replicas have converged to the same value.",
        {
          set_id: z.string().min(1).describe("ID of the CRDT set."),
        },
      )
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const replicaValues = set.replicaOrder.map((rid) => ({
          id: rid,
          value: resolveValue(set.replicas.get(rid)!.state),
        }));
        const diffs: Array<{ replicaA: string; replicaB: string; valueA: string; valueB: string }> =
          [];
        for (let i = 0; i < replicaValues.length; i++) {
          for (let j = i + 1; j < replicaValues.length; j++) {
            const a = replicaValues[i]!,
              b = replicaValues[j]!;
            if (a.value !== b.value)
              diffs.push({ replicaA: a.id, replicaB: b.id, valueA: a.value, valueB: b.value });
          }
        }
        if (diffs.length === 0)
          return textResult(
            `**Convergence Check: CONVERGED**\n\nAll replicas agree on the same value.`,
          );
        const diffRows = diffs
          .map((d) => `| ${d.replicaA} | ${d.replicaB} | ${d.valueA} | ${d.valueB} |`)
          .join("\n");
        return textResult(
          `**Convergence Check: NOT CONVERGED**\n\n${diffs.length} difference(s) found:\n\n| Replica A | Replica B | Value A | Value B |\n|---|---|---|---|\n${diffRows}\n\nUse \`crdt_sync_pair\` or \`crdt_sync_all\` to merge state and achieve convergence.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "crdt_compare_with_consensus",
        "Compare the current CRDT set's AP behavior with how a CP (Raft/Paxos) system would handle the same scenario.",
        {
          set_id: z.string().min(1).describe("ID of the CRDT set."),
          scenario_description: z
            .string()
            .min(1)
            .describe("Description of the scenario to compare."),
        },
      )
      .meta({ category: "crdt", tier: "free" })
      .handler(async ({ input }) => {
        const set = getSet(input.set_id, userId);
        const replicaValues = set.replicaOrder.map((rid) =>
          resolveValue(set.replicas.get(rid)!.state),
        );
        const converged = replicaValues.every((v) => v === replicaValues[0]);
        const currentState = converged
          ? "All replicas have **converged** to the same value."
          : "Replicas have **not converged** yet.";
        const typeDesc: Record<CrdtType, string> = {
          g_counter: "G-Counter uses per-replica counters merged via max. AP data structure.",
          pn_counter: "PN-Counter extends G-Counter with separate decrement counters. Fully AP.",
          lww_register:
            "LWW-Register resolves conflicts by choosing the value with the highest timestamp. AP.",
          or_set:
            "OR-Set uses unique tags per add operation. Concurrent add/remove results in add-wins. AP.",
        };
        return textResult(
          `## AP (CRDT) vs CP (Raft/Paxos) Comparison\n\n**CRDT Type:** ${set.crdtType}\n**Scenario:** ${input.scenario_description}\n**Current State:** ${currentState}\n\n### How this CRDT works\n\n${typeDesc[set.crdtType]}\n\n### Tradeoffs\n\n**AP (this CRDT):**\n- Every replica can accept writes independently\n- Replicas may temporarily disagree\n- Merge function guarantees convergence\n\n**CP (Raft consensus):**\n- All reads return the latest committed value\n- Writes require a leader and majority quorum\n- Unavailable during network partitions`,
        );
      }),
  );
}
