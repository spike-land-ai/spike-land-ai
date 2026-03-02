import type {
  WorkflowStepData,
  WorkflowValidationError,
  WorkflowValidationResult,
  WorkflowValidationWarning,
} from "@/types/workflow";
import type { WorkflowStepType } from "@prisma/client";

const VALID_STEP_TYPES: WorkflowStepType[] = ["TRIGGER", "ACTION", "CONDITION"];

/**
 * Validates a workflow's steps for correctness and detects cycles.
 */
export function validateWorkflow(steps: WorkflowStepData[]): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const warnings: WorkflowValidationWarning[] = [];

  // Validate individual steps
  for (const step of steps) {
    validateStep(step, errors, warnings);
  }

  // Check for cycles in dependencies
  const cycleErrors = detectCycles(steps);
  errors.push(...cycleErrors);

  // Check for missing dependencies
  const missingDepErrors = checkMissingDependencies(steps);
  errors.push(...missingDepErrors);

  // Check for orphan steps (no trigger and not depended on)
  const orphanWarnings = checkOrphanSteps(steps);
  warnings.push(...orphanWarnings);

  // Check for missing trigger
  const hasTrigger = steps.some((s) => s.type === "TRIGGER");
  if (!hasTrigger && steps.length > 0) {
    warnings.push({
      code: "NO_TRIGGER",
      message: "Workflow has no trigger step. It can only be run manually.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a single step
 */
function validateStep(
  step: WorkflowStepData,
  errors: WorkflowValidationError[],
  warnings: WorkflowValidationWarning[],
): void {
  // Check required fields
  if (!step.name || step.name.trim() === "") {
    errors.push({
      code: "MISSING_NAME",
      message: "Step name is required",
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  if (!step.type || !VALID_STEP_TYPES.includes(step.type)) {
    errors.push({
      code: "INVALID_TYPE",
      message: `Invalid step type: ${step.type}. Must be one of: ${VALID_STEP_TYPES.join(", ")}`,
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  if (step.sequence !== undefined && (typeof step.sequence !== "number" || step.sequence < 0)) {
    errors.push({
      code: "INVALID_SEQUENCE",
      message: "Step sequence must be a non-negative number",
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  // Validate config is an object
  if (!step.config || typeof step.config !== "object") {
    errors.push({
      code: "INVALID_CONFIG",
      message: "Step config must be an object",
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  // Validate branching
  if (step.branchType && !step.parentStepId) {
    errors.push({
      code: "BRANCH_WITHOUT_PARENT",
      message: "Branch type specified but no parent step ID provided",
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  // Warn if condition step has no branches
  if (step.type === "CONDITION" && (!step.childSteps || step.childSteps.length === 0)) {
    warnings.push({
      code: "CONDITION_NO_BRANCHES",
      message: "Condition step has no branches defined",
      ...(step.id !== undefined ? { stepId: step.id } : {}),
    });
  }

  // Validate child steps recursively
  if (step.childSteps) {
    for (const child of step.childSteps) {
      validateStep(child, errors, warnings);
    }
  }
}

/**
 * Detects cycles in step dependencies using DFS
 */
function detectCycles(steps: WorkflowStepData[]): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const stepMap = buildStepMap(steps);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(stepId: string, path: string[]): boolean {
    if (recursionStack.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      const cycle = [...path.slice(cycleStart), stepId];
      errors.push({
        code: "CYCLE_DETECTED",
        message: `Circular dependency detected: ${cycle.join(" -> ")}`,
        stepId,
        path: cycle.join(" -> "),
      });
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);

    const step = stepMap.get(stepId);
    if (step?.dependencies) {
      for (const depId of step.dependencies) {
        if (dfs(depId, [...path, stepId])) {
          return true;
        }
      }
    }

    // Also check parent relationship for branching
    if (step?.parentStepId) {
      if (dfs(step.parentStepId, [...path, stepId])) {
        return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (step.id && !visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return errors;
}

/**
 * Checks for missing dependency references
 */
function checkMissingDependencies(steps: WorkflowStepData[]): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const stepIds = collectAllStepIds(steps);

  function checkStep(step: WorkflowStepData): void {
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push({
            code: "MISSING_DEPENDENCY",
            message: `Step references non-existent dependency: ${depId}`,
            ...(step.id !== undefined ? { stepId: step.id } : {}),
          });
        }
      }
    }

    if (step.parentStepId && !stepIds.has(step.parentStepId)) {
      errors.push({
        code: "MISSING_PARENT",
        message: `Step references non-existent parent: ${step.parentStepId}`,
        ...(step.id !== undefined ? { stepId: step.id } : {}),
      });
    }

    if (step.childSteps) {
      for (const child of step.childSteps) {
        checkStep(child);
      }
    }
  }

  for (const step of steps) {
    checkStep(step);
  }

  return errors;
}

/**
 * Checks for orphan steps that won't be executed
 */
function checkOrphanSteps(steps: WorkflowStepData[]): WorkflowValidationWarning[] {
  const warnings: WorkflowValidationWarning[] = [];
  const reachable = new Set<string>();
  const allStepIds = collectAllStepIds(steps);

  // Start from triggers
  const triggers = steps.filter((s) => s.type === "TRIGGER");
  const toVisit = triggers.map((t) => t.id).filter((id): id is string => !!id);

  // BFS to find all reachable steps
  while (toVisit.length > 0) {
    const current = toVisit.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    // Find steps that depend on this one
    const dependents = findDependentSteps(steps, current);
    for (const dep of dependents) {
      if (dep.id && !reachable.has(dep.id)) {
        toVisit.push(dep.id);
      }
    }
  }

  // Find orphans
  for (const stepId of allStepIds) {
    if (!reachable.has(stepId)) {
      warnings.push({
        code: "ORPHAN_STEP",
        message: "Step is not reachable from any trigger",
        stepId,
      });
    }
  }

  return warnings;
}

/**
 * Builds a map of step ID to step data
 */
function buildStepMap(steps: WorkflowStepData[]): Map<string, WorkflowStepData> {
  const map = new Map<string, WorkflowStepData>();

  function addToMap(step: WorkflowStepData): void {
    if (step.id) {
      map.set(step.id, step);
    }
    if (step.childSteps) {
      for (const child of step.childSteps) {
        addToMap(child);
      }
    }
  }

  for (const step of steps) {
    addToMap(step);
  }

  return map;
}

/**
 * Collects all step IDs including nested ones
 */
function collectAllStepIds(steps: WorkflowStepData[]): Set<string> {
  const ids = new Set<string>();

  function collect(step: WorkflowStepData): void {
    if (step.id) {
      ids.add(step.id);
    }
    if (step.childSteps) {
      for (const child of step.childSteps) {
        collect(child);
      }
    }
  }

  for (const step of steps) {
    collect(step);
  }

  return ids;
}

/**
 * Finds steps that depend on a given step
 */
function findDependentSteps(steps: WorkflowStepData[], stepId: string): WorkflowStepData[] {
  const dependents: WorkflowStepData[] = [];

  function check(step: WorkflowStepData): void {
    if (step.dependencies?.includes(stepId) || step.parentStepId === stepId) {
      dependents.push(step);
    }
    if (step.childSteps) {
      for (const child of step.childSteps) {
        check(child);
      }
    }
  }

  for (const step of steps) {
    check(step);
  }

  return dependents;
}

/**
 * Validates that a workflow can be published
 */
export function validateForPublish(steps: WorkflowStepData[]): WorkflowValidationResult {
  const baseResult = validateWorkflow(steps);

  // Add publish-specific checks
  if (steps.length === 0) {
    baseResult.errors.push({
      code: "EMPTY_WORKFLOW",
      message: "Cannot publish an empty workflow",
    });
    baseResult.valid = false;
  }

  const hasTrigger = steps.some((s) => s.type === "TRIGGER");
  if (!hasTrigger) {
    baseResult.errors.push({
      code: "NO_TRIGGER_FOR_PUBLISH",
      message: "Workflow must have at least one trigger to be published",
    });
    baseResult.valid = false;
  }

  const hasAction = steps.some((s) => s.type === "ACTION");
  if (!hasAction) {
    baseResult.errors.push({
      code: "NO_ACTION_FOR_PUBLISH",
      message: "Workflow must have at least one action to be published",
    });
    baseResult.valid = false;
  }

  return baseResult;
}
