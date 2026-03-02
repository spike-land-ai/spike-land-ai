/**
 * Tests for workflow-executor.ts
 *
 * Covers:
 * - Built-in step handlers (trigger, condition, log, delay)
 * - Condition operator evaluation (all operators)
 * - Template reference resolution ({{stepId.field}})
 * - executeWorkflow: happy path, failure path, branching, skipping
 * - triggerWorkflowManually: active/inactive workflow checks
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Prisma mock (must be hoisted before imports) ────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  workflow: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  workflowRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  workflowRunLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

// ── Logger mock ──────────────────────────────────────────────────────────────
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ default: mockLogger }));

// ── Import AFTER mocks ───────────────────────────────────────────────────────
import {
  executeWorkflow,
  getStepHandler,
  registerStepHandler,
  triggerWorkflowManually,
} from "./workflow-executor";

import type { WorkflowExecutionContext, WorkflowStepData } from "@/types/workflow";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStep(
  overrides: Partial<WorkflowStepData> & { id: string; name: string },
): WorkflowStepData {
  return {
    type: "ACTION",
    config: {},
    sequence: 0,
    dependencies: [],
    parentStepId: null,
    branchType: null,
    branchCondition: null,
    ...overrides,
  };
}

/** Build the Prisma WorkflowStep shape that mapStepToData expects */
function makePrismaStep(overrides: {
  id: string;
  name: string;
  type?: string;
  sequence?: number;
  config?: Record<string, unknown>;
  dependencies?: string[];
  parentStepId?: string | null;
  branchType?: string | null;
  branchCondition?: string | null;
}) {
  return {
    type: "ACTION",
    sequence: 0,
    config: {},
    dependencies: [],
    parentStepId: null,
    branchType: null,
    branchCondition: null,
    ...overrides,
  };
}

function makePrismaWorkflow(steps: ReturnType<typeof makePrismaStep>[], publishedVersion = true) {
  return {
    id: "wf-1",
    name: "Test Workflow",
    status: "ACTIVE",
    workspaceId: "ws-1",
    versions: [
      {
        id: "ver-1",
        isPublished: publishedVersion,
        steps,
      },
    ],
  };
}

const BASE_CTX: WorkflowExecutionContext = {
  workflowId: "wf-1",
  versionId: "ver-1",
  triggerType: "manual",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("workflow-executor – built-in handlers", () => {
  describe("trigger handler", () => {
    it("returns empty output", async () => {
      const handler = getStepHandler("trigger");
      expect(handler).toBeDefined();
      const step = makeStep({ id: "s1", name: "Trigger", type: "TRIGGER", config: {} });
      const context = {
        workflowId: "wf-1",
        runId: "run-1",
        previousOutputs: new Map<string, Record<string, unknown>>(),
      };
      const result = await handler!(step, context);
      expect(result.output).toEqual({});
    });
  });

  describe("log handler", () => {
    it("returns logged message", async () => {
      const handler = getStepHandler("log");
      expect(handler).toBeDefined();
      const step = makeStep({
        id: "s1",
        name: "Log",
        type: "ACTION",
        config: { message: "hello world" },
      });
      const context = {
        workflowId: "wf-1",
        runId: "run-1",
        previousOutputs: new Map<string, Record<string, unknown>>(),
      };
      const result = await handler!(step, context);
      expect(result.output).toEqual({ logged: "hello world" });
    });
  });

  describe("delay handler", () => {
    it("caps delay at 30 seconds", async () => {
      vi.useFakeTimers();
      const handler = getStepHandler("delay");
      expect(handler).toBeDefined();
      const step = makeStep({
        id: "s1",
        name: "Delay",
        type: "ACTION",
        config: { durationMs: 999999 },
      });
      const context = {
        workflowId: "wf-1",
        runId: "run-1",
        previousOutputs: new Map<string, Record<string, unknown>>(),
      };

      const resultPromise = handler!(step, context);
      vi.advanceTimersByTime(30000);
      const result = await resultPromise;

      expect(result.output?.delayed).toBe(30000);
      vi.useRealTimers();
    });

    it("uses default duration of 1000ms when not specified", async () => {
      vi.useFakeTimers();
      const handler = getStepHandler("delay");
      const step = makeStep({ id: "s1", name: "Delay", type: "ACTION", config: {} });
      const context = {
        workflowId: "wf-1",
        runId: "run-1",
        previousOutputs: new Map<string, Record<string, unknown>>(),
      };

      const resultPromise = handler!(step, context);
      vi.advanceTimersByTime(1000);
      const result = await resultPromise;

      expect(result.output?.delayed).toBe(1000);
      vi.useRealTimers();
    });
  });

  describe("condition handler", () => {
    async function evalCondition(
      config: Record<string, unknown>,
      previousOutputs?: Map<string, Record<string, unknown>>,
    ) {
      const handler = getStepHandler("condition");
      expect(handler).toBeDefined();
      const step = makeStep({ id: "s1", name: "Cond", type: "CONDITION", config });
      const context = {
        workflowId: "wf-1",
        runId: "run-1",
        previousOutputs: previousOutputs ?? new Map<string, Record<string, unknown>>(),
      };
      return handler!(step, context);
    }

    it("evaluates equals (==) operator correctly – true case", async () => {
      const result = await evalCondition({ leftOperand: "a", rightOperand: "a", operator: "==" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates equals (==) operator correctly – false case", async () => {
      const result = await evalCondition({ leftOperand: "a", rightOperand: "b", operator: "==" });
      expect(result.output?.result).toBe(false);
    });

    it("evaluates not_equals (!=) operator", async () => {
      const result = await evalCondition({ leftOperand: 1, rightOperand: 2, operator: "!=" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates greater_than (>) operator", async () => {
      const result = await evalCondition({ leftOperand: 5, rightOperand: 3, operator: ">" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates less_than (<) operator", async () => {
      const result = await evalCondition({ leftOperand: 2, rightOperand: 10, operator: "<" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates greater_than_or_equals (>=) operator", async () => {
      const r1 = await evalCondition({ leftOperand: 5, rightOperand: 5, operator: ">=" });
      const r2 = await evalCondition({ leftOperand: 4, rightOperand: 5, operator: ">=" });
      expect(r1.output?.result).toBe(true);
      expect(r2.output?.result).toBe(false);
    });

    it("evaluates less_than_or_equals (<=) operator", async () => {
      const r1 = await evalCondition({ leftOperand: 5, rightOperand: 5, operator: "<=" });
      const r2 = await evalCondition({ leftOperand: 6, rightOperand: 5, operator: "<=" });
      expect(r1.output?.result).toBe(true);
      expect(r2.output?.result).toBe(false);
    });

    it("evaluates named greater_than operator", async () => {
      const result = await evalCondition({
        leftOperand: 10,
        rightOperand: 3,
        operator: "greater_than",
      });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates named less_than operator", async () => {
      const result = await evalCondition({
        leftOperand: 1,
        rightOperand: 10,
        operator: "less_than",
      });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates named equals operator", async () => {
      const result = await evalCondition({
        leftOperand: "x",
        rightOperand: "x",
        operator: "equals",
      });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates named not_equals operator", async () => {
      const result = await evalCondition({
        leftOperand: "x",
        rightOperand: "y",
        operator: "not_equals",
      });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates contains operator", async () => {
      const r1 = await evalCondition({
        leftOperand: "hello world",
        rightOperand: "world",
        operator: "contains",
      });
      const r2 = await evalCondition({
        leftOperand: "hello",
        rightOperand: "xyz",
        operator: "contains",
      });
      expect(r1.output?.result).toBe(true);
      expect(r2.output?.result).toBe(false);
    });

    it("evaluates not_contains operator", async () => {
      const result = await evalCondition({
        leftOperand: "hello",
        rightOperand: "xyz",
        operator: "not_contains",
      });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates is_empty operator – null", async () => {
      const result = await evalCondition({ leftOperand: null, operator: "is_empty" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates is_empty operator – empty string", async () => {
      const result = await evalCondition({ leftOperand: "", operator: "is_empty" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates is_empty operator – empty array", async () => {
      const result = await evalCondition({ leftOperand: [], operator: "is_empty" });
      expect(result.output?.result).toBe(true);
    });

    it("evaluates is_not_empty operator", async () => {
      const result = await evalCondition({ leftOperand: "value", operator: "is_not_empty" });
      expect(result.output?.result).toBe(true);
    });

    it("defaults to truthy check when no operator is given", async () => {
      const r1 = await evalCondition({ condition: "truthy-value" });
      const r2 = await evalCondition({ condition: "" });
      expect(r1.output?.result).toBe(true);
      expect(r2.output?.result).toBe(false);
    });

    it("resolves {{stepId.field}} template references from previousOutputs", async () => {
      const previousOutputs = new Map<string, Record<string, unknown>>();
      previousOutputs.set("step-a", { score: 42 });

      const result = await evalCondition(
        { leftOperand: "{{step-a.score}}", rightOperand: 42, operator: "==" },
        previousOutputs,
      );
      expect(result.output?.result).toBe(true);
    });

    it("returns undefined for missing step reference", async () => {
      const result = await evalCondition({
        leftOperand: "{{missing-step.field}}",
        operator: "is_empty",
      });
      expect(result.output?.result).toBe(true);
    });

    it("resolves nested field path {{stepId.a.b}}", async () => {
      const previousOutputs = new Map<string, Record<string, unknown>>();
      previousOutputs.set("step-x", { nested: { value: "deep" } });

      const result = await evalCondition(
        { leftOperand: "{{step-x.nested.value}}", rightOperand: "deep", operator: "==" },
        previousOutputs,
      );
      expect(result.output?.result).toBe(true);
    });

    it("returns undefined for invalid nested path", async () => {
      const previousOutputs = new Map<string, Record<string, unknown>>();
      previousOutputs.set("step-y", { a: "string-not-object" });

      const result = await evalCondition(
        { leftOperand: "{{step-y.a.b}}", operator: "is_empty" },
        previousOutputs,
      );
      expect(result.output?.result).toBe(true);
    });

    it("includes evaluated details in output", async () => {
      const result = await evalCondition({ leftOperand: 5, rightOperand: 3, operator: ">" });
      expect(result.output?.evaluated).toMatchObject({ left: 5, right: 3, operator: ">" });
    });
  });
});

// ── registerStepHandler / getStepHandler ─────────────────────────────────────

describe("registerStepHandler / getStepHandler", () => {
  it("registers a custom handler and retrieves it", () => {
    const myHandler = vi.fn().mockResolvedValue({ output: { custom: true } });
    registerStepHandler("custom_action_xyz", myHandler);
    expect(getStepHandler("custom_action_xyz")).toBe(myHandler);
  });

  it("returns undefined for unregistered action type", () => {
    expect(getStepHandler("totally_unknown_action_abc")).toBeUndefined();
  });

  it("overwrites previously registered handler", () => {
    const h1 = vi.fn().mockResolvedValue({ output: { v: 1 } });
    const h2 = vi.fn().mockResolvedValue({ output: { v: 2 } });
    registerStepHandler("overwrite_test_exec", h1);
    registerStepHandler("overwrite_test_exec", h2);
    expect(getStepHandler("overwrite_test_exec")).toBe(h2);
  });
});

// ── executeWorkflow ───────────────────────────────────────────────────────────

describe("executeWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workflowRun.create.mockResolvedValue({ id: "run-1" });
    mockPrisma.workflowRunLog.create.mockResolvedValue({});
    mockPrisma.workflowRun.update.mockResolvedValue({});
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);
    await expect(executeWorkflow(BASE_CTX)).rejects.toThrow("Workflow not found");
  });

  it("throws when no published version exists", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue({
      id: "wf-1",
      versions: [],
    });
    await expect(executeWorkflow(BASE_CTX)).rejects.toThrow("No published version found");
  });

  it("executes a single trigger step and returns COMPLETED", async () => {
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.status).toBe("COMPLETED");
    expect(result.runId).toBe("run-1");
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0]!.stepId).toBe("s1");
    expect(result.stepResults[0]!.status).toBe("COMPLETED");
  });

  it("returns FAILED and stops execution when a step fails", async () => {
    // Register a handler that errors
    registerStepHandler("failing_action", async () => ({ error: "step failed hard" }));

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
      makePrismaStep({
        id: "s2",
        name: "Fail",
        type: "ACTION",
        config: { actionType: "failing_action" },
        sequence: 1,
        dependencies: ["s1"],
      }),
      makePrismaStep({
        id: "s3",
        name: "After",
        type: "ACTION",
        config: { actionType: "trigger" },
        sequence: 2,
        dependencies: ["s2"],
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("step failed hard");
    // Only s1 and s2 run; s3 is not reached because execution stops on failure
    const statuses = result.stepResults.map((r) => r.status);
    expect(statuses).toContain("COMPLETED"); // s1
    expect(statuses).toContain("FAILED"); // s2
    // s3 should NOT be present since we stop after failure
    expect(result.stepResults.find((r) => r.stepId === "s3")).toBeUndefined();
  });

  it("marks run as FAILED in DB when step fails", async () => {
    registerStepHandler("always_fail", async () => ({ error: "boom" }));

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Fail",
        type: "ACTION",
        config: { actionType: "always_fail" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow(BASE_CTX);

    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("marks run as COMPLETED in DB when all steps succeed", async () => {
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow(BASE_CTX);

    expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });

  it("handles a step with no registered handler – returns FAILED result", async () => {
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Unknown",
        type: "ACTION",
        config: { actionType: "no_such_handler_xyz" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.status).toBe("FAILED");
    expect(result.stepResults[0]!.status).toBe("FAILED");
    expect(result.stepResults[0]!.error).toContain("no_such_handler_xyz");
  });

  it("catches unexpected errors thrown by a handler and returns FAILED", async () => {
    registerStepHandler("throw_action", async () => {
      throw new Error("unexpected handler crash");
    });

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Crash",
        type: "ACTION",
        config: { actionType: "throw_action" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.status).toBe("FAILED");
    expect(result.stepResults[0]!.status).toBe("FAILED");
    expect(result.stepResults[0]!.error).toBe("unexpected handler crash");
  });

  it("stores step output in previousOutputs for subsequent steps", async () => {
    let capturedOutputs: Map<string, Record<string, unknown>> | undefined;

    registerStepHandler("producer", async () => ({ output: { value: 99 } }));
    registerStepHandler("consumer", async (_step, ctx) => {
      capturedOutputs = ctx.previousOutputs;
      return { output: {} };
    });

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Producer",
        type: "ACTION",
        config: { actionType: "producer" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "s2",
        name: "Consumer",
        type: "ACTION",
        config: { actionType: "consumer" },
        sequence: 1,
        dependencies: ["s1"],
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow(BASE_CTX);

    expect(capturedOutputs?.get("s1")).toEqual({ value: 99 });
  });

  it("executes steps in sequence order (dependency resolution)", async () => {
    const executionOrder: string[] = [];

    registerStepHandler("order_step", async (step) => {
      executionOrder.push(step.id!);
      return { output: {} };
    });

    const steps = [
      makePrismaStep({
        id: "s3",
        name: "Third",
        type: "ACTION",
        config: { actionType: "order_step" },
        sequence: 2,
        dependencies: ["s2"],
      }),
      makePrismaStep({
        id: "s1",
        name: "First",
        type: "ACTION",
        config: { actionType: "order_step" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "s2",
        name: "Second",
        type: "ACTION",
        config: { actionType: "order_step" },
        sequence: 1,
        dependencies: ["s1"],
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow(BASE_CTX);

    expect(executionOrder).toEqual(["s1", "s2", "s3"]);
  });

  it("skips IF_FALSE branch when condition is true", async () => {
    registerStepHandler("condition", async () => ({
      output: { result: true, evaluated: { left: true, right: undefined, operator: undefined } },
    }));
    registerStepHandler("if_true_action", async () => ({ output: { branch: "true" } }));
    registerStepHandler("if_false_action", async () => ({ output: { branch: "false" } }));

    const steps = [
      makePrismaStep({
        id: "cond",
        name: "Condition",
        type: "CONDITION",
        config: { actionType: "condition" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "true-branch",
        name: "TrueBranch",
        type: "ACTION",
        config: { actionType: "if_true_action" },
        sequence: 1,
        parentStepId: "cond",
        branchType: "IF_TRUE",
      }),
      makePrismaStep({
        id: "false-branch",
        name: "FalseBranch",
        type: "ACTION",
        config: { actionType: "if_false_action" },
        sequence: 2,
        parentStepId: "cond",
        branchType: "IF_FALSE",
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    const trueBranchResult = result.stepResults.find((r) => r.stepId === "true-branch");
    const falseBranchResult = result.stepResults.find((r) => r.stepId === "false-branch");

    expect(trueBranchResult?.status).toBe("COMPLETED");
    expect(falseBranchResult?.status).toBe("SKIPPED");
  });

  it("skips IF_TRUE branch when condition is false", async () => {
    registerStepHandler("condition_false", async () => ({
      output: { result: false, evaluated: { left: false, right: undefined, operator: undefined } },
    }));
    registerStepHandler("true_side", async () => ({ output: {} }));
    registerStepHandler("false_side", async () => ({ output: {} }));

    const steps = [
      makePrismaStep({
        id: "cond",
        name: "Condition",
        type: "CONDITION",
        config: { actionType: "condition_false" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "true-b",
        name: "TrueBranch",
        type: "ACTION",
        config: { actionType: "true_side" },
        sequence: 1,
        parentStepId: "cond",
        branchType: "IF_TRUE",
      }),
      makePrismaStep({
        id: "false-b",
        name: "FalseBranch",
        type: "ACTION",
        config: { actionType: "false_side" },
        sequence: 2,
        parentStepId: "cond",
        branchType: "IF_FALSE",
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.stepResults.find((r) => r.stepId === "true-b")?.status).toBe("SKIPPED");
    expect(result.stepResults.find((r) => r.stepId === "false-b")?.status).toBe("COMPLETED");
  });

  it("always executes DEFAULT branches regardless of condition result", async () => {
    registerStepHandler("cond_handler", async () => ({
      output: { result: true, evaluated: { left: true, right: undefined, operator: undefined } },
    }));
    registerStepHandler("default_action", async () => ({ output: { default: true } }));

    const steps = [
      makePrismaStep({
        id: "cond",
        name: "Condition",
        type: "CONDITION",
        config: { actionType: "cond_handler" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "default-b",
        name: "Default",
        type: "ACTION",
        config: { actionType: "default_action" },
        sequence: 1,
        parentStepId: "cond",
        branchType: "DEFAULT",
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.stepResults.find((r) => r.stepId === "default-b")?.status).toBe("COMPLETED");
  });

  it("recursively skips descendants of skipped steps", async () => {
    registerStepHandler("cond_true", async () => ({
      output: { result: true, evaluated: { left: true, right: undefined, operator: undefined } },
    }));
    registerStepHandler("child_action", async () => ({ output: {} }));

    const steps = [
      makePrismaStep({
        id: "cond",
        name: "Condition",
        type: "CONDITION",
        config: { actionType: "cond_true" },
        sequence: 0,
      }),
      makePrismaStep({
        id: "false-parent",
        name: "FalseParent",
        type: "ACTION",
        config: { actionType: "child_action" },
        sequence: 1,
        parentStepId: "cond",
        branchType: "IF_FALSE",
      }),
      makePrismaStep({
        id: "false-child",
        name: "FalseChild",
        type: "ACTION",
        config: { actionType: "child_action" },
        sequence: 2,
        parentStepId: "false-parent",
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    expect(result.stepResults.find((r) => r.stepId === "false-parent")?.status).toBe("SKIPPED");
    expect(result.stepResults.find((r) => r.stepId === "false-child")?.status).toBe("SKIPPED");
  });

  it("creates a workflowRunLog entry for trigger info on start", async () => {
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow({ ...BASE_CTX, triggerType: "webhook", triggerId: "hook-1" });

    expect(mockPrisma.workflowRunLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining("webhook"),
        }),
      }),
    );
  });

  it("passes triggerData to step context", async () => {
    let receivedTriggerData: Record<string, unknown> | undefined;

    registerStepHandler("trigger_data_spy", async (_step, ctx) => {
      receivedTriggerData = ctx.triggerData;
      return { output: {} };
    });

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Spy",
        type: "ACTION",
        config: { actionType: "trigger_data_spy" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow({ ...BASE_CTX, triggerData: { event: "purchase", amount: 99 } });

    expect(receivedTriggerData).toEqual({ event: "purchase", amount: 99 });
  });

  it("falls back to manualParams when triggerData is absent", async () => {
    let receivedTriggerData: Record<string, unknown> | undefined;

    registerStepHandler("manual_params_spy", async (_step, ctx) => {
      receivedTriggerData = ctx.triggerData;
      return { output: {} };
    });

    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Spy",
        type: "ACTION",
        config: { actionType: "manual_params_spy" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    await executeWorkflow({ ...BASE_CTX, manualParams: { key: "value" } });

    expect(receivedTriggerData).toEqual({ key: "value" });
  });

  it("catches exceptions from prisma and marks run as FAILED", async () => {
    registerStepHandler("ok_step", async () => ({ output: {} }));

    const steps = [
      makePrismaStep({ id: "s1", name: "Ok", type: "ACTION", config: { actionType: "ok_step" } }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    // Make workflowRunLog.create throw mid-execution
    mockPrisma.workflowRunLog.create
      .mockResolvedValueOnce({}) // trigger log
      .mockResolvedValueOnce({}) // step start log
      .mockRejectedValueOnce(new Error("DB connection lost")); // step completion log

    const result = await executeWorkflow(BASE_CTX);

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("DB connection lost");
  });

  it("returns durationMs as a non-negative number for each step", async () => {
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);

    for (const stepResult of result.stepResults) {
      expect(stepResult.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses step type as fallback actionType when config.actionType is not set", async () => {
    // TRIGGER type falls back to "trigger" handler (registered as built-in)
    const steps = [
      makePrismaStep({ id: "s1", name: "Trigger", type: "TRIGGER", config: {} }), // no actionType in config
    ];
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow(steps));

    const result = await executeWorkflow(BASE_CTX);
    expect(result.stepResults[0]!.status).toBe("COMPLETED");
  });
});

// ── triggerWorkflowManually ───────────────────────────────────────────────────

describe("triggerWorkflowManually", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workflowRun.create.mockResolvedValue({ id: "run-1" });
    mockPrisma.workflowRunLog.create.mockResolvedValue({});
    mockPrisma.workflowRun.update.mockResolvedValue({});
  });

  it("throws when workflow is not found in workspace", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValueOnce(null);
    await expect(triggerWorkflowManually("wf-1", "ws-1")).rejects.toThrow("Workflow not found");
  });

  it("throws when workflow status is not ACTIVE", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValueOnce({
      id: "wf-1",
      status: "DRAFT",
      workspaceId: "ws-1",
    });
    await expect(triggerWorkflowManually("wf-1", "ws-1")).rejects.toThrow("Workflow is not active");
  });

  it("calls executeWorkflow with manual trigger type when workflow is ACTIVE", async () => {
    // First findFirst = verify workflow exists + status check
    mockPrisma.workflow.findFirst.mockResolvedValueOnce({
      id: "wf-1",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    // Second findFirst = executeWorkflow internal call
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Trigger",
        type: "TRIGGER",
        config: { actionType: "trigger" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValueOnce(makePrismaWorkflow(steps));

    const result = await triggerWorkflowManually("wf-1", "ws-1", { input: "test" });

    expect(result.status).toBe("COMPLETED");
  });

  it("passes manual params through to the execution context", async () => {
    let receivedParams: Record<string, unknown> | undefined;

    registerStepHandler("params_capture", async (_step, ctx) => {
      receivedParams = ctx.triggerData;
      return { output: {} };
    });

    mockPrisma.workflow.findFirst.mockResolvedValueOnce({
      id: "wf-1",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    const steps = [
      makePrismaStep({
        id: "s1",
        name: "Capture",
        type: "ACTION",
        config: { actionType: "params_capture" },
      }),
    ];
    mockPrisma.workflow.findFirst.mockResolvedValueOnce(makePrismaWorkflow(steps));

    await triggerWorkflowManually("wf-1", "ws-1", { userId: "u-123", mode: "fast" });

    expect(receivedParams).toEqual({ userId: "u-123", mode: "fast" });
  });
});
