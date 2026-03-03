/**
 * State Machine Template Library & Code Generation Tools
 *
 * 4 tools for browsing pre-built templates, instantiating machines from
 * templates, generating TypeScript/XState/Mermaid code, and simulating
 * event sequences step-by-step.
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
  resetMachine,
  sendEvent,
} from "@/lib/state-machine/engine";
import type { StateNode, Transition } from "@/lib/state-machine/types";

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

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
      {
        source: "waiting",
        target: "failed",
        event: "GIVE_UP",
        guard: "context.attempts >= 3",
      },
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

// ---------------------------------------------------------------------------
// Code generation helpers
// ---------------------------------------------------------------------------

function generateXStateCode(
  name: string,
  initial: string,
  states: Record<string, StateNode>,
  transitions: Transition[],
): string {
  const stateIds = Object.keys(states);
  const statesBlock = stateIds.map(sid => {
    const s = states[sid]!;
    const transitionsForState = transitions.filter(t => t.source === sid);
    const onBlock = transitionsForState.length > 0
      ? `\n      on: {\n${
        transitionsForState
          .map(t => `        ${t.event}: "${t.target}",`)
          .join("\n")
      }\n      },`
      : "";

    if (s.type === "final") {
      return `    ${sid}: { type: "final" },`;
    }
    return `    ${sid}: {${onBlock}\n    },`;
  }).join("\n");

  return `import { createMachine } from "xstate";

const ${name.replace(/\W+/g, "_")}Machine = createMachine({
  id: "${name}",
  initial: "${initial}",
  states: {
${statesBlock}
  },
});

export default ${name.replace(/\W+/g, "_")}Machine;
`;
}

function generateTypeScriptCode(
  name: string,
  initial: string,
  states: Record<string, StateNode>,
  transitions: Transition[],
): string {
  const stateIds = Object.keys(states);
  const stateUnion = stateIds.map(s => `"${s}"`).join(" | ");
  const eventNames = [...new Set(transitions.map(t => t.event))];
  const eventUnion = eventNames.map(e => `"${e}"`).join(" | ");

  const transitionRows = transitions
    .map(t => `  { from: "${t.source}", on: "${t.event}", to: "${t.target}" },`)
    .join("\n");

  return `// State machine: ${name}
type State = ${stateUnion};
type Event = ${eventUnion};

interface Transition {
  from: State;
  on: Event;
  to: State;
}

const TRANSITIONS: Transition[] = [
${transitionRows}
];

let current: State = "${initial}";

function send(event: Event): void {
  const match = TRANSITIONS.find(
    (t) => t.from === current && t.on === event
  );
  if (!match) {
    throw new Error(\`No transition from "\${current}" on "\${event}"\`);
  }
  current = match.to;
}

export { State, Event, send, current };
`;
}

function generateMermaidCode(
  name: string,
  initial: string,
  states: Record<string, StateNode>,
  transitions: Transition[],
): string {
  const lines: string[] = [
    `stateDiagram-v2`,
    `  %% ${name}`,
    `  [*] --> ${initial}`,
  ];

  for (const t of transitions) {
    const target = states[t.target]?.type === "final"
      ? `[*]`
      : t.target;
    lines.push(`  ${t.source} --> ${target} : ${t.event}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Register function
// ---------------------------------------------------------------------------

export function registerStateMachineTemplateTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // sm_list_templates
  registry.register({
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
        .describe(
          "Filter templates by category: auth, cart, workflow, game, iot, or ui",
        ),
    },
    handler: async ({
      category,
    }: {
      category?: "auth" | "cart" | "workflow" | "game" | "iot" | "ui";
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_list_templates", async () => {
        const filtered = category
          ? TEMPLATES.filter(t => t.category === category)
          : TEMPLATES;

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
  });

  // sm_create_from_template
  registry.register({
    name: "sm_create_from_template",
    description:
      "Create a new state machine from a template. Instantly populates states and transitions from the chosen template.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      template_id: z
        .string()
        .min(1)
        .describe(
          "Template ID to use (see sm_list_templates for available IDs)",
        ),
      name: z
        .string()
        .optional()
        .describe(
          "Optional custom name for the machine (defaults to template name)",
        ),
    },
    handler: async ({
      template_id,
      name,
    }: {
      template_id: string;
      name?: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_create_from_template", async () => {
        const tmpl = TEMPLATES.find(t => t.id === template_id);
        if (!tmpl) {
          throw new Error(
            `Template "${template_id}" not found. Use sm_list_templates to see available templates.`,
          );
        }

        const machineName = name ?? tmpl.name;
        const initialStateId = tmpl.states[0]?.id ?? "";

        // Create the base machine
        const instance = createMachine({
          name: machineName,
          initial: initialStateId,
          context: {},
          userId,
          states: {},
          transitions: [],
        });
        const machineId = instance.definition.id;

        // Add all states
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

        // Reset so the machine enters the initial state
        resetMachine(machineId);

        // Add all transitions
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

        const stateList = tmpl.states.map(s => `\`${s.id}\``).join(", ");
        const transitionList = tmpl.transitions
          .map(t => `${t.source} -[${t.event}]-> ${t.target}`)
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
  });

  // sm_generate_code
  registry.register({
    name: "sm_generate_code",
    description:
      "Generate TypeScript, XState v5, or Mermaid diagram code from an existing state machine definition.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z.string().min(1).describe("Machine ID to generate code for"),
      framework: z
        .enum(["xstate", "typescript", "mermaid"])
        .optional()
        .describe(
          "Target framework/format: xstate (XState v5 machine), typescript (plain TS), or mermaid (diagram). Defaults to typescript.",
        ),
    },
    handler: async ({
      machine_id,
      framework,
    }: {
      machine_id: string;
      framework?: "xstate" | "typescript" | "mermaid";
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_generate_code", async () => {
        const exported = exportMachine(machine_id);
        const { definition } = exported;
        const target = framework ?? "typescript";

        let code: string;
        switch (target) {
          case "xstate":
            code = generateXStateCode(
              definition.name,
              definition.initial,
              definition.states,
              definition.transitions,
            );
            break;
          case "mermaid":
            code = generateMermaidCode(
              definition.name,
              definition.initial,
              definition.states,
              definition.transitions,
            );
            break;
          default:
            code = generateTypeScriptCode(
              definition.name,
              definition.initial,
              definition.states,
              definition.transitions,
            );
        }

        const ext = target === "mermaid" ? "mmd" : "ts";
        let text = `**Generated Code (${target}) for \`${definition.name}\`**\n\n`;
        text += `\`\`\`${ext === "mmd" ? "mermaid" : "typescript"}\n${code}\n\`\`\``;

        return textResult(text);
      });
    },
  });

  // sm_simulate_sequence
  registry.register({
    name: "sm_simulate_sequence",
    description:
      "Simulate a sequence of events against a state machine and return step-by-step state transitions, the final state, and any rejected events.",
    category: "sm-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: {
      machine_id: z
        .string()
        .min(1)
        .describe("Machine ID to simulate events against"),
      events: z
        .array(z.string().min(1))
        .min(1)
        .describe("Ordered list of event names to send to the machine"),
    },
    handler: async ({
      machine_id,
      events,
    }: {
      machine_id: string;
      events: string[];
    }): Promise<CallToolResult> => {
      return safeToolCall("sm_simulate_sequence", async () => {
        // Snapshot current exported state so we can restore after simulation
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
            steps.push({
              step: i + 1,
              event,
              fromState,
              toState,
              rejected: false,
            });
          } catch {
            rejected.push(event);
            steps.push({
              step: i + 1,
              event,
              fromState,
              toState: fromState,
              rejected: true,
            });
          }
        }

        const finalStates = exportMachine(machine_id).currentStates.join(", ") || "(none)";

        let text = `**Simulation Complete** — ${steps.length} event(s) sent\n\n`;
        text += `**Initial State:** ${initialStates.join(", ") || "(none)"}\n\n`;
        text += `**Steps:**\n`;
        for (const step of steps) {
          const status = step.rejected ? "REJECTED" : "OK";
          text +=
            `${step.step}. \`${step.event}\` [${status}]: ${step.fromState} -> ${step.toState}\n`;
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
  });
}
