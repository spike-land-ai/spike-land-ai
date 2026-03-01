import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import type { LogicalClock } from "@/lib/causality/types";
import { freeTool } from "../tool-builder/procedures";

// Re-export for test cleanup
export { clearSystems } from "@/lib/causality/engine";

// --- Zod schemas ---

const ClockTypeEnum = z
    .enum(["lamport", "vector"])
    .describe("Clock type: lamport (scalar) or vector (per-process counters).");
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
    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_create_system", "Create a causal system with N processes using Lamport or Vector clocks. Returns system ID and process list with initial clock values.", {
                name: z.string().min(1).describe("Name for the causal system."),
                process_count: z
                    .number()
                    .int()
                    .min(2)
                    .max(7)
                    .describe("Number of processes (2-7)."),
                clock_type: ClockTypeEnum,
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_local_event", "Record a local event on a process. Increments the process's logical clock. Returns the event with its clock value.", {
                system_id: z.string().min(1).describe("ID of the causal system."),
                process_id: z.string().min(1).describe("Process ID to record the event on."),
                label: z
                    .string()
                    .min(1)
                    .describe("Label for this event (e.g., 'compute', 'write_disk')."),
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_send_event", "Simulate a message send from one process to another. Creates a 'send' event on the sender and a 'receive' event on the receiver. Clocks are merged according to Lamport/Vector rules.", {
                system_id: z.string().min(1).describe("ID of the causal system."),
                from_process: z.string().min(1).describe("Sender process ID."),
                to_process: z.string().min(1).describe("Receiver process ID."),
                label: z
                    .string()
                    .min(1)
                    .describe("Label for this send event (e.g., 'send_request')."),
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
                    + `| ${result.sendEvent.id} | ${result.sendEvent.processId} | ${result.sendEvent.label} | ${formatClock(result.sendEvent.clock)
                    } |\n`
                    + `| ${result.receiveEvent.id} | ${result.receiveEvent.processId} | ${result.receiveEvent.label} | ${formatClock(result.receiveEvent.clock)
                    } |`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_compare_events", "Compare two events for causal ordering. Returns whether A happens-before B, B happens-before A, or they are concurrent.", {
                system_id: z.string().min(1).describe("ID of the causal system."),
                event_a: z.string().min(1).describe("First event ID."),
                event_b: z.string().min(1).describe("Second event ID."),
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_inspect", "Inspect the current state of all or a specific process in the causal system. Shows clock values and event history.", {
                system_id: z.string().min(1).describe("ID of the causal system."),
                process_id: z
                    .string()
                    .optional()
                    .describe("Optional process ID to inspect. Omit for all processes."),
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("causality_timeline", "Get all events in causal (topological) order. Useful for understanding the global ordering of events across processes.", {
                system_id: z.string().min(1).describe("ID of the causal system."),
            })
            .meta({ category: "causality", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

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
            })
    );
}
