import type { WorkflowStepData } from "@/types/workflow";

/**
 * Context passed to step handlers during execution
 */
export interface ExecutionStepContext {
  workflowId: string;
  runId: string;
  previousOutputs: Map<string, Record<string, unknown>>;
  triggerData?: Record<string, unknown>;
}

/**
 * Step handler function type
 */
export type StepHandler = (
  step: WorkflowStepData,
  context: ExecutionStepContext,
) => Promise<{
  output?: Record<string, unknown>;
  error?: string;
}>;

/**
 * Step handler registry
 */
const stepHandlers: Map<string, StepHandler> = new Map();

/**
 * Register a step handler for a specific action type
 *
 * @param actionType - The action type (from step.config.actionType)
 * @param handler - The handler function
 */
export function registerStepHandler(actionType: string, handler: StepHandler): void {
  stepHandlers.set(actionType, handler);
}

/**
 * Get the registered handler for an action type
 */
export function getStepHandler(actionType: string): StepHandler | undefined {
  return stepHandlers.get(actionType);
}
