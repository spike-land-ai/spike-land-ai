/**
 * Causality - Lamport & Vector Clock Simulator MCP Tools
 *
 * Simulates logical clocks for reasoning about happens-before relationships.
 * Ported from spike.land — pure in-memory computation, no DB needed.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LamportClock {
  type: "lamport";
  time: number;
}
interface VectorClock {
  type: "vector";
  entries: Record<string, number>;
}
type LogicalClock = LamportClock | VectorClock;
type CausalRelation = "happens_before" | "concurrent" | "same";

interface CausalEvent {
  id: string;
  processId: string;
  label: string;
  clock: LogicalClock;
  causalParents: string[];
  timestamp: number;
}

interface CausalSystem {
  id: string;
  userId: string;
  name: string;
  clockType: "lamport" | "vector";
  processes: Map<string, LogicalClock>;
  processOrder: string[];
  events: CausalEvent[];
  eventCounter: number;
  createdAt: number;
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const systems = new Map<string, CausalSystem>();

export function clearSystems(): void {
  systems.clear();
  idCounter = 0;
}

let idCounter = 0;

function generateId(): string {
  return `causal-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function cloneClock(clock: LogicalClock): LogicalClock {
  if (clock.type === "lamport") return { type: "lamport", time: clock.time };
  return { type: "vector", entries: { ...clock.entries } };
}

function getSystem(systemId: string, userId: string): CausalSystem {
  const system = systems.get(systemId);
  if (!system) throw new Error(`System ${systemId} not found`);
  if (system.userId !== userId) throw new Error("Access denied");
  return system;
}

function getProcessClock(system: CausalSystem, processId: string): LogicalClock {
  const clock = system.processes.get(processId);
  if (!clock) throw new Error(`Process ${processId} not found`);
  return clock;
}

function getLatestEventForProcess(
  system: CausalSystem,
  processId: string,
): CausalEvent | undefined {
  for (let i = system.events.length - 1; i >= 0; i--) {
    if (system.events[i]!.processId === processId) return system.events[i]!;
  }
  return undefined;
}

function formatClock(clock: LogicalClock): string {
  if (clock.type === "lamport") return `Lamport(${clock.time})`;
  const entries = Object.entries(clock.entries)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `Vector{${entries}}`;
}

function determineRelation(clockA: LogicalClock, clockB: LogicalClock): CausalRelation {
  if (clockA.type === "lamport" && clockB.type === "lamport") {
    if (clockA.time === clockB.time) return "same";
    if (clockA.time < clockB.time) return "happens_before";
    return "concurrent";
  }
  if (clockA.type === "vector" && clockB.type === "vector") {
    const allKeys = new Set([...Object.keys(clockA.entries), ...Object.keys(clockB.entries)]);
    let aLeqB = true,
      aStrictlyLessB = false,
      bStrictlyLessA = false;
    for (const key of allKeys) {
      const aVal = clockA.entries[key] ?? 0,
        bVal = clockB.entries[key] ?? 0;
      if (aVal > bVal) {
        aLeqB = false;
        bStrictlyLessA = true;
      }
      if (bVal > aVal) {
        aStrictlyLessB = true;
      }
    }
    if (!aStrictlyLessB && !bStrictlyLessA) return "same";
    if (aLeqB && aStrictlyLessB) return "happens_before";
    return "concurrent";
  }
  throw new Error("Cannot compare clocks of different types");
}

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
        return `Lamport clock: ${eventIdA} has time ${clockA.time} < ${clockB.time} of ${eventIdB}. ${eventIdA} happens before ${eventIdB}.`;
      case "same":
        return `Lamport clock: ${eventIdA} and ${eventIdB} both have time ${clockA.time}. Equal timestamps indicate potential concurrency.`;
      case "concurrent":
        return `Lamport clock: ${eventIdA} has time ${clockA.time}, ${eventIdB} has time ${clockB.time}. These events are concurrent.`;
    }
  }
  if (clockA.type === "vector" && clockB.type === "vector") {
    const aE = JSON.stringify(clockA.entries),
      bE = JSON.stringify(clockB.entries);
    switch (relation) {
      case "happens_before":
        return `Vector clock: ${eventIdA} ${aE} <= ${eventIdB} ${bE} with at least one strict inequality.`;
      case "same":
        return `Vector clock: ${eventIdA} ${aE} and ${eventIdB} ${bE} are identical.`;
      case "concurrent":
        return `Vector clock: ${eventIdA} ${aE} and ${eventIdB} ${bE} are incomparable (concurrent).`;
    }
  }
  return "Cannot compare clocks of different types.";
}

function topologicalSort(events: CausalEvent[]): CausalEvent[] {
  const eventMap = new Map<string, CausalEvent>();
  for (const evt of events) eventMap.set(evt.id, evt);
  const visited = new Set<string>();
  const result: CausalEvent[] = [];
  function visit(eventId: string): void {
    if (visited.has(eventId)) return;
    visited.add(eventId);
    const evt = eventMap.get(eventId);
    if (!evt) return;
    for (const parentId of evt.causalParents) visit(parentId);
    result.push(evt);
  }
  for (const evt of events) visit(evt.id);
  return result;
}

// ─── Registration ────────────────────────────────────────────────────────────

const ClockTypeEnum = z.enum(["lamport", "vector"]).describe("Clock type: lamport or vector.");

export function registerCausalityTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "causality_create_system",
        "Create a causal system with N processes using Lamport or Vector clocks.",
        {
          name: z.string().min(1).describe("Name for the causal system."),
          process_count: z.number().int().min(2).max(7).describe("Number of processes (2-7)."),
          clock_type: ClockTypeEnum,
        },
      )
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const id = generateId();
        const processes = new Map<string, LogicalClock>();
        const processOrder: string[] = [];
        const processIds: string[] = [];
        for (let i = 1; i <= input.process_count; i++) processIds.push(`process-${i}`);
        for (const pid of processIds) {
          const clock: LogicalClock =
            input.clock_type === "lamport"
              ? { type: "lamport", time: 0 }
              : { type: "vector", entries: Object.fromEntries(processIds.map((p) => [p, 0])) };
          processes.set(pid, clock);
          processOrder.push(pid);
        }
        const system: CausalSystem = {
          id,
          userId,
          name: input.name,
          clockType: input.clock_type,
          processes,
          processOrder,
          events: [],
          eventCounter: 0,
          createdAt: Date.now(),
        };
        systems.set(id, system);
        return textResult(
          `**Causal System Created**\n\n**ID:** ${system.id}\n**Name:** ${system.name}\n**Clock Type:** ${system.clockType}\n**Processes:** ${system.processOrder.join(", ")}\n\nUse \`causality_local_event\` or \`causality_send_event\` to create events.`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "causality_local_event",
        "Record a local event on a process. Increments the process's logical clock.",
        {
          system_id: z.string().min(1).describe("ID of the causal system."),
          process_id: z.string().min(1).describe("Process ID."),
          label: z.string().min(1).describe("Label for this event."),
        },
      )
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const system = getSystem(input.system_id, userId);
        const clock = getProcessClock(system, input.process_id);
        if (clock.type === "lamport") clock.time += 1;
        else clock.entries[input.process_id] = (clock.entries[input.process_id] ?? 0) + 1;
        const causalParents: string[] = [];
        const latest = getLatestEventForProcess(system, input.process_id);
        if (latest) causalParents.push(latest.id);
        system.eventCounter++;
        const evt: CausalEvent = {
          id: `evt-${system.eventCounter}`,
          processId: input.process_id,
          label: input.label,
          clock: cloneClock(clock),
          causalParents,
          timestamp: system.eventCounter,
        };
        system.events.push(evt);
        return textResult(
          `**Local Event Recorded**\n\n**Event ID:** ${evt.id}\n**Process:** ${evt.processId}\n**Label:** ${evt.label}\n**Clock:** ${formatClock(evt.clock)}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("causality_send_event", "Simulate a message send from one process to another.", {
        system_id: z.string().min(1).describe("ID of the causal system."),
        from_process: z.string().min(1).describe("Sender process ID."),
        to_process: z.string().min(1).describe("Receiver process ID."),
        label: z.string().min(1).describe("Label for this send event."),
      })
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const system = getSystem(input.system_id, userId);
        if (input.from_process === input.to_process) throw new Error("Cannot send to same process");
        const senderClock = getProcessClock(system, input.from_process);
        getProcessClock(system, input.to_process); // validate exists
        if (senderClock.type === "lamport") senderClock.time += 1;
        else
          senderClock.entries[input.from_process] =
            (senderClock.entries[input.from_process] ?? 0) + 1;
        const sendParents: string[] = [];
        const latestSender = getLatestEventForProcess(system, input.from_process);
        if (latestSender) sendParents.push(latestSender.id);
        system.eventCounter++;
        const sendEvt: CausalEvent = {
          id: `evt-${system.eventCounter}`,
          processId: input.from_process,
          label: `send(${input.label})`,
          clock: cloneClock(senderClock),
          causalParents: sendParents,
          timestamp: system.eventCounter,
        };
        system.events.push(sendEvt);
        const receiverClock = getProcessClock(system, input.to_process);
        if (receiverClock.type === "lamport" && senderClock.type === "lamport") {
          receiverClock.time = Math.max(receiverClock.time, senderClock.time) + 1;
        } else if (receiverClock.type === "vector" && senderClock.type === "vector") {
          const allKeys = new Set([
            ...Object.keys(receiverClock.entries),
            ...Object.keys(senderClock.entries),
          ]);
          for (const key of allKeys)
            receiverClock.entries[key] = Math.max(
              receiverClock.entries[key] ?? 0,
              senderClock.entries[key] ?? 0,
            );
          receiverClock.entries[input.to_process] =
            (receiverClock.entries[input.to_process] ?? 0) + 1;
        }
        const receiveParents: string[] = [sendEvt.id];
        const latestReceiver = getLatestEventForProcess(system, input.to_process);
        if (latestReceiver) receiveParents.push(latestReceiver.id);
        system.eventCounter++;
        const receiveEvt: CausalEvent = {
          id: `evt-${system.eventCounter}`,
          processId: input.to_process,
          label: `receive(${input.label})`,
          clock: cloneClock(receiverClock),
          causalParents: receiveParents,
          timestamp: system.eventCounter,
        };
        system.events.push(receiveEvt);
        return textResult(
          `**Message Send Simulated**\n\n| Event | Process | Label | Clock |\n|---|---|---|---|\n| ${sendEvt.id} | ${sendEvt.processId} | ${sendEvt.label} | ${formatClock(sendEvt.clock)} |\n| ${receiveEvt.id} | ${receiveEvt.processId} | ${receiveEvt.label} | ${formatClock(receiveEvt.clock)} |`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("causality_compare_events", "Compare two events for causal ordering.", {
        system_id: z.string().min(1).describe("ID of the causal system."),
        event_a: z.string().min(1).describe("First event ID."),
        event_b: z.string().min(1).describe("Second event ID."),
      })
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const system = getSystem(input.system_id, userId);
        const eventA = system.events.find((e) => e.id === input.event_a);
        const eventB = system.events.find((e) => e.id === input.event_b);
        if (!eventA) throw new Error(`Event ${input.event_a} not found`);
        if (!eventB) throw new Error(`Event ${input.event_b} not found`);
        if (input.event_a === input.event_b) {
          return textResult(
            `**Causal Comparison**\n\n**${input.event_a}** == **${input.event_b}**\n**Relation:** same\n\nSame event.`,
          );
        }
        const relation = determineRelation(eventA.clock, eventB.clock);
        const symbol =
          relation === "happens_before" ? "->" : relation === "concurrent" ? "||" : "==";
        const explanation = buildExplanation(
          eventA.clock,
          eventB.clock,
          relation,
          input.event_a,
          input.event_b,
        );
        return textResult(
          `**Causal Comparison**\n\n**${input.event_a}** ${symbol} **${input.event_b}**\n**Relation:** ${relation}\n\n${explanation}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("causality_inspect", "Inspect the current state of all or a specific process.", {
        system_id: z.string().min(1).describe("ID of the causal system."),
        process_id: z.string().optional().describe("Optional process ID."),
      })
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const system = getSystem(input.system_id, userId);
        const processIds = input.process_id ? [input.process_id] : system.processOrder;
        const processRows = processIds
          .map((pid) => {
            const clock = getProcessClock(system, pid);
            return `| ${pid} | ${formatClock(cloneClock(clock))} |`;
          })
          .join("\n");
        const events = input.process_id
          ? system.events.filter((e) => e.processId === input.process_id)
          : [...system.events];
        const eventRows =
          events.length > 0
            ? `\n\n**Events:**\n\n| ID | Process | Label | Clock |\n|---|---|---|---|\n` +
              events
                .map((e) => `| ${e.id} | ${e.processId} | ${e.label} | ${formatClock(e.clock)} |`)
                .join("\n")
            : "";
        return textResult(
          `**Causal System: ${system.name}** (${system.clockType})\n\n| Process | Clock |\n|---|---|\n${processRows}${eventRows}`,
        );
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("causality_timeline", "Get all events in causal (topological) order.", {
        system_id: z.string().min(1).describe("ID of the causal system."),
      })
      .meta({ category: "causality", tier: "free" })
      .handler(async ({ input }) => {
        const system = getSystem(input.system_id, userId);
        const events = topologicalSort([...system.events]);
        if (events.length === 0) return textResult("**Timeline**\n\nNo events recorded yet.");
        const rows = events
          .map(
            (e, i) =>
              `| ${i + 1} | ${e.id} | ${e.processId} | ${e.label} | ${formatClock(e.clock)} |`,
          )
          .join("\n");
        return textResult(
          `**Timeline** (${events.length} events)\n\n| # | ID | Process | Label | Clock |\n|---|---|---|---|---|\n${rows}`,
        );
      }),
  );
}
