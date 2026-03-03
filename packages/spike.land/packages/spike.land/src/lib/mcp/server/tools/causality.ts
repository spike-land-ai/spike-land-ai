import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import type { LogicalClock } from "@/lib/causality/types";

// Re-export for test cleanup
export { clearSystems } from "@/lib/causality/engine";

// --- Zod schemas ---

const ClockTypeEnum = z
  .enum(["lamport", "vector"])
  .describe("Clock type: lamport (scalar) or vector (per-process counters).");

const CreateSystemSchema = z.object({
  name: z.string().min(1).describe("Name for the causal system."),
  process_count: z
    .number()
    .int()
    .min(2)
    .max(7)
    .describe("Number of processes (2-7)."),
  clock_type: ClockTypeEnum,
});

const LocalEventSchema = z.object({
  system_id: z.string().min(1).describe("ID of the causal system."),
  process_id: z.string().min(1).describe("Process ID to record the event on."),
  label: z
    .string()
    .min(1)
    .describe("Label for this event (e.g., 'compute', 'write_disk')."),
});

const SendEventSchema = z.object({
  system_id: z.string().min(1).describe("ID of the causal system."),
  from_process: z.string().min(1).describe("Sender process ID."),
  to_process: z.string().min(1).describe("Receiver process ID."),
  label: z
    .string()
    .min(1)
    .describe("Label for this send event (e.g., 'send_request')."),
});

const CompareEventsSchema = z.object({
  system_id: z.string().min(1).describe("ID of the causal system."),
  event_a: z.string().min(1).describe("First event ID."),
  event_b: z.string().min(1).describe("Second event ID."),
});

const InspectSchema = z.object({
  system_id: z.string().min(1).describe("ID of the causal system."),
  process_id: z
    .string()
    .optional()
    .describe("Optional process ID to inspect. Omit for all processes."),
});

const TimelineSchema = z.object({
  system_id: z.string().min(1).describe("ID of the causal system."),
});

// --- Helpers ---

function formatClock(clock: LogicalClock): string {
  if (clock.type === "lamport") {
    return `Lamport(${clock.time})`;
  }
  const entries = Object.entries(clock.entries)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `Vector{${entries}}`;
}

// --- Registration ---

export function registerCausalityTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "causality_create_system",
    description:
      "Create a causal system with N processes using Lamport or Vector clocks. Returns system ID and process list with initial clock values.",
    category: "causality",
    tier: "free",
    inputSchema: CreateSystemSchema.shape,
    handler: async (
      args: z.infer<typeof CreateSystemSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_create_system", async () => {
        const { createSystem } = await import("@/lib/causality/engine");
        const sys = createSystem({
          userId,
          name: args.name,
          processCount: args.process_count,
          clockType: args.clock_type,
        });

        return textResult(
          `**Causal System Created**\n\n`
            + `**ID:** ${sys.id}\n`
            + `**Name:** ${sys.name}\n`
            + `**Clock Type:** ${sys.clockType}\n`
            + `**Processes:** ${sys.processOrder.join(", ")}\n\n`
            + `Use \`causality_local_event\` to record local events, or \`causality_send_event\` to simulate message passing between processes.`,
        );
      }),
  });

  registry.register({
    name: "causality_local_event",
    description:
      "Record a local event on a process. Increments the process's logical clock. Returns the event with its clock value.",
    category: "causality",
    tier: "free",
    inputSchema: LocalEventSchema.shape,
    handler: async (
      args: z.infer<typeof LocalEventSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_local_event", async () => {
        const { localEvent } = await import("@/lib/causality/engine");
        const evt = localEvent(
          args.system_id,
          userId,
          args.process_id,
          args.label,
        );

        return textResult(
          `**Local Event Recorded**\n\n`
            + `**Event ID:** ${evt.id}\n`
            + `**Process:** ${evt.processId}\n`
            + `**Label:** ${evt.label}\n`
            + `**Clock:** ${formatClock(evt.clock)}`,
        );
      }),
  });

  registry.register({
    name: "causality_send_event",
    description:
      "Simulate a message send from one process to another. Creates a 'send' event on the sender and a 'receive' event on the receiver. Clocks are merged according to Lamport/Vector rules.",
    category: "causality",
    tier: "free",
    inputSchema: SendEventSchema.shape,
    handler: async (
      args: z.infer<typeof SendEventSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_send_event", async () => {
        const { sendEvent } = await import("@/lib/causality/engine");
        const result = sendEvent(
          args.system_id,
          userId,
          args.from_process,
          args.to_process,
          args.label,
        );

        return textResult(
          `**Message Send Simulated**\n\n`
            + `| Event | Process | Label | Clock |\n`
            + `|---|---|---|---|\n`
            + `| ${result.sendEvent.id} | ${result.sendEvent.processId} | ${result.sendEvent.label} | ${
              formatClock(result.sendEvent.clock)
            } |\n`
            + `| ${result.receiveEvent.id} | ${result.receiveEvent.processId} | ${result.receiveEvent.label} | ${
              formatClock(result.receiveEvent.clock)
            } |`,
        );
      }),
  });

  registry.register({
    name: "causality_compare_events",
    description:
      "Compare two events for causal ordering. Returns whether A happens-before B, B happens-before A, or they are concurrent.",
    category: "causality",
    tier: "free",
    inputSchema: CompareEventsSchema.shape,
    handler: async (
      args: z.infer<typeof CompareEventsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_compare_events", async () => {
        const { compareEvents } = await import("@/lib/causality/engine");
        const result = compareEvents(
          args.system_id,
          userId,
          args.event_a,
          args.event_b,
        );

        const symbol = result.relation === "happens_before"
          ? "->"
          : result.relation === "concurrent"
          ? "||"
          : "==";

        return textResult(
          `**Causal Comparison**\n\n`
            + `**${result.eventA}** ${symbol} **${result.eventB}**\n`
            + `**Relation:** ${result.relation}\n\n`
            + `${result.explanation}`,
        );
      }),
  });

  registry.register({
    name: "causality_inspect",
    description:
      "Inspect the current state of all or a specific process in the causal system. Shows clock values and event history.",
    category: "causality",
    tier: "free",
    inputSchema: InspectSchema.shape,
    handler: async (
      args: z.infer<typeof InspectSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_inspect", async () => {
        const { inspect } = await import("@/lib/causality/engine");
        const state = inspect(args.system_id, userId, args.process_id);

        const processRows = state.processes
          .map(p => `| ${p.id} | ${formatClock(p.clock)} |`)
          .join("\n");

        const eventRows = state.events.length > 0
          ? `\n\n**Events:**\n\n| ID | Process | Label | Clock |\n|---|---|---|---|\n`
            + state.events
              .map(
                e => `| ${e.id} | ${e.processId} | ${e.label} | ${formatClock(e.clock)} |`,
              )
              .join("\n")
          : "";

        return textResult(
          `**Causal System: ${state.name}** (${state.clockType})\n\n`
            + `| Process | Clock |\n|---|---|\n`
            + `${processRows}${eventRows}`,
        );
      }),
  });

  registry.register({
    name: "causality_timeline",
    description:
      "Get all events in causal (topological) order. Useful for understanding the global ordering of events across processes.",
    category: "causality",
    tier: "free",
    inputSchema: TimelineSchema.shape,
    handler: async (
      args: z.infer<typeof TimelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("causality_timeline", async () => {
        const { getTimeline } = await import("@/lib/causality/engine");
        const events = getTimeline(args.system_id, userId);

        if (events.length === 0) {
          return textResult(
            "**Timeline**\n\nNo events recorded yet. Use `causality_local_event` or `causality_send_event` to create events.",
          );
        }

        const rows = events
          .map(
            (e, i) =>
              `| ${i + 1} | ${e.id} | ${e.processId} | ${e.label} | ${formatClock(e.clock)} |`,
          )
          .join("\n");

        return textResult(
          `**Timeline** (${events.length} events)\n\n`
            + `| # | ID | Process | Label | Clock |\n`
            + `|---|---|---|---|---|\n`
            + `${rows}`,
        );
      }),
  });
}
