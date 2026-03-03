import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import type { ReplicaState } from "@/lib/crdt/types";

// Re-export for test cleanup
export { clearSets } from "@/lib/crdt/engine";

// --- Zod schemas ---

const CrdtTypeEnum = z
  .enum(["g_counter", "pn_counter", "lww_register", "or_set"])
  .describe("Type of CRDT: g_counter, pn_counter, lww_register, or or_set.");

const CreateSetSchema = z.object({
  name: z.string().min(1).describe("Name for the CRDT set."),
  replica_count: z
    .number()
    .int()
    .min(2)
    .max(7)
    .describe("Number of replicas (2-7)."),
  type: CrdtTypeEnum,
});

const UpdateSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
  replica_id: z.string().min(1).describe("ID of the replica to update."),
  operation: z
    .string()
    .min(1)
    .describe(
      "Operation to apply. G-Counter: increment. PN-Counter: increment|decrement. LWW-Register: set. OR-Set: add|remove.",
    ),
  value: z
    .string()
    .optional()
    .describe(
      "Value for the operation. Required for LWW-Register set, OR-Set add/remove. Optional amount for counters.",
    ),
});

const SyncPairSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
  from_replica: z
    .string()
    .min(1)
    .describe("Source replica ID to sync from."),
  to_replica: z
    .string()
    .min(1)
    .describe("Target replica ID to sync to."),
});

const SyncAllSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
});

const InspectSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
  replica_id: z
    .string()
    .optional()
    .describe("Optional replica ID to inspect. Omit to inspect all replicas."),
});

const CheckConvergenceSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
});

const CompareWithConsensusSchema = z.object({
  set_id: z.string().min(1).describe("ID of the CRDT set."),
  scenario_description: z
    .string()
    .min(1)
    .describe(
      "Description of the scenario to compare AP (CRDT) vs CP (Raft) tradeoffs.",
    ),
});

// --- Helpers for formatting internal state ---

function formatReplicaState(
  replicaId: string,
  state: ReplicaState,
  resolvedValue: string,
): string {
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
    case "lww_register": {
      stateDetail = `value: "${state.value ?? "null"}", timestamp: ${state.timestamp}`;
      break;
    }
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

// --- Registration ---

export function registerCrdtTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "crdt_create_set",
    description:
      "Create a CRDT replica set. Choose a type (g_counter, pn_counter, lww_register, or_set) and number of replicas (2-7). Returns the set ID, replica list, and initial state.",
    category: "crdt",
    tier: "free",
    inputSchema: CreateSetSchema.shape,
    handler: async (
      args: z.infer<typeof CreateSetSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_create_set", async () => {
        const { createSet } = await import("@/lib/crdt/engine");
        const set = createSet({
          userId,
          name: args.name,
          replicaCount: args.replica_count,
          crdtType: args.type,
        });

        return textResult(
          `**CRDT Set Created**\n\n`
            + `**ID:** ${set.id}\n`
            + `**Name:** ${set.name}\n`
            + `**Type:** ${set.crdtType}\n`
            + `**Replicas:** ${set.replicaOrder.join(", ")}\n\n`
            + `Use \`crdt_update\` to apply operations to individual replicas, then \`crdt_sync_pair\` or \`crdt_sync_all\` to merge state.`,
        );
      }),
  });

  registry.register({
    name: "crdt_update",
    description:
      "Apply an operation to a specific replica. Operations depend on CRDT type: g_counter (increment), pn_counter (increment|decrement), lww_register (set, requires value), or_set (add|remove, requires value).",
    category: "crdt",
    tier: "free",
    inputSchema: UpdateSchema.shape,
    handler: async (
      args: z.infer<typeof UpdateSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_update", async () => {
        const { update } = await import("@/lib/crdt/engine");
        const result = update(
          args.set_id,
          userId,
          args.replica_id,
          args.operation,
          args.value,
        );

        const stateRow = formatReplicaState(
          result.replica.id,
          result.replica.state,
          result.replica.resolvedValue,
        );

        return textResult(
          `**Operation Applied**\n\n`
            + `**Replica:** ${args.replica_id}\n`
            + `**Operation:** ${args.operation}${args.value ? ` (value: "${args.value}")` : ""}\n`
            + `**Resolved Value:** ${result.replica.resolvedValue}\n\n`
            + `| Replica | Value | Internal State |\n`
            + `|---|---|---|\n`
            + `${stateRow}`,
        );
      }),
  });

  registry.register({
    name: "crdt_sync_pair",
    description:
      "Sync (merge) state from one replica to another. The target replica's state is updated by merging the source's state into it.",
    category: "crdt",
    tier: "free",
    inputSchema: SyncPairSchema.shape,
    handler: async (
      args: z.infer<typeof SyncPairSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_sync_pair", async () => {
        const { syncPair } = await import("@/lib/crdt/engine");
        const result = syncPair(
          args.set_id,
          userId,
          args.from_replica,
          args.to_replica,
        );

        const fromRow = formatReplicaState(
          result.from.id,
          result.from.state,
          result.from.resolvedValue,
        );
        const toRow = formatReplicaState(
          result.to.id,
          result.to.state,
          result.to.resolvedValue,
        );

        return textResult(
          `**Sync Complete** (${args.from_replica} -> ${args.to_replica})\n\n`
            + `| Replica | Value | Internal State |\n`
            + `|---|---|---|\n`
            + `${fromRow}\n`
            + `${toRow}`,
        );
      }),
  });

  registry.register({
    name: "crdt_sync_all",
    description:
      "Synchronize all replicas in the set. Merges all states together so every replica converges to the same value.",
    category: "crdt",
    tier: "free",
    inputSchema: SyncAllSchema.shape,
    handler: async (
      args: z.infer<typeof SyncAllSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_sync_all", async () => {
        const { syncAll } = await import("@/lib/crdt/engine");
        const result = syncAll(args.set_id, userId);

        const rows = result.replicas
          .map(r =>
            formatReplicaState(
              r.id,
              r.state,
              r.resolvedValue,
            )
          )
          .join("\n");

        return textResult(
          `**All Replicas Synchronized**\n\n`
            + `**Converged:** ${result.converged ? "Yes" : "No"}\n\n`
            + `| Replica | Value | Internal State |\n`
            + `|---|---|---|\n`
            + `${rows}`,
        );
      }),
  });

  registry.register({
    name: "crdt_inspect",
    description:
      "Inspect the internal CRDT state of one or all replicas. Shows counters, tombstones, vector clocks, and resolved values.",
    category: "crdt",
    tier: "free",
    inputSchema: InspectSchema.shape,
    handler: async (
      args: z.infer<typeof InspectSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_inspect", async () => {
        const { inspect } = await import("@/lib/crdt/engine");
        const state = inspect(args.set_id, userId, args.replica_id);

        const rows = state.replicas
          .map(r =>
            formatReplicaState(
              r.id,
              r.state,
              r.resolvedValue,
            )
          )
          .join("\n");

        return textResult(
          `**CRDT Set: ${state.name}** (${state.crdtType})\n\n`
            + `**Operations logged:** ${state.operationCount}\n\n`
            + `| Replica | Value | Internal State |\n`
            + `|---|---|---|\n`
            + `${rows}`,
        );
      }),
  });

  registry.register({
    name: "crdt_check_convergence",
    description:
      "Check whether all replicas in a CRDT set have converged to the same value. Returns convergence status and any differences.",
    category: "crdt",
    tier: "free",
    inputSchema: CheckConvergenceSchema.shape,
    handler: async (
      args: z.infer<typeof CheckConvergenceSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_check_convergence", async () => {
        const { checkConvergence } = await import("@/lib/crdt/engine");
        const result = checkConvergence(args.set_id, userId);

        if (result.converged) {
          return textResult(
            `**Convergence Check: CONVERGED**\n\nAll replicas agree on the same value.`,
          );
        }

        const diffRows = result.diffs
          .map(
            d => `| ${d.replicaA} | ${d.replicaB} | ${d.valueA} | ${d.valueB} |`,
          )
          .join("\n");

        return textResult(
          `**Convergence Check: NOT CONVERGED**\n\n`
            + `${result.diffs.length} difference(s) found:\n\n`
            + `| Replica A | Replica B | Value A | Value B |\n`
            + `|---|---|---|---|\n`
            + `${diffRows}\n\n`
            + `Use \`crdt_sync_pair\` or \`crdt_sync_all\` to merge state and achieve convergence.`,
        );
      }),
  });

  registry.register({
    name: "crdt_compare_with_consensus",
    description:
      "Compare the current CRDT set's AP behavior with how a CP (Raft/Paxos) system would handle the same scenario. Returns an explanation of tradeoffs.",
    category: "crdt",
    tier: "free",
    inputSchema: CompareWithConsensusSchema.shape,
    handler: async (
      args: z.infer<typeof CompareWithConsensusSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("crdt_compare_with_consensus", async () => {
        const { compareWithConsensus } = await import("@/lib/crdt/engine");
        const text = compareWithConsensus(
          args.set_id,
          userId,
          args.scenario_description,
        );
        return textResult(text);
      }),
  });
}
