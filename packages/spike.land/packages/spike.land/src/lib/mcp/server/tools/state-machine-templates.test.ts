import { beforeEach, describe, expect, it } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import { clearMachines, registerStateMachineTools } from "./state-machine";
import { registerStateMachineTemplateTools } from "./state-machine-templates";

const USER_ID = "test-user-sm-templates";

describe("state-machine-templates tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    clearMachines();
    registry = createMockRegistry();
    // Register base tools so templates can use sm_create / sm_send_event helpers
    // indirectly via the engine, and so we can create machines to test code gen
    registerStateMachineTools(registry, USER_ID);
    registerStateMachineTemplateTools(registry, USER_ID);
  });

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  it("should register 4 sm-templates tools", () => {
    expect(registry.handlers.has("sm_list_templates")).toBe(true);
    expect(registry.handlers.has("sm_create_from_template")).toBe(true);
    expect(registry.handlers.has("sm_generate_code")).toBe(true);
    expect(registry.handlers.has("sm_simulate_sequence")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // sm_list_templates
  // -------------------------------------------------------------------------

  describe("sm_list_templates", () => {
    it("should list all templates when no category is given", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({});
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("State Machine Templates");
      // Spot-check several template IDs are present
      expect(text).toContain("auth-flow");
      expect(text).toContain("traffic-light");
      expect(text).toContain("game-turn");
      expect(text).toContain("form-wizard");
    });

    it("should list at least 8 templates in total", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({});
      const text = getText(result);
      const matches = text.match(/###/g);
      expect(matches).not.toBeNull();
      expect((matches ?? []).length).toBeGreaterThanOrEqual(8);
    });

    it("should filter templates by category: auth", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({ category: "auth" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("auth-flow");
      expect(text).not.toContain("traffic-light");
    });

    it("should filter templates by category: iot", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({ category: "iot" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("traffic-light");
      expect(text).toContain("elevator");
      expect(text).not.toContain("auth-flow");
    });

    it("should filter templates by category: game", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({ category: "game" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("game-turn");
    });

    it("should include state and transition counts in listing", async () => {
      const handler = registry.handlers.get("sm_list_templates")!;
      const result = await handler({ category: "iot" });
      const text = getText(result);
      // traffic-light has 3 states
      expect(text).toContain("States:");
      expect(text).toContain("Transitions:");
    });
  });

  // -------------------------------------------------------------------------
  // sm_create_from_template
  // -------------------------------------------------------------------------

  describe("sm_create_from_template", () => {
    it("should create a machine from the traffic-light template", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const result = await handler({ template_id: "traffic-light" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Machine Created from Template");
      expect(text).toContain("Machine ID");
      expect(text).toContain("red");
      expect(text).toContain("green");
      expect(text).toContain("yellow");
    });

    it("should accept a custom name override", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const result = await handler({
        template_id: "auth-flow",
        name: "My Custom Auth",
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("My Custom Auth");
    });

    it("should use the template name when no custom name is given", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const result = await handler({ template_id: "shopping-cart" });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Shopping Cart");
    });

    it("should error for an unknown template ID", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const result = await handler({ template_id: "does-not-exist" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("does-not-exist");
    });

    it("should report correct state and transition counts in output", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const result = await handler({ template_id: "traffic-light" });
      const text = getText(result);
      // traffic-light: 3 states, 3 transitions
      expect(text).toContain("States (3)");
      expect(text).toContain("Transitions (3)");
    });
  });

  // -------------------------------------------------------------------------
  // sm_generate_code
  // -------------------------------------------------------------------------

  // Helper: create a machine from template and return its ID
  async function createMachineFromTemplate(templateId: string): Promise<string> {
    const handler = registry.handlers.get("sm_create_from_template")!;
    const result = await handler({ template_id: templateId });
    const text = getText(result);
    const match = text.match(/`([0-9a-f-]{36})`/);
    if (!match) throw new Error("Could not extract machine ID from result");
    return match[1]!;
  }

  describe("sm_generate_code", () => {
    it("should generate TypeScript code by default", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_generate_code")!;
      const result = await handler({ machine_id: machineId });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Generated Code (typescript)");
      expect(text).toContain("type State");
      expect(text).toContain("type Event");
      expect(text).toContain("NEXT");
    });

    it("should generate XState code when framework=xstate", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_generate_code")!;
      const result = await handler({
        machine_id: machineId,
        framework: "xstate",
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Generated Code (xstate)");
      expect(text).toContain("createMachine");
      expect(text).toContain("initial:");
    });

    it("should generate Mermaid diagram when framework=mermaid", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_generate_code")!;
      const result = await handler({
        machine_id: machineId,
        framework: "mermaid",
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Generated Code (mermaid)");
      expect(text).toContain("stateDiagram-v2");
      expect(text).toContain("NEXT");
    });

    it("should error for a non-existent machine ID", async () => {
      const handler = registry.handlers.get("sm_generate_code")!;
      const result = await handler({
        machine_id: "00000000-0000-0000-0000-000000000000",
        framework: "typescript",
      });
      expect(isError(result)).toBe(true);
    });

    it("should include the machine name in generated typescript code", async () => {
      const handler = registry.handlers.get("sm_create_from_template")!;
      const createResult = await handler({
        template_id: "traffic-light",
        name: "My Traffic Light",
      });
      const machineId = getText(createResult).match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/,
      )![1]!;

      const codeHandler = registry.handlers.get("sm_generate_code")!;
      const result = await codeHandler({
        machine_id: machineId,
        framework: "typescript",
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("My Traffic Light");
    });
  });

  // -------------------------------------------------------------------------
  // sm_simulate_sequence
  // -------------------------------------------------------------------------

  describe("sm_simulate_sequence", () => {
    it("should simulate a full traffic-light cycle", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: machineId,
        events: ["NEXT", "NEXT", "NEXT"],
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Simulation Complete");
      expect(text).toContain("3 event(s) sent");
      expect(text).toContain("red");
      expect(text).toContain("green");
      expect(text).toContain("yellow");
      expect(text).toContain("All events were accepted");
    });

    it("should report rejected events when no matching transition exists", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: machineId,
        events: ["NEXT", "INVALID_EVENT"],
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("REJECTED");
      expect(text).toContain("Rejected Events (1)");
      expect(text).toContain("INVALID_EVENT");
    });

    it("should show step-by-step from/to transitions in output", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: machineId,
        events: ["NEXT"],
      });
      const text = getText(result);
      // Step 1: red -> green
      expect(text).toMatch(/1\.\s*`NEXT`/);
      expect(text).toContain("red");
      expect(text).toContain("green");
    });

    it("should show the correct final state after simulation", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: machineId,
        events: ["NEXT", "NEXT"],
      });
      const text = getText(result);
      // After 2 NEXTs from red: red->green->yellow
      expect(text).toContain("Final State:");
      expect(text).toContain("yellow");
    });

    it("should error for a non-existent machine ID", async () => {
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: "00000000-0000-0000-0000-000000000000",
        events: ["NEXT"],
      });
      expect(isError(result)).toBe(true);
    });

    it("should handle a sequence where all events are rejected", async () => {
      const machineId = await createMachineFromTemplate("traffic-light");
      const handler = registry.handlers.get("sm_simulate_sequence")!;
      const result = await handler({
        machine_id: machineId,
        events: ["BAD1", "BAD2"],
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Rejected Events (2)");
      expect(text).toContain("BAD1");
      expect(text).toContain("BAD2");
    });
  });
});
