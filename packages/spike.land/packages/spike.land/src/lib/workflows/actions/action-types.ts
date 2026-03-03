/**
 * Defines the type of a workflow action.
 */
export type WorkflowActionType =
  | "post_to_platform"
  | "send_notification"
  | "call_ai_agent"
  | "update_record"
  | "conditional"
  | "http_request"
  | "transform_data"
  | "parallel_execution"
  | "loop";

/**
 * The common interface for all workflow actions.
 */
export interface WorkflowAction<TInput, TOutput> {
  type: WorkflowActionType;
  execute: (input: TInput) => Promise<TOutput>;
  validate: (input: TInput) => void;
}

/**
 * Base interface for action inputs.
 */
export interface ActionInput {
  [key: string]: unknown;
}

/**
 * Base interface for action outputs.
 */
export interface ActionOutput {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
