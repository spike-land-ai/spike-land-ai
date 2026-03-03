import { describe, expect, it } from "vitest";

import { validateForPublish, validateWorkflow } from "./workflow-validator";

import type { WorkflowStepData } from "@/types/workflow";

function makeStep(
  overrides: Partial<WorkflowStepData> & { name: string; },
): WorkflowStepData {
  const { name, id, type, config, ...rest } = overrides;
  return {
    id: id ?? `step-${name}`,
    name,
    type: type ?? "ACTION",
    config: config === undefined ? {} : config,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// validateWorkflow
// ---------------------------------------------------------------------------

describe("validateWorkflow", () => {
  it("returns valid for a well-formed workflow", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Trigger", type: "TRIGGER" }),
      makeStep({
        name: "Do stuff",
        type: "ACTION",
        dependencies: ["step-Trigger"],
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid for empty workflow", () => {
    const result = validateWorkflow([]);
    expect(result.valid).toBe(true);
  });

  it("reports missing step name", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "", type: "TRIGGER" }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "MISSING_NAME")).toBe(true);
  });

  it("reports invalid step type", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Bad",
        type: "INVALID" as WorkflowStepData["type"],
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "INVALID_TYPE")).toBe(true);
  });

  it("reports invalid sequence (negative)", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Step", type: "ACTION", sequence: -1 }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "INVALID_SEQUENCE")).toBe(true);
  });

  it("reports invalid config (non-object)", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Step",
        type: "ACTION",
        config: null as unknown as Record<string, unknown>,
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "INVALID_CONFIG")).toBe(true);
  });

  it("reports branch without parent", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Branch",
        type: "ACTION",
        branchType: "TRUE" as WorkflowStepData["branchType"],
        parentStepId: undefined,
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "BRANCH_WITHOUT_PARENT")).toBe(
      true,
    );
  });

  it("warns about condition with no branches", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Cond", type: "CONDITION" }),
    ];
    const result = validateWorkflow(steps);
    expect(result.warnings.some(w => w.code === "CONDITION_NO_BRANCHES")).toBe(
      true,
    );
  });

  it("warns when no trigger exists", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Action", type: "ACTION" }),
    ];
    const result = validateWorkflow(steps);
    expect(result.warnings.some(w => w.code === "NO_TRIGGER")).toBe(true);
  });

  it("detects missing dependency", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Step",
        type: "ACTION",
        dependencies: ["nonexistent"],
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "MISSING_DEPENDENCY")).toBe(true);
  });

  it("detects missing parent reference", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Step",
        type: "ACTION",
        parentStepId: "nonexistent",
        branchType: "TRUE" as WorkflowStepData["branchType"],
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "MISSING_PARENT")).toBe(true);
  });

  it("detects cycle in dependencies", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "A", id: "a", type: "ACTION", dependencies: ["b"] }),
      makeStep({ name: "B", id: "b", type: "ACTION", dependencies: ["a"] }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "CYCLE_DETECTED")).toBe(true);
  });

  it("warns about orphan steps", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Trigger", type: "TRIGGER", id: "trigger" }),
      makeStep({
        name: "Connected",
        type: "ACTION",
        id: "connected",
        dependencies: ["trigger"],
      }),
      makeStep({ name: "Orphan", type: "ACTION", id: "orphan" }),
    ];
    const result = validateWorkflow(steps);
    expect(result.warnings.some(w => w.code === "ORPHAN_STEP")).toBe(true);
  });

  it("validates child steps recursively", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "Parent",
        type: "CONDITION",
        childSteps: [
          makeStep({
            name: "",
            type: "ACTION",
          }),
        ],
      }),
    ];
    const result = validateWorkflow(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "MISSING_NAME")).toBe(true);
  });

  it("accepts valid sequence of 0", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Step", type: "ACTION", sequence: 0 }),
    ];
    const result = validateWorkflow(steps);
    const seqErrors = result.errors.filter(e => e.code === "INVALID_SEQUENCE");
    expect(seqErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateForPublish
// ---------------------------------------------------------------------------

describe("validateForPublish", () => {
  it("rejects empty workflow", () => {
    const result = validateForPublish([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "EMPTY_WORKFLOW")).toBe(true);
  });

  it("rejects workflow without trigger", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Action", type: "ACTION" }),
    ];
    const result = validateForPublish(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NO_TRIGGER_FOR_PUBLISH")).toBe(
      true,
    );
  });

  it("rejects workflow without action", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Trigger", type: "TRIGGER" }),
    ];
    const result = validateForPublish(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "NO_ACTION_FOR_PUBLISH")).toBe(
      true,
    );
  });

  it("accepts valid publishable workflow", () => {
    const steps: WorkflowStepData[] = [
      makeStep({ name: "Trigger", type: "TRIGGER", id: "trigger" }),
      makeStep({
        name: "Action",
        type: "ACTION",
        id: "action",
        dependencies: ["trigger"],
      }),
    ];
    const result = validateForPublish(steps);
    expect(result.valid).toBe(true);
  });

  it("includes base validation errors", () => {
    const steps: WorkflowStepData[] = [
      makeStep({
        name: "",
        type: "TRIGGER",
      }),
      makeStep({ name: "Action", type: "ACTION" }),
    ];
    const result = validateForPublish(steps);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "MISSING_NAME")).toBe(true);
  });
});
