/**
 * Workflow Executor
 *
 * Executes workflow steps in the correct order, handling branching,
 * dependencies, and error handling.
 */

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import type {
  StepExecutionResult,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowStepData,
} from "@/types/workflow";
import type { Prisma, WorkflowStep } from "@prisma/client";

import {
  type ExecutionStepContext,
  getStepHandler,
  registerStepHandler,
  type StepHandler,
} from "./step-registry";

export { getStepHandler, registerStepHandler };
export type { ExecutionStepContext, StepHandler };

// ============================================================================
// Built-in Handlers
// ============================================================================

/**
 * No-op handler for triggers (they just pass through)
 */
registerStepHandler("trigger", async () => ({ output: {} }));

/**
 * Condition evaluation handler
 */
registerStepHandler("condition", async (step, context) => {
  const { condition, leftOperand, rightOperand, operator } = step.config as Record<string, unknown>;

  // Resolve operands (they might reference previous step outputs)
  const resolveValue = (value: unknown): unknown => {
    if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
      // Parse reference like {{stepId.outputField}}
      const ref = value.slice(2, -2).trim();
      const parts = ref.split(".");
      const stepId = parts[0];
      const fieldPath = parts.slice(1);

      if (!stepId) return undefined;

      const stepOutput = context.previousOutputs.get(stepId);
      if (!stepOutput) return undefined;

      let result: unknown = stepOutput;
      for (const field of fieldPath) {
        if (result && typeof result === "object" && field in result) {
          result = (result as Record<string, unknown>)[field];
        } else {
          return undefined;
        }
      }
      return result;
    }
    return value;
  };

  const left = resolveValue(leftOperand ?? condition);
  const right = resolveValue(rightOperand);
  const op = operator as string | undefined;

  let result: boolean;

  switch (op) {
    case "equals":
    case "==":
      result = left === right;
      break;
    case "not_equals":
    case "!=":
      result = left !== right;
      break;
    case "greater_than":
    case ">":
      result = (left as number) > (right as number);
      break;
    case "less_than":
    case "<":
      result = (left as number) < (right as number);
      break;
    case "greater_than_or_equals":
    case ">=":
      result = (left as number) >= (right as number);
      break;
    case "less_than_or_equals":
    case "<=":
      result = (left as number) <= (right as number);
      break;
    case "contains":
      result = String(left).includes(String(right));
      break;
    case "not_contains":
      result = !String(left).includes(String(right));
      break;
    case "is_empty":
      result =
        left === null ||
        left === undefined ||
        left === "" ||
        (Array.isArray(left) && left.length === 0);
      break;
    case "is_not_empty":
      result =
        left !== null &&
        left !== undefined &&
        left !== "" &&
        !(Array.isArray(left) && left.length === 0);
      break;
    default:
      // Simple truthy check if no operator specified
      result = Boolean(left);
  }

  return {
    output: { result, evaluated: { left, right, operator: op } },
  };
});

/**
 * Log/debug handler
 */
registerStepHandler("log", async (step, context) => {
  const message = step.config.message as string;
  logger.info(`[Workflow ${context.workflowId}] Log step: ${message}`);
  return { output: { logged: message } };
});

/**
 * Delay handler
 */
registerStepHandler("delay", async (step) => {
  const duration = (step.config.durationMs as number) ?? 1000;
  const maxDuration = 30000; // Cap at 30 seconds for safety
  const actualDuration = Math.min(duration, maxDuration);

  await new Promise((resolve) => setTimeout(resolve, actualDuration));

  return { output: { delayed: actualDuration } };
});

// ============================================================================
// Execution Logic
// ============================================================================

/**
 * Execute a single step
 */
async function executeStep(
  step: WorkflowStepData,
  context: ExecutionStepContext,
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    // Get the action type from config
    const actionType = (step.config.actionType as string) ?? step.type.toLowerCase();
    const handler = getStepHandler(actionType);

    if (!handler) {
      return {
        stepId: step.id!,
        status: "FAILED",
        error: `No handler registered for action type: ${actionType}`,
        durationMs: Date.now() - startTime,
      };
    }

    const result = await handler(step, context);

    if (result.error) {
      return {
        stepId: step.id!,
        status: "FAILED",
        error: result.error,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      stepId: step.id!,
      status: "COMPLETED",
      ...(result.output !== undefined ? { output: result.output } : {}),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      stepId: step.id!,
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Build execution order considering dependencies and branches
 *
 * @param steps - All steps in the workflow
 * @returns Steps in execution order (with branch handling)
 */
function buildExecutionPlan(steps: WorkflowStepData[]): WorkflowStepData[] {
  // Track which steps have been scheduled
  const executed = new Set<string>();
  const result: WorkflowStepData[] = [];

  // Get steps that can be executed (dependencies satisfied)
  const getReadySteps = (): WorkflowStepData[] => {
    return steps.filter((step) => {
      if (executed.has(step.id!)) return false;

      // Check dependencies
      const deps = step.dependencies ?? [];
      if (deps.some((depId) => !executed.has(depId))) return false;

      // If has parent, check if parent is executed
      if (step.parentStepId && !executed.has(step.parentStepId)) return false;

      return true;
    });
  };

  // Execute in waves until all steps are done
  let readySteps = getReadySteps();
  while (readySteps.length > 0) {
    // Sort by sequence within each wave
    readySteps.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    for (const step of readySteps) {
      result.push(step);
      executed.add(step.id!);
    }

    readySteps = getReadySteps();
  }

  return result;
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
  ctx: WorkflowExecutionContext,
): Promise<WorkflowExecutionResult> {
  const startedAt = new Date();

  // Get the workflow and version
  const workflow = await prisma.workflow.findFirst({
    where: { id: ctx.workflowId },
    include: {
      versions: {
        where: ctx.versionId ? { id: ctx.versionId } : { isPublished: true },
        include: {
          steps: {
            orderBy: { sequence: "asc" },
          },
        },
        take: 1,
      },
    },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const version = workflow.versions[0];
  if (!version) {
    throw new Error("No published version found");
  }

  // Create a run record
  const run = await prisma.workflowRun.create({
    data: {
      workflowId: ctx.workflowId,
      status: "RUNNING",
    },
  });

  // Log trigger info
  await prisma.workflowRunLog.create({
    data: {
      workflowRunId: run.id,
      message: `Workflow triggered via ${ctx.triggerType}`,
      metadata: {
        triggerId: ctx.triggerId,
        triggerData: ctx.triggerData,
        manualParams: ctx.manualParams,
      } as Prisma.InputJsonValue,
    },
  });

  const stepResults: StepExecutionResult[] = [];
  const previousOutputs = new Map<string, Record<string, unknown>>();

  // Map steps to data format
  const steps = version.steps.map(mapStepToData);

  // Build execution plan
  const executionPlan = buildExecutionPlan(steps);

  // Track which steps to skip (based on branching)
  const skippedSteps = new Set<string>();
  const conditionResults = new Map<string, boolean>();

  try {
    // Execute steps in order
    for (const step of executionPlan) {
      // Skip if marked for skipping
      if (skippedSteps.has(step.id!)) {
        stepResults.push({
          stepId: step.id!,
          status: "SKIPPED",
          durationMs: 0,
        });

        await prisma.workflowRunLog.create({
          data: {
            workflowRunId: run.id,
            ...(step.id !== undefined ? { stepId: step.id } : {}),
            stepStatus: "SKIPPED",
            message: `Step "${step.name}" skipped (branch not taken)`,
          },
        });

        continue;
      }

      // Log step start
      await prisma.workflowRunLog.create({
        data: {
          workflowRunId: run.id,
          ...(step.id !== undefined ? { stepId: step.id } : {}),
          stepStatus: "RUNNING",
          message: `Executing step "${step.name}"`,
        },
      });

      // Execute the step
      const stepTriggerData = ctx.triggerData ?? ctx.manualParams;
      const result = await executeStep(step, {
        workflowId: ctx.workflowId,
        runId: run.id,
        previousOutputs,
        ...(stepTriggerData !== undefined ? { triggerData: stepTriggerData } : {}),
      });

      stepResults.push(result);

      // Store output for dependency resolution
      if (result.output) {
        previousOutputs.set(step.id!, result.output);
      }

      // Log step completion
      await prisma.workflowRunLog.create({
        data: {
          workflowRunId: run.id,
          ...(step.id !== undefined ? { stepId: step.id } : {}),
          stepStatus: result.status,
          message: result.error ?? `Step "${step.name}" ${result.status.toLowerCase()}`,
          ...(result.output !== undefined
            ? { metadata: result.output as Prisma.InputJsonValue }
            : {}),
        },
      });

      // Handle branching for condition steps
      if (step.type === "CONDITION" && result.output) {
        const conditionResult = result.output.result as boolean;
        conditionResults.set(step.id!, conditionResult);

        // Find all child steps and mark non-matching branches for skipping
        const childSteps = steps.filter((s) => s.parentStepId === step.id);

        for (const childStep of childSteps) {
          const shouldExecute =
            (conditionResult && childStep.branchType === "IF_TRUE") ||
            (!conditionResult && childStep.branchType === "IF_FALSE") ||
            childStep.branchType === "DEFAULT";

          if (!shouldExecute) {
            // Mark this step and all its descendants for skipping
            markStepTreeForSkipping(childStep.id!, steps, skippedSteps);
          }
        }
      }

      // Stop on failure (unless configured to continue)
      if (result.status === "FAILED") {
        // Update run status
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            endedAt: new Date(),
          },
        });

        return {
          runId: run.id,
          status: "FAILED",
          startedAt,
          endedAt: new Date(),
          stepResults,
          ...(result.error !== undefined ? { error: result.error } : {}),
        };
      }
    }

    // Update run status to completed
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      status: "COMPLETED",
      startedAt,
      endedAt: new Date(),
      stepResults,
    };
  } catch (error) {
    // Update run status to failed
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
      },
    });

    await prisma.workflowRunLog.create({
      data: {
        workflowRunId: run.id,
        message: `Workflow execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    });

    return {
      runId: run.id,
      status: "FAILED",
      startedAt,
      endedAt: new Date(),
      stepResults,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Mark a step and all its descendants for skipping
 */
function markStepTreeForSkipping(
  stepId: string,
  allSteps: WorkflowStepData[],
  skippedSteps: Set<string>,
): void {
  skippedSteps.add(stepId);

  // Find child steps
  const childSteps = allSteps.filter((s) => s.parentStepId === stepId);
  for (const child of childSteps) {
    markStepTreeForSkipping(child.id!, allSteps, skippedSteps);
  }

  // Find steps that depend on this step
  const dependentSteps = allSteps.filter((s) => s.dependencies?.includes(stepId));
  for (const dependent of dependentSteps) {
    markStepTreeForSkipping(dependent.id!, allSteps, skippedSteps);
  }
}

/**
 * Manually trigger a workflow execution
 */
export async function triggerWorkflowManually(
  workflowId: string,
  workspaceId: string,
  params?: Record<string, unknown>,
): Promise<WorkflowExecutionResult> {
  // Verify workflow exists and is active
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.status !== "ACTIVE") {
    throw new Error("Workflow is not active");
  }

  return executeWorkflow({
    workflowId,
    versionId: "", // Will use published version
    triggerType: "manual",
    ...(params !== undefined ? { manualParams: params } : {}),
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapStepToData(step: WorkflowStep): WorkflowStepData {
  const deps = step.dependencies as string[] | undefined;
  return {
    id: step.id,
    name: step.name,
    type: step.type,
    sequence: step.sequence,
    config: step.config as Record<string, unknown>,
    ...(deps !== undefined ? { dependencies: deps } : {}),
    parentStepId: step.parentStepId,
    branchType: step.branchType,
    branchCondition: step.branchCondition,
  };
}

// Import action handlers to register them
import "./actions/hypothesis-agent-actions";
