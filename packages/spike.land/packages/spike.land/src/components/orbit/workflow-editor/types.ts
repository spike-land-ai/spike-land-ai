import type { WorkflowActionType } from "@/lib/workflows/actions/action-types";
import type { Edge, Node } from "reactflow";

export type WorkflowNodeType = "trigger" | "action" | "condition" | "group";

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  actionType?: WorkflowActionType;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface NodePaletteItem {
  type: WorkflowNodeType;
  actionType?: WorkflowActionType;
  label: string;
  icon?: React.ReactNode;
}
