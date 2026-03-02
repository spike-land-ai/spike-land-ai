import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowActionType } from "@/lib/workflows/actions/action-types";
import { Activity, Folder, GitFork, Zap } from "lucide-react";
import React from "react";
import type { NodePaletteItem, WorkflowNodeType } from "./types";

const items: NodePaletteItem[] = [
  { type: "trigger", label: "Trigger", icon: <Zap className="h-4 w-4" /> },
  {
    type: "action",
    actionType: "send_notification",
    label: "Send Notification",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    type: "action",
    actionType: "update_record",
    label: "Update Record",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    type: "action",
    actionType: "call_ai_agent",
    label: "Call AI Agent",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    type: "condition",
    label: "Condition",
    icon: <GitFork className="h-4 w-4" />,
  },
  { type: "group", label: "Group", icon: <Folder className="h-4 w-4" /> },
];

const NodePalette = () => {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: WorkflowNodeType,
    actionType?: WorkflowActionType,
  ) => {
    event.dataTransfer.setData("application/reactflow/type", nodeType);
    if (actionType) {
      event.dataTransfer.setData("application/reactflow/actionType", actionType);
    }
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <Card className="h-full w-64 border-r rounded-none">
      <CardHeader>
        <CardTitle>Nodes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex cursor-move items-center gap-2 rounded-md border bg-card p-3 hover:bg-accent hover:text-accent-foreground"
            draggable
            onDragStart={(event) => onDragStart(event, item.type, item.actionType)}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default NodePalette;
