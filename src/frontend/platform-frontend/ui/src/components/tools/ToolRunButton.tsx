import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Lock, Unlock } from "lucide-react";
import { JsonSchemaForm, type JsonSchema } from "./JsonSchemaForm";
import { ToolResultInline } from "./ToolResultInline";
import { useMcpToolCall, useMcpTools } from "../../hooks/useMcp";

interface ToolRunButtonProps {
  toolName: string;
  appSlug: string;
  graph: Record<string, unknown>;
  session: { outputs: Record<string, unknown> };
  recordToolResult: (tool: string, input: Record<string, unknown>, result: unknown) => void;
  isAvailable: boolean;
}

export function ToolRunButton({
  toolName,
  graph,
  session,
  recordToolResult,
  isAvailable,
}: ToolRunButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const { mutate: callTool, isPending, data: result, error } = useMcpToolCall();
  const { data: toolsData } = useMcpTools();
  const [lastResult, setLastResult] = useState<unknown>(null);

  const toolDefinition = toolsData?.tools?.find((t) => t.name === toolName);
  const toolSchema = toolDefinition?.inputSchema || { type: "object" };

  // Pre-fill inputs based on session
  useEffect(() => {
    const toolGraph = graph[toolName] as { inputs?: Record<string, unknown> } | undefined;
    if (!toolGraph || !toolGraph.inputs) return;

    const newFormData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(toolGraph.inputs)) {
      if (typeof val === "string" && val.startsWith("from:")) {
        const path = val.slice(5);
        if (session.outputs[path] !== undefined) {
          newFormData[key] = session.outputs[path];
        }
      }
    }
    setFormData(newFormData);
  }, [session.outputs, graph, toolName]);

  // Keep result local and save to session
  useEffect(() => {
    if (result) {
      setLastResult(result);
      recordToolResult(toolName, formData, result);
    }
  }, [result, formData, recordToolResult, toolName]);

  const handleSubmit = (data: Record<string, unknown>) => {
    callTool({ name: toolName, args: data });
  };

  return (
    <div className="my-6 border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => isAvailable && setExpanded(!expanded)}
        disabled={!isAvailable}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isAvailable
            ? "hover:bg-muted/50 cursor-pointer"
            : "opacity-60 cursor-not-allowed bg-muted/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded-md ${isAvailable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {isAvailable ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <span className="font-mono text-sm font-semibold">{toolName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAvailable && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-success/10 text-success-foreground">
              Ready
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {expanded && isAvailable && (
        <div className="p-4 border-t border-border bg-background">
          <JsonSchemaForm
            schema={toolSchema as JsonSchema}
            onChange={setFormData}
            onSubmit={() => handleSubmit(formData)}
            isPending={isPending}
            initialData={formData}
          />

          {(lastResult || error) && (
            <div className="mt-4 pt-4 border-t border-border">
              <ToolResultInline result={lastResult} error={error} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
