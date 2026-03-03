/**
 * State Machine MCP Tools
 *
 * 14 tools for creating, simulating, visualizing, and exporting statecharts.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import {
  addState,
  addTransition,
  createMachine,
  exportMachine,
  getHistory,
  getSharedMachine,
  getState,
  listMachines,
  removeState,
  removeTransition,
  resetMachine,
  sendEvent,
  setContext,
  shareMachine,
  validateMachine,
} from "@/lib/state-machine/engine";
import { generateVisualizerCode } from "@/lib/state-machine/visualizer-template";

export { clearMachines } from "@/lib/state-machine/engine";

export function registerStateMachineTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // sm_create
  registry.register({
    name: "sm_create",
    description:
      "Create a new state machine with a name, optional initial state, and optional context.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      name: z.string().min(1).describe("Name for the state machine"),
      initial_state: z
        .string()
        .optional()
        .describe("Initial top-level state ID"),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Initial extended state context as key-value pairs"),
    },
    handler: async ({
      name,
      initial_state,
      context,
    }: {
      name: string;
      initial_state?: string;
      context?: Record<string, unknown>;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_create", async () => {
        const instance = createMachine({
          name,
          initial: initial_state ?? "",
          context: context ?? {},
          userId,
          states: {},
          transitions: [],
        });

        const def = instance.definition;
        let text = `**Machine Created**\n\n`;
        text += `- **ID:** \`${def.id}\`\n`;
        text += `- **Name:** ${def.name}\n`;
        text += `- **Initial State:** ${def.initial || "(none)"}\n`;

        return textResult(text);
      });
    },
  });

  // sm_add_state
  registry.register({
    name: "sm_add_state",
    description:
      "Add a state to a machine. Supports atomic, compound, parallel, final, and history state types.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      state_id: z.string().min(1).describe("Unique state identifier"),
      type: z
        .enum(["atomic", "compound", "parallel", "final", "history"])
        .describe("State type"),
      parent: z
        .string()
        .optional()
        .describe("Parent state ID for nesting"),
      initial: z
        .string()
        .optional()
        .describe("Initial child state ID (required for compound states)"),
      entry_actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe(
              "Action type",
            ),
            params: z.record(z.string(), z.unknown()).describe(
              "Action parameters",
            ),
          }),
        )
        .optional()
        .describe("Actions executed on entering this state"),
      exit_actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe(
              "Action type",
            ),
            params: z.record(z.string(), z.unknown()).describe(
              "Action parameters",
            ),
          }),
        )
        .optional()
        .describe("Actions executed on exiting this state"),
      history_type: z
        .enum(["shallow", "deep"])
        .optional()
        .describe("History type (only for history states)"),
    },
    handler: async ({
      machine_id,
      state_id,
      type,
      parent,
      initial,
      entry_actions,
      exit_actions,
      history_type,
    }: {
      machine_id: string;
      state_id: string;
      type: "atomic" | "compound" | "parallel" | "final" | "history";
      parent?: string;
      initial?: string;
      entry_actions?: Array<
        {
          type: "assign" | "log" | "raise" | "custom";
          params: Record<string, unknown>;
        }
      >;
      exit_actions?: Array<
        {
          type: "assign" | "log" | "raise" | "custom";
          params: Record<string, unknown>;
        }
      >;
      history_type?: "shallow" | "deep";
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_add_state", async () => {
        const stateNode = addState(machine_id, {
          id: state_id,
          type,
          parent,
          initial,
          entryActions: entry_actions ?? [],
          exitActions: exit_actions ?? [],
          historyType: history_type,
        });

        let text = `**State Added**\n\n`;
        text += `- **ID:** \`${stateNode.id}\`\n`;
        text += `- **Type:** ${stateNode.type}\n`;
        if (stateNode.parent) text += `- **Parent:** \`${stateNode.parent}\`\n`;
        if (stateNode.initial) {
          text += `- **Initial Child:** \`${stateNode.initial}\`\n`;
        }
        if (stateNode.entryActions.length > 0) {
          text += `- **Entry Actions:** ${stateNode.entryActions.length}\n`;
        }
        if (stateNode.exitActions.length > 0) {
          text += `- **Exit Actions:** ${stateNode.exitActions.length}\n`;
        }
        if (stateNode.historyType) {
          text += `- **History Type:** ${stateNode.historyType}\n`;
        }

        return textResult(text);
      });
    },
  });

  // sm_remove_state
  registry.register({
    name: "sm_remove_state",
    description: "Remove a state and all transitions referencing it from a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      state_id: z.string().min(1).describe("State ID to remove"),
    },
    handler: async ({
      machine_id,
      state_id,
    }: {
      machine_id: string;
      state_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_remove_state", async () => {
        removeState(machine_id, state_id);
        return textResult(
          `**State Removed:** \`${state_id}\` from machine \`${machine_id}\``,
        );
      });
    },
  });

  // sm_add_transition
  registry.register({
    name: "sm_add_transition",
    description: "Add a transition between states with optional guard expression and actions.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      source: z.string().min(1).describe("Source state ID"),
      target: z.string().min(1).describe("Target state ID"),
      event: z.string().min(1).describe(
        "Event name that triggers this transition",
      ),
      guard_expression: z
        .string()
        .optional()
        .describe("Guard expression string, e.g. 'context.count > 0'"),
      actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe(
              "Action type",
            ),
            params: z.record(z.string(), z.unknown()).describe(
              "Action parameters",
            ),
          }),
        )
        .optional()
        .describe("Actions to execute during the transition"),
      internal: z
        .boolean()
        .optional()
        .describe("Internal transition (no exit/re-entry of source state)"),
    },
    handler: async ({
      machine_id,
      source,
      target,
      event,
      guard_expression,
      actions,
      internal,
    }: {
      machine_id: string;
      source: string;
      target: string;
      event: string;
      guard_expression?: string;
      actions?: Array<
        {
          type: "assign" | "log" | "raise" | "custom";
          params: Record<string, unknown>;
        }
      >;
      internal?: boolean;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_add_transition", async () => {
        const guard = guard_expression
          ? { expression: guard_expression }
          : undefined;

        const transition = addTransition(machine_id, {
          source,
          target,
          event,
          guard,
          actions: actions ?? [],
          internal: internal ?? false,
        });

        let text = `**Transition Added**\n\n`;
        text += `- **ID:** \`${transition.id}\`\n`;
        text += `- **Event:** ${transition.event}\n`;
        text += `- **Source:** \`${transition.source}\` -> **Target:** \`${transition.target}\`\n`;
        if (transition.guard) {
          text += `- **Guard:** ${transition.guard.expression}\n`;
        }
        if (transition.actions.length > 0) {
          text += `- **Actions:** ${transition.actions.length}\n`;
        }
        if (transition.internal) text += `- **Internal:** true\n`;

        return textResult(text);
      });
    },
  });

  // sm_remove_transition
  registry.register({
    name: "sm_remove_transition",
    description: "Remove a transition by its ID from a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      transition_id: z.string().min(1).describe("Transition ID to remove"),
    },
    handler: async ({
      machine_id,
      transition_id,
    }: {
      machine_id: string;
      transition_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_remove_transition", async () => {
        removeTransition(machine_id, transition_id);
        return textResult(
          `**Transition Removed:** \`${transition_id}\` from machine \`${machine_id}\``,
        );
      });
    },
  });

  // sm_set_context
  registry.register({
    name: "sm_set_context",
    description: "Merge key-value pairs into the machine's extended state context.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      context: z
        .record(z.string(), z.unknown())
        .describe("Key-value pairs to merge into the context"),
    },
    handler: async ({
      machine_id,
      context,
    }: {
      machine_id: string;
      context: Record<string, unknown>;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_set_context", async () => {
        setContext(machine_id, context);
        const state = getState(machine_id);
        return textResult(
          `**Context Updated**\n\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``,
        );
      });
    },
  });

  // sm_send_event
  registry.register({
    name: "sm_send_event",
    description:
      "Send an event to a machine, triggering a matching transition. Returns transition details including from/to states, actions executed, and guard evaluated.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      event: z.string().min(1).describe("Event name to send"),
      payload: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Optional event payload merged into context as _event"),
    },
    handler: async ({
      machine_id,
      event,
      payload,
    }: {
      machine_id: string;
      event: string;
      payload?: Record<string, unknown>;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_send_event", async () => {
        const logEntry = sendEvent(machine_id, event, payload);

        let text = `**Event Processed: ${event}**\n\n`;
        text += `- **From:** ${logEntry.fromStates.join(", ")}\n`;
        text += `- **To:** ${logEntry.toStates.join(", ")}\n`;
        if (logEntry.guardEvaluated) {
          text += `- **Guard Evaluated:** ${logEntry.guardEvaluated}\n`;
        }
        if (logEntry.actionsExecuted.length > 0) {
          text += `- **Actions Executed:** ${
            logEntry.actionsExecuted.map(a => a.type).join(", ")
          }\n`;
        }

        return textResult(text);
      });
    },
  });

  // sm_get_state
  registry.register({
    name: "sm_get_state",
    description: "Get the current active states and context of a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async ({
      machine_id,
    }: {
      machine_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_get_state", async () => {
        const state = getState(machine_id);

        let text = `**Current State**\n\n`;
        text += `- **Active States:** ${
          state.activeStates.length > 0
            ? state.activeStates.join(", ")
            : "(none)"
        }\n`;
        text += `- **Context:**\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``;

        return textResult(text);
      });
    },
  });

  // sm_get_history
  registry.register({
    name: "sm_get_history",
    description: "Get the transition history log of a machine, most recent first.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Maximum number of log entries to return (default: 20)"),
    },
    handler: async ({
      machine_id,
      limit,
    }: {
      machine_id: string;
      limit?: number;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_get_history", async () => {
        const history = getHistory(machine_id);
        const maxEntries = limit ?? 20;
        const entries = history.slice(-maxEntries).reverse();

        if (entries.length === 0) {
          return textResult(
            "**Transition History**\n\nNo transitions recorded yet.",
          );
        }

        let text = `**Transition History** (${entries.length} of ${history.length} entries)\n\n`;
        for (const entry of entries) {
          text += `- **${entry.event}**: ${entry.fromStates.join(", ")} -> ${
            entry.toStates.join(", ")
          }`;
          if (entry.guardEvaluated) text += ` [guard: ${entry.guardEvaluated}]`;
          if (entry.actionsExecuted.length > 0) {
            text += ` (actions: ${entry.actionsExecuted.map(a => a.type).join(", ")})`;
          }
          text += `\n`;
        }

        return textResult(text);
      });
    },
  });

  // sm_reset
  registry.register({
    name: "sm_reset",
    description: "Reset a machine to its initial state, context, and clear all history.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async ({
      machine_id,
    }: {
      machine_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_reset", async () => {
        resetMachine(machine_id);
        const state = getState(machine_id);

        let text = `**Machine Reset**\n\n`;
        text += `- **Active States:** ${
          state.activeStates.length > 0
            ? state.activeStates.join(", ")
            : "(none)"
        }\n`;
        text += `- **Context:**\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``;

        return textResult(text);
      });
    },
  });

  // sm_validate
  registry.register({
    name: "sm_validate",
    description: "Validate a machine definition and return a list of warnings and errors.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async ({
      machine_id,
    }: {
      machine_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_validate", async () => {
        const issues = validateMachine(machine_id);

        if (issues.length === 0) {
          return textResult("**Validation Result:** No issues found.");
        }

        let text = `**Validation Result:** ${issues.length} issue(s) found\n\n`;
        for (const issue of issues) {
          const prefix = issue.level === "error" ? "ERROR" : "WARNING";
          let line = `- **[${prefix}]** ${issue.message}`;
          if (issue.stateId) line += ` (state: \`${issue.stateId}\`)`;
          if (issue.transitionId) {
            line += ` (transition: \`${issue.transitionId}\`)`;
          }
          text += `${line}\n`;
        }

        return textResult(text);
      });
    },
  });

  // sm_visualize
  registry.register({
    name: "sm_visualize",
    description:
      "Visualize a state machine as an interactive React+D3 diagram deployed to a codespace. "
      + "Requires the testing.spike.land codespace service. "
      + "Falls back to a Mermaid stateDiagram if the service is unavailable.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      codespace_id: z
        .string()
        .min(1)
        .describe("Codespace ID to deploy the visualization to"),
      interactive: z
        .boolean()
        .optional()
        .describe(
          "Enable interactive event buttons in the visualization (default: false)",
        ),
      autoplay: z
        .boolean()
        .optional()
        .describe(
          "Enable autoplay that automatically steps through available transitions (default: false). Requires interactive: true.",
        ),
      autoplay_speed_ms: z
        .number()
        .int()
        .min(100)
        .max(10000)
        .optional()
        .describe(
          "Milliseconds between autoplay steps (default: 1000). Only used when autoplay is true.",
        ),
    },
    handler: async ({
      machine_id,
      codespace_id,
      interactive,
      autoplay,
      autoplay_speed_ms,
    }: {
      machine_id: string;
      codespace_id: string;
      interactive?: boolean;
      autoplay?: boolean;
      autoplay_speed_ms?: number;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_visualize", async () => {
        const machineExport = exportMachine(machine_id);
        const isInteractive = interactive ?? false;
        const isAutoplay = autoplay ?? false;
        const speedMs = autoplay_speed_ms ?? 1000;
        const code = generateVisualizerCode(
          machineExport,
          isInteractive,
          isAutoplay,
          speedMs,
        );

        let response: Response | undefined;
        let deployFailed = false;
        try {
          response = await fetch(
            `https://testing.spike.land/live/${codespace_id}/api/code`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            },
          );
          if (!response.ok) {
            deployFailed = true;
          }
        } catch {
          deployFailed = true;
        }

        if (deployFailed) {
          // Fallback: return Mermaid stateDiagram text
          const mermaid = generateMermaidDiagram(machineExport);
          let text = `**Visualization Fallback (Mermaid)**\n\n`;
          text += `The codespace service at \`testing.spike.land\` is unavailable. `;
          text +=
            `Here is a Mermaid stateDiagram you can render in any Mermaid-compatible viewer:\n\n`;
          text += `\`\`\`mermaid\n${mermaid}\n\`\`\``;
          return textResult(text);
        }

        const vizUrl = `https://testing.spike.land/live/${codespace_id}`;
        let text = `**Visualization Deployed**\n\n`;
        text += `- **URL:** ${vizUrl}\n`;
        text += `- **Interactive:** ${isInteractive}\n`;
        text += `- **Autoplay:** ${isAutoplay}${isAutoplay ? ` (${speedMs}ms)` : ""}\n`;
        text += `- **States:** ${Object.keys(machineExport.definition.states).length}\n`;
        text += `- **Transitions:** ${machineExport.definition.transitions.length}\n`;

        return textResult(text);
      });
    },
  });

  // sm_export
  registry.register({
    name: "sm_export",
    description:
      "Export a machine's full definition, current state, context, history, and transition log as JSON.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async ({
      machine_id,
    }: {
      machine_id: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_export", async () => {
        const machineExport = exportMachine(machine_id);
        return textResult(
          `**Machine Export**\n\n\`\`\`json\n${JSON.stringify(machineExport, null, 2)}\n\`\`\``,
        );
      });
    },
  });

  // sm_list
  registry.register({
    name: "sm_list",
    description: "List all state machines owned by the current user.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (): Promise<CallToolResult> => {
      return safeToolCall("sm_list", async () => {
        const machines = listMachines(userId);

        if (machines.length === 0) {
          return textResult(
            "**No machines found.** Use `sm_create` to create one.",
          );
        }

        let text = `**Your Machines** (${machines.length})\n\n`;
        for (const m of machines) {
          text +=
            `- \`${m.id}\` **${m.name}** -- ${m.stateCount} states, ${m.transitionCount} transitions`;
          if (m.currentStates.length > 0) {
            text += ` (active: ${m.currentStates.join(", ")})`;
          }
          text += `\n`;
        }

        return textResult(text);
      });
    },
  });

  // sm_share
  registry.register({
    name: "sm_share",
    description:
      "Share a state machine by generating a unique share token and link. Accepts optional machine_data for client-side machines not in server memory.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID to share"),
      machine_data: z.record(z.string(), z.unknown()).optional().describe(
        "Full machine export data (definition, currentStates, context, history, transitionLog) for client-side machines",
      ),
    },
    handler: async (
      { machine_id, machine_data }: {
        machine_id: string;
        machine_data?: Record<string, unknown>;
      },
    ): Promise<CallToolResult> => {
      return safeToolCall("sm_share", async () => {
        const token = await shareMachine(
          machine_id,
          userId,
          machine_data as
            | import("@/lib/state-machine/types").MachineExport
            | undefined,
        );
        const url = `https://spike.land/share/sm/${token}`;

        let text = `**Machine Shared Successfully**\n\n`;
        text += `- **Token:** \`${token}\`\n`;
        text += `- **Link:** [${url}](${url})\n\n`;
        text += `Anyone with this link can view and fork your state machine.`;

        return textResult(text);
      });
    },
  });

  // sm_get_shared
  registry.register({
    name: "sm_get_shared",
    description: "Get a shared state machine's data using its share token.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      token: z.string().min(1).describe("Share token"),
    },
    handler: async ({ token }: { token: string; }): Promise<CallToolResult> => {
      return safeToolCall("sm_get_shared", async () => {
        const exported = await getSharedMachine(token);
        return textResult(JSON.stringify(exported));
      });
    },
  });
}

/**
 * Generate a Mermaid stateDiagram-v2 string from a MachineExport.
 * Used as a fallback when the codespace visualization service is unavailable.
 */
export function generateMermaidDiagram(
  machineExport: import("@/lib/state-machine/types").MachineExport,
): string {
  const { definition } = machineExport;
  const lines: string[] = ["stateDiagram-v2"];

  if (definition.initial) {
    lines.push(`    [*] --> ${definition.initial}`);
  }

  for (const [id, state] of Object.entries(definition.states)) {
    if (state.type === "final") {
      lines.push(`    ${id} --> [*]`);
    }
  }

  for (const t of definition.transitions) {
    const label = t.guard
      ? `${t.event} [${t.guard.expression}]`
      : t.event;
    lines.push(`    ${t.source} --> ${t.target} : ${label}`);
  }

  // Mark active states with a note
  if (machineExport.currentStates.length > 0) {
    for (const active of machineExport.currentStates) {
      lines.push(`    note right of ${active} : ACTIVE`);
    }
  }

  return lines.join("\n");
}
