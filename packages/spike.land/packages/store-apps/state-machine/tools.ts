/**
 * State Machine Standalone Tools
 *
 * Create, simulate, visualize, and export statecharts.
 * Migrated from:
 *   - src/lib/mcp/server/tools/state-machine.ts
 *   - src/lib/mcp/server/tools/state-machine-templates.ts
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

// ── Template definitions ───────────────────────────────────────────────────

interface TemplateTransitionDef {
  source: string;
  target: string;
  event: string;
  guard?: string;
}

interface TemplateStateDef {
  id: string;
  type: "atomic" | "compound" | "parallel" | "final" | "history";
  initial?: string;
  parent?: string;
}

interface StateMachineTemplate {
  id: string;
  name: string;
  description: string;
  category: "auth" | "cart" | "workflow" | "game" | "iot" | "ui";
  states: TemplateStateDef[];
  transitions: TemplateTransitionDef[];
}

const TEMPLATES: StateMachineTemplate[] = [
  {
    id: "auth-flow",
    name: "Authentication Flow",
    description: "Login, MFA verification, and session management with error handling and logout.",
    category: "auth",
    states: [
      { id: "idle", type: "atomic" },
      { id: "authenticating", type: "atomic" },
      { id: "mfa_required", type: "atomic" },
      { id: "authenticated", type: "atomic" },
      { id: "error", type: "atomic" },
      { id: "logged_out", type: "final" },
    ],
    transitions: [
      { source: "idle", target: "authenticating", event: "LOGIN" },
      { source: "authenticating", target: "mfa_required", event: "MFA_REQUIRED" },
      { source: "authenticating", target: "authenticated", event: "SUCCESS" },
      { source: "authenticating", target: "error", event: "FAILURE" },
      { source: "mfa_required", target: "authenticated", event: "MFA_SUCCESS" },
      { source: "mfa_required", target: "error", event: "MFA_FAILURE" },
      { source: "error", target: "idle", event: "RETRY" },
      { source: "authenticated", target: "logged_out", event: "LOGOUT" },
    ],
  },
  {
    id: "shopping-cart",
    name: "Shopping Cart",
    description:
      "E-commerce cart lifecycle: browsing, adding items, checkout, payment, and confirmation.",
    category: "cart",
    states: [
      { id: "empty", type: "atomic" },
      { id: "has_items", type: "atomic" },
      { id: "checkout", type: "atomic" },
      { id: "payment", type: "atomic" },
      { id: "confirmed", type: "atomic" },
      { id: "cancelled", type: "final" },
    ],
    transitions: [
      { source: "empty", target: "has_items", event: "ADD_ITEM" },
      { source: "has_items", target: "has_items", event: "ADD_ITEM" },
      { source: "has_items", target: "empty", event: "CLEAR" },
      { source: "has_items", target: "checkout", event: "CHECKOUT" },
      { source: "checkout", target: "payment", event: "SUBMIT_ORDER" },
      { source: "checkout", target: "has_items", event: "BACK" },
      { source: "payment", target: "confirmed", event: "PAYMENT_SUCCESS" },
      { source: "payment", target: "checkout", event: "PAYMENT_FAILED" },
      { source: "payment", target: "cancelled", event: "CANCEL" },
    ],
  },
  {
    id: "order-workflow",
    name: "Order Fulfillment Workflow",
    description:
      "Order processing pipeline from placement through fulfillment, shipping, and delivery.",
    category: "workflow",
    states: [
      { id: "pending", type: "atomic" },
      { id: "processing", type: "atomic" },
      { id: "picking", type: "atomic" },
      { id: "shipped", type: "atomic" },
      { id: "delivered", type: "final" },
      { id: "refunded", type: "final" },
    ],
    transitions: [
      { source: "pending", target: "processing", event: "CONFIRM" },
      { source: "pending", target: "refunded", event: "CANCEL" },
      { source: "processing", target: "picking", event: "PAYMENT_CAPTURED" },
      { source: "processing", target: "refunded", event: "PAYMENT_FAILED" },
      { source: "picking", target: "shipped", event: "DISPATCHED" },
      { source: "shipped", target: "delivered", event: "DELIVERED" },
      { source: "shipped", target: "refunded", event: "LOST" },
    ],
  },
  {
    id: "traffic-light",
    name: "Traffic Light",
    description: "Classic cyclic traffic-light state machine: red, green, yellow.",
    category: "iot",
    states: [
      { id: "red", type: "atomic" },
      { id: "green", type: "atomic" },
      { id: "yellow", type: "atomic" },
    ],
    transitions: [
      { source: "red", target: "green", event: "NEXT" },
      { source: "green", target: "yellow", event: "NEXT" },
      { source: "yellow", target: "red", event: "NEXT" },
    ],
  },
  {
    id: "elevator",
    name: "Elevator Controller",
    description: "Elevator with idle, moving up/down, and door open/closing states.",
    category: "iot",
    states: [
      { id: "idle", type: "atomic" },
      { id: "door_open", type: "atomic" },
      { id: "moving_up", type: "atomic" },
      { id: "moving_down", type: "atomic" },
      { id: "door_closing", type: "atomic" },
    ],
    transitions: [
      { source: "idle", target: "door_open", event: "CALL" },
      { source: "door_open", target: "door_closing", event: "CLOSE" },
      { source: "door_closing", target: "moving_up", event: "GO_UP" },
      { source: "door_closing", target: "moving_down", event: "GO_DOWN" },
      { source: "door_closing", target: "idle", event: "AT_FLOOR" },
      { source: "moving_up", target: "door_open", event: "ARRIVE" },
      { source: "moving_down", target: "door_open", event: "ARRIVE" },
      { source: "door_open", target: "idle", event: "TIMEOUT" },
    ],
  },
  {
    id: "retry-backoff",
    name: "Retry with Exponential Backoff",
    description: "Retry pattern: idle -> attempting -> success/failure with backoff waiting state.",
    category: "workflow",
    states: [
      { id: "idle", type: "atomic" },
      { id: "attempting", type: "atomic" },
      { id: "waiting", type: "atomic" },
      { id: "succeeded", type: "final" },
      { id: "failed", type: "final" },
    ],
    transitions: [
      { source: "idle", target: "attempting", event: "START" },
      { source: "attempting", target: "succeeded", event: "SUCCESS" },
      { source: "attempting", target: "waiting", event: "FAILURE" },
      { source: "waiting", target: "attempting", event: "RETRY" },
      { source: "waiting", target: "failed", event: "GIVE_UP", guard: "context.attempts >= 3" },
    ],
  },
  {
    id: "form-wizard",
    name: "Multi-step Form Wizard",
    description: "Step-by-step form with validation, navigation between steps, and submission.",
    category: "ui",
    states: [
      { id: "step1", type: "atomic" },
      { id: "step2", type: "atomic" },
      { id: "step3", type: "atomic" },
      { id: "reviewing", type: "atomic" },
      { id: "submitting", type: "atomic" },
      { id: "submitted", type: "final" },
      { id: "error", type: "atomic" },
    ],
    transitions: [
      { source: "step1", target: "step2", event: "NEXT" },
      { source: "step2", target: "step3", event: "NEXT" },
      { source: "step2", target: "step1", event: "BACK" },
      { source: "step3", target: "reviewing", event: "NEXT" },
      { source: "step3", target: "step2", event: "BACK" },
      { source: "reviewing", target: "submitting", event: "SUBMIT" },
      { source: "reviewing", target: "step3", event: "BACK" },
      { source: "submitting", target: "submitted", event: "SUCCESS" },
      { source: "submitting", target: "error", event: "FAILURE" },
      { source: "error", target: "reviewing", event: "RETRY" },
    ],
  },
  {
    id: "game-turn",
    name: "Turn-Based Game",
    description:
      "Two-player turn-based game loop: player1 turn, player2 turn, checking win, game over.",
    category: "game",
    states: [
      { id: "start", type: "atomic" },
      { id: "player1_turn", type: "atomic" },
      { id: "player2_turn", type: "atomic" },
      { id: "checking", type: "atomic" },
      { id: "game_over", type: "final" },
    ],
    transitions: [
      { source: "start", target: "player1_turn", event: "BEGIN" },
      { source: "player1_turn", target: "checking", event: "MOVE" },
      { source: "checking", target: "game_over", event: "WIN" },
      { source: "checking", target: "player2_turn", event: "CONTINUE" },
      { source: "player2_turn", target: "checking", event: "MOVE" },
    ],
  },
];

// ── Tool definitions ───────────────────────────────────────────────────────

export const stateMachineTools: StandaloneToolDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // Core state-machine tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "sm_create",
    description:
      "Create a new state machine with a name, optional initial state, and optional context.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    dependencies: {
      enables: [
        "sm_add_state",
        "sm_remove_state",
        "sm_add_transition",
        "sm_remove_transition",
        "sm_set_context",
        "sm_send_event",
        "sm_get_state",
        "sm_get_history",
        "sm_reset",
        "sm_validate",
        "sm_visualize",
        "sm_export",
        "sm_list",
        "sm_share",
        "sm_get_shared",
        "sm_list_templates",
        "sm_create_from_template",
        "sm_generate_code",
        "sm_simulate_sequence",
      ],
    },
    inputSchema: {
      name: z.string().min(1).describe("Name for the state machine"),
      initial_state: z.string().optional().describe("Initial top-level state ID"),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Initial extended state context as key-value pairs"),
    },
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      return safeToolCall("sm_create", async () => {
        const { name, initial_state, context } = input as {
          name: string;
          initial_state?: string;
          context?: Record<string, unknown>;
        };
        const { createMachine } = await import("@/lib/state-machine/engine");
        const instance = createMachine({
          name,
          initial: initial_state ?? "",
          context: context ?? {},
          userId: ctx.userId,
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
  },

  {
    name: "sm_add_state",
    description:
      "Add a state to a machine. Supports atomic, compound, parallel, final, and history state types.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      state_id: z.string().min(1).describe("Unique state identifier"),
      type: z.enum(["atomic", "compound", "parallel", "final", "history"]).describe("State type"),
      parent: z.string().optional().describe("Parent state ID for nesting"),
      initial: z
        .string()
        .optional()
        .describe("Initial child state ID (required for compound states)"),
      entry_actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe("Action type"),
            params: z.record(z.string(), z.unknown()).describe("Action parameters"),
          }),
        )
        .optional()
        .describe("Actions executed on entering this state"),
      exit_actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe("Action type"),
            params: z.record(z.string(), z.unknown()).describe("Action parameters"),
          }),
        )
        .optional()
        .describe("Actions executed on exiting this state"),
      history_type: z
        .enum(["shallow", "deep"])
        .optional()
        .describe("History type (only for history states)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_add_state", async () => {
        const {
          machine_id,
          state_id,
          type,
          parent,
          initial,
          entry_actions,
          exit_actions,
          history_type,
        } = input as {
          machine_id: string;
          state_id: string;
          type: "atomic" | "compound" | "parallel" | "final" | "history";
          parent?: string;
          initial?: string;
          entry_actions?: Array<{
            type: "assign" | "log" | "raise" | "custom";
            params: Record<string, unknown>;
          }>;
          exit_actions?: Array<{
            type: "assign" | "log" | "raise" | "custom";
            params: Record<string, unknown>;
          }>;
          history_type?: "shallow" | "deep";
        };
        const { addState } = await import("@/lib/state-machine/engine");
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
        if (stateNode.initial) text += `- **Initial Child:** \`${stateNode.initial}\`\n`;
        if (stateNode.entryActions.length > 0) {
          text += `- **Entry Actions:** ${stateNode.entryActions.length}\n`;
        }
        if (stateNode.exitActions.length > 0) {
          text += `- **Exit Actions:** ${stateNode.exitActions.length}\n`;
        }
        if (stateNode.historyType) text += `- **History Type:** ${stateNode.historyType}\n`;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_remove_state",
    description: "Remove a state and all transitions referencing it from a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      state_id: z.string().min(1).describe("State ID to remove"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_remove_state", async () => {
        const { machine_id, state_id } = input as { machine_id: string; state_id: string };
        const { removeState } = await import("@/lib/state-machine/engine");
        removeState(machine_id, state_id);
        return textResult(`**State Removed:** \`${state_id}\` from machine \`${machine_id}\``);
      });
    },
  },

  {
    name: "sm_add_transition",
    description: "Add a transition between states with optional guard expression and actions.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      source: z.string().min(1).describe("Source state ID"),
      target: z.string().min(1).describe("Target state ID"),
      event: z.string().min(1).describe("Event name that triggers this transition"),
      guard_expression: z
        .string()
        .optional()
        .describe("Guard expression string, e.g. 'context.count > 0'"),
      actions: z
        .array(
          z.object({
            type: z.enum(["assign", "log", "raise", "custom"]).describe("Action type"),
            params: z.record(z.string(), z.unknown()).describe("Action parameters"),
          }),
        )
        .optional()
        .describe("Actions to execute during the transition"),
      internal: z
        .boolean()
        .optional()
        .describe("Internal transition (no exit/re-entry of source state)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_add_transition", async () => {
        const { machine_id, source, target, event, guard_expression, actions, internal } =
          input as {
            machine_id: string;
            source: string;
            target: string;
            event: string;
            guard_expression?: string;
            actions?: Array<{
              type: "assign" | "log" | "raise" | "custom";
              params: Record<string, unknown>;
            }>;
            internal?: boolean;
          };
        const { addTransition } = await import("@/lib/state-machine/engine");
        const guard = guard_expression ? { expression: guard_expression } : undefined;
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
        if (transition.guard) text += `- **Guard:** ${transition.guard.expression}\n`;
        if (transition.actions.length > 0) text += `- **Actions:** ${transition.actions.length}\n`;
        if (transition.internal) text += `- **Internal:** true\n`;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_remove_transition",
    description: "Remove a transition by its ID from a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      transition_id: z.string().min(1).describe("Transition ID to remove"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_remove_transition", async () => {
        const { machine_id, transition_id } = input as {
          machine_id: string;
          transition_id: string;
        };
        const { removeTransition } = await import("@/lib/state-machine/engine");
        removeTransition(machine_id, transition_id);
        return textResult(
          `**Transition Removed:** \`${transition_id}\` from machine \`${machine_id}\``,
        );
      });
    },
  },

  {
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
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_set_context", async () => {
        const { machine_id, context } = input as {
          machine_id: string;
          context: Record<string, unknown>;
        };
        const { setContext, getState } = await import("@/lib/state-machine/engine");
        setContext(machine_id, context);
        const state = getState(machine_id);
        return textResult(
          `**Context Updated**\n\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``,
        );
      });
    },
  },

  {
    name: "sm_send_event",
    description:
      "Send an event to a machine, triggering a matching transition. Returns transition details.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      event: z.string().min(1).describe("Event name to send"),
      payload: z.record(z.string(), z.unknown()).optional().describe("Optional event payload"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_send_event", async () => {
        const { machine_id, event, payload } = input as {
          machine_id: string;
          event: string;
          payload?: Record<string, unknown>;
        };
        const { sendEvent } = await import("@/lib/state-machine/engine");
        const logEntry = sendEvent(machine_id, event, payload);

        let text = `**Event Processed: ${event}**\n\n`;
        text += `- **From:** ${logEntry.fromStates.join(", ")}\n`;
        text += `- **To:** ${logEntry.toStates.join(", ")}\n`;
        if (logEntry.guardEvaluated) text += `- **Guard Evaluated:** ${logEntry.guardEvaluated}\n`;
        if (logEntry.actionsExecuted.length > 0) {
          text += `- **Actions Executed:** ${logEntry.actionsExecuted
            .map((a) => a.type)
            .join(", ")}\n`;
        }

        return textResult(text);
      });
    },
  },

  {
    name: "sm_get_state",
    description: "Get the current active states and context of a machine.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_get_state", async () => {
        const { machine_id } = input as { machine_id: string };
        const { getState } = await import("@/lib/state-machine/engine");
        const state = getState(machine_id);

        let text = `**Current State**\n\n`;
        text += `- **Active States:** ${
          state.activeStates.length > 0 ? state.activeStates.join(", ") : "(none)"
        }\n`;
        text += `- **Context:**\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``;

        return textResult(text);
      });
    },
  },

  {
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
        .describe("Maximum number of log entries (default: 20)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_get_history", async () => {
        const { machine_id, limit } = input as { machine_id: string; limit?: number };
        const { getHistory } = await import("@/lib/state-machine/engine");
        const history = getHistory(machine_id);
        const maxEntries = limit ?? 20;
        const entries = history.slice(-maxEntries).reverse();

        if (entries.length === 0) {
          return textResult("**Transition History**\n\nNo transitions recorded yet.");
        }

        let text = `**Transition History** (${entries.length} of ${history.length} entries)\n\n`;
        for (const entry of entries) {
          text += `- **${entry.event}**: ${entry.fromStates.join(", ")} -> ${entry.toStates.join(
            ", ",
          )}`;
          if (entry.guardEvaluated) text += ` [guard: ${entry.guardEvaluated}]`;
          if (entry.actionsExecuted.length > 0) {
            text += ` (actions: ${entry.actionsExecuted.map((a) => a.type).join(", ")})`;
          }
          text += `\n`;
        }

        return textResult(text);
      });
    },
  },

  {
    name: "sm_reset",
    description: "Reset a machine to its initial state, context, and clear all history.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_reset", async () => {
        const { machine_id } = input as { machine_id: string };
        const { resetMachine, getState } = await import("@/lib/state-machine/engine");
        resetMachine(machine_id);
        const state = getState(machine_id);

        let text = `**Machine Reset**\n\n`;
        text += `- **Active States:** ${
          state.activeStates.length > 0 ? state.activeStates.join(", ") : "(none)"
        }\n`;
        text += `- **Context:**\n\`\`\`json\n${JSON.stringify(state.context, null, 2)}\n\`\`\``;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_validate",
    description: "Validate a machine definition and return a list of warnings and errors.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_validate", async () => {
        const { machine_id } = input as { machine_id: string };
        const { validateMachine } = await import("@/lib/state-machine/engine");
        const issues = validateMachine(machine_id);

        if (issues.length === 0) {
          return textResult("**Validation Result:** No issues found.");
        }

        let text = `**Validation Result:** ${issues.length} issue(s) found\n\n`;
        for (const issue of issues) {
          const prefix = issue.level === "error" ? "ERROR" : "WARNING";
          let line = `- **[${prefix}]** ${issue.message}`;
          if (issue.stateId) line += ` (state: \`${issue.stateId}\`)`;
          if (issue.transitionId) line += ` (transition: \`${issue.transitionId}\`)`;
          text += `${line}\n`;
        }

        return textResult(text);
      });
    },
  },

  {
    name: "sm_visualize",
    description:
      "Visualize a state machine as an interactive React+D3 diagram deployed to a codespace.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
      codespace_id: z.string().min(1).describe("Codespace ID to deploy the visualization to"),
      interactive: z
        .boolean()
        .optional()
        .describe("Enable interactive event buttons (default: false)"),
      autoplay: z.boolean().optional().describe("Enable autoplay (default: false)"),
      autoplay_speed_ms: z
        .number()
        .int()
        .min(100)
        .max(10000)
        .optional()
        .describe("Autoplay speed in ms (default: 1000)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_visualize", async () => {
        const { machine_id, codespace_id, interactive, autoplay, autoplay_speed_ms } = input as {
          machine_id: string;
          codespace_id: string;
          interactive?: boolean;
          autoplay?: boolean;
          autoplay_speed_ms?: number;
        };
        const { exportMachine } = await import("@/lib/state-machine/engine");
        const { generateVisualizerCode } = await import("@/lib/state-machine/visualizer-template");

        const machineExport = exportMachine(machine_id);
        const isInteractive = interactive ?? false;
        const isAutoplay = autoplay ?? false;
        const speedMs = autoplay_speed_ms ?? 1000;
        const code = generateVisualizerCode(machineExport, isInteractive, isAutoplay, speedMs);

        let deployFailed = false;
        try {
          const response = await fetch(`https://testing.spike.land/live/${codespace_id}/api/code`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (!response.ok) deployFailed = true;
        } catch {
          deployFailed = true;
        }

        if (deployFailed) {
          const { definition } = machineExport;
          const lines: string[] = ["stateDiagram-v2"];
          if (definition.initial) lines.push(`    [*] --> ${definition.initial}`);
          for (const [id, state] of Object.entries(definition.states)) {
            if (state.type === "final") lines.push(`    ${id} --> [*]`);
          }
          for (const t of definition.transitions) {
            const label = t.guard ? `${t.event} [${t.guard.expression}]` : t.event;
            lines.push(`    ${t.source} --> ${t.target} : ${label}`);
          }
          if (machineExport.currentStates.length > 0) {
            for (const active of machineExport.currentStates) {
              lines.push(`    note right of ${active} : ACTIVE`);
            }
          }
          let text = `**Visualization Fallback (Mermaid)**\n\n`;
          text += `The codespace service at \`testing.spike.land\` is unavailable. `;
          text += `Here is a Mermaid stateDiagram you can render in any Mermaid-compatible viewer:\n\n`;
          text += `\`\`\`mermaid\n${lines.join("\n")}\n\`\`\``;
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
  },

  {
    name: "sm_export",
    description:
      "Export a machine's full definition, current state, context, history, and transition log as JSON.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_export", async () => {
        const { machine_id } = input as { machine_id: string };
        const { exportMachine } = await import("@/lib/state-machine/engine");
        const machineExport = exportMachine(machine_id);
        return textResult(
          `**Machine Export**\n\n\`\`\`json\n${JSON.stringify(machineExport, null, 2)}\n\`\`\``,
        );
      });
    },
  },

  {
    name: "sm_list",
    description: "List all state machines owned by the current user.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {},
    handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
      return safeToolCall("sm_list", async () => {
        const { listMachines } = await import("@/lib/state-machine/engine");
        const machines = listMachines(ctx.userId);

        if (machines.length === 0) {
          return textResult("**No machines found.** Use `sm_create` to create one.");
        }

        let text = `**Your Machines** (${machines.length})\n\n`;
        for (const m of machines) {
          text += `- \`${m.id}\` **${m.name}** -- ${m.stateCount} states, ${m.transitionCount} transitions`;
          if (m.currentStates.length > 0) text += ` (active: ${m.currentStates.join(", ")})`;
          text += `\n`;
        }

        return textResult(text);
      });
    },
  },

  {
    name: "sm_share",
    description: "Share a state machine by generating a unique share token and link.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID to share"),
      machine_data: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Full machine export data for client-side machines"),
    },
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      return safeToolCall("sm_share", async () => {
        const { machine_id, machine_data } = input as {
          machine_id: string;
          machine_data?: Record<string, unknown>;
        };
        const { shareMachine } = await import("@/lib/state-machine/engine");
        const token = await shareMachine(
          machine_id,
          ctx.userId,
          machine_data as import("@/lib/state-machine/types").MachineExport | undefined,
        );
        const url = `https://spike.land/share/sm/${token}`;

        let text = `**Machine Shared Successfully**\n\n`;
        text += `- **Token:** \`${token}\`\n`;
        text += `- **Link:** [${url}](${url})\n\n`;
        text += `Anyone with this link can view and fork your state machine.`;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_get_shared",
    description: "Get a shared state machine's data using its share token.",
    category: "state-machine",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      token: z.string().min(1).describe("Share token"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_get_shared", async () => {
        const { token } = input as { token: string };
        const { getSharedMachine } = await import("@/lib/state-machine/engine");
        const exported = await getSharedMachine(token);
        return textResult(JSON.stringify(exported));
      });
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Template & code generation tools
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "sm_list_templates",
    description:
      "Browse the pre-built state machine template library. Filter by category to narrow results.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      category: z
        .enum(["auth", "cart", "workflow", "game", "iot", "ui"])
        .optional()
        .describe("Filter templates by category"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_list_templates", async () => {
        const { category } = input as { category?: string };
        const filtered = category ? TEMPLATES.filter((t) => t.category === category) : TEMPLATES;

        if (filtered.length === 0) {
          return textResult(`No templates found for category "${category}".`);
        }

        let text = `**State Machine Templates** (${filtered.length})\n\n`;
        for (const tmpl of filtered) {
          text += `### \`${tmpl.id}\` — ${tmpl.name}\n`;
          text += `- **Category:** ${tmpl.category}\n`;
          text += `- **States:** ${tmpl.states.length}\n`;
          text += `- **Transitions:** ${tmpl.transitions.length}\n`;
          text += `- **Description:** ${tmpl.description}\n\n`;
        }
        text += `Use \`sm_create_from_template\` with a template ID to instantiate one.`;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_create_from_template",
    description:
      "Create a new state machine from a template. Instantly populates states and transitions.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      template_id: z.string().min(1).describe("Template ID to use"),
      name: z.string().optional().describe("Custom name for the machine"),
    },
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      return safeToolCall("sm_create_from_template", async () => {
        const { template_id, name } = input as { template_id: string; name?: string };
        const tmpl = TEMPLATES.find((t) => t.id === template_id);
        if (!tmpl) {
          throw new Error(
            `Template "${template_id}" not found. Use sm_list_templates to see available templates.`,
          );
        }

        const { createMachine, addState, addTransition, resetMachine } = await import(
          "@/lib/state-machine/engine"
        );
        const machineName = name ?? tmpl.name;
        const initialStateId = tmpl.states[0]?.id ?? "";

        const instance = createMachine({
          name: machineName,
          initial: initialStateId,
          context: {},
          userId: ctx.userId,
          states: {},
          transitions: [],
        });
        const machineId = instance.definition.id;

        for (const stateDef of tmpl.states) {
          addState(machineId, {
            id: stateDef.id,
            type: stateDef.type,
            initial: stateDef.initial,
            parent: stateDef.parent,
            entryActions: [],
            exitActions: [],
          });
        }
        resetMachine(machineId);
        for (const trDef of tmpl.transitions) {
          addTransition(machineId, {
            source: trDef.source,
            target: trDef.target,
            event: trDef.event,
            guard: trDef.guard ? { expression: trDef.guard } : undefined,
            actions: [],
            internal: false,
          });
        }

        const stateList = tmpl.states.map((s) => `\`${s.id}\``).join(", ");
        const transitionList = tmpl.transitions
          .map((t) => `${t.source} -[${t.event}]-> ${t.target}`)
          .join(", ");

        let text = `**Machine Created from Template: ${tmpl.name}**\n\n`;
        text += `- **Machine ID:** \`${machineId}\`\n`;
        text += `- **Name:** ${machineName}\n`;
        text += `- **Template:** ${template_id}\n`;
        text += `- **Initial State:** \`${initialStateId}\`\n`;
        text += `- **States (${tmpl.states.length}):** ${stateList}\n`;
        text += `- **Transitions (${tmpl.transitions.length}):** ${transitionList}\n\n`;
        text += `Use \`sm_generate_code\` with machine ID \`${machineId}\` to export code.`;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_generate_code",
    description:
      "Generate TypeScript, XState v5, or Mermaid diagram code from an existing state machine.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID to generate code for"),
      framework: z
        .enum(["xstate", "typescript", "mermaid"])
        .optional()
        .describe("Target framework/format (default: typescript)"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_generate_code", async () => {
        const { machine_id, framework } = input as { machine_id: string; framework?: string };
        const { exportMachine } = await import("@/lib/state-machine/engine");
        const exported = exportMachine(machine_id);
        const { definition } = exported;
        const target = framework ?? "typescript";

        // Inline code generation
        const stateIds = Object.keys(definition.states);
        let code: string;

        if (target === "xstate") {
          const statesBlock = stateIds
            .map((sid) => {
              const s = definition.states[sid]!;
              const transitionsForState = definition.transitions.filter((t) => t.source === sid);
              const onBlock =
                transitionsForState.length > 0
                  ? `\n      on: {\n${transitionsForState
                      .map((t) => `        ${t.event}: "${t.target}",`)
                      .join("\n")}\n      },`
                  : "";
              if (s.type === "final") return `    ${sid}: { type: "final" },`;
              return `    ${sid}: {${onBlock}\n    },`;
            })
            .join("\n");

          const safeName = definition.name.replace(/\W+/g, "_");
          code = `import { createMachine } from "xstate";\n\nconst ${safeName}Machine = createMachine({\n  id: "${definition.name}",\n  initial: "${definition.initial}",\n  states: {\n${statesBlock}\n  },\n});\n\nexport default ${safeName}Machine;\n`;
        } else if (target === "mermaid") {
          const lines = [
            `stateDiagram-v2`,
            `  %% ${definition.name}`,
            `  [*] --> ${definition.initial}`,
          ];
          for (const t of definition.transitions) {
            const tgt = definition.states[t.target]?.type === "final" ? `[*]` : t.target;
            lines.push(`  ${t.source} --> ${tgt} : ${t.event}`);
          }
          code = lines.join("\n");
        } else {
          const stateUnion = stateIds.map((s) => `"${s}"`).join(" | ");
          const eventNames = [...new Set(definition.transitions.map((t) => t.event))];
          const eventUnion = eventNames.map((e) => `"${e}"`).join(" | ");
          const transitionRows = definition.transitions
            .map((t) => `  { from: "${t.source}", on: "${t.event}", to: "${t.target}" },`)
            .join("\n");
          code = `// State machine: ${definition.name}\ntype State = ${stateUnion};\ntype Event = ${eventUnion};\n\ninterface Transition {\n  from: State;\n  on: Event;\n  to: State;\n}\n\nconst TRANSITIONS: Transition[] = [\n${transitionRows}\n];\n\nlet current: State = "${definition.initial}";\n\nfunction send(event: Event): void {\n  const match = TRANSITIONS.find(\n    (t) => t.from === current && t.on === event\n  );\n  if (!match) {\n    throw new Error(\`No transition from "\${current}" on "\${event}"\`);\n  }\n  current = match.to;\n}\n\nexport { State, Event, send, current };\n`;
        }

        const ext = target === "mermaid" ? "mmd" : "ts";
        let text = `**Generated Code (${target}) for \`${definition.name}\`**\n\n`;
        text += `\`\`\`${ext === "mmd" ? "mermaid" : "typescript"}\n${code}\n\`\`\``;

        return textResult(text);
      });
    },
  },

  {
    name: "sm_simulate_sequence",
    description:
      "Simulate a sequence of events against a state machine and return step-by-step transitions.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID to simulate events against"),
      events: z.array(z.string().min(1)).min(1).describe("Ordered list of event names to send"),
    },
    handler: async (input: never): Promise<CallToolResult> => {
      return safeToolCall("sm_simulate_sequence", async () => {
        const { machine_id, events } = input as { machine_id: string; events: string[] };
        const { exportMachine, sendEvent } = await import("@/lib/state-machine/engine");

        const snapshot = exportMachine(machine_id);
        const initialStates = snapshot.currentStates;

        interface SimStep {
          step: number;
          event: string;
          fromState: string;
          toState: string;
          rejected: boolean;
        }

        const steps: SimStep[] = [];
        const rejected: string[] = [];

        for (let i = 0; i < events.length; i++) {
          const event = events[i]!;
          const current = exportMachine(machine_id).currentStates;
          const fromState = current.join(", ") || "(none)";

          try {
            const logEntry = sendEvent(machine_id, event);
            const toState = logEntry.toStates.join(", ") || "(none)";
            steps.push({ step: i + 1, event, fromState, toState, rejected: false });
          } catch {
            rejected.push(event);
            steps.push({ step: i + 1, event, fromState, toState: fromState, rejected: true });
          }
        }

        const finalStates = exportMachine(machine_id).currentStates.join(", ") || "(none)";

        let text = `**Simulation Complete** — ${steps.length} event(s) sent\n\n`;
        text += `**Initial State:** ${initialStates.join(", ") || "(none)"}\n\n`;
        text += `**Steps:**\n`;
        for (const step of steps) {
          const status = step.rejected ? "REJECTED" : "OK";
          text += `${step.step}. \`${step.event}\` [${status}]: ${step.fromState} -> ${step.toState}\n`;
        }
        text += `\n**Final State:** ${finalStates}\n`;

        if (rejected.length > 0) {
          text += `\n**Rejected Events (${rejected.length}):** ${rejected.join(", ")}\n`;
          text += `Rejected events had no matching transition from the current state.`;
        } else {
          text += `\nAll events were accepted.`;
        }

        return textResult(text);
      });
    },
  },
];
