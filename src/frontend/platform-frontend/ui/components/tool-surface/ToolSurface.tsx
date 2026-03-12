import { useState, useEffect, useCallback, useMemo } from "react";
import { Play, Loader2, Zap } from "lucide-react";
import { useMcpTools, useMcpToolCall } from "../../src/hooks/useMcp";
import { deriveSurface } from "../../../core-logic/derive-surface";
import type { SurfaceSpec } from "../../../core-logic/derive-surface";
import { FieldGroup } from "./FieldGroup";
import { ResultRenderer } from "./ResultRenderer";
import { formatIdentifier } from "./formatting";

interface ToolSurfaceProps {
  toolName: string;
  appSlug?: string;
  graph?: Record<string, unknown>;
  session?: { outputs: Record<string, unknown> };
  recordToolResult?: (tool: string, input: Record<string, unknown>, result: unknown) => void;
  isAvailable?: boolean;
  defaultExpanded?: boolean;
  initialData?: Record<string, unknown>;
}

export function ToolSurface({
  toolName,
  graph,
  session,
  recordToolResult,
  isAvailable = true,
  defaultExpanded = false,
  initialData,
}: ToolSurfaceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData ?? {});
  const [lastResult, setLastResult] = useState<unknown>(null);

  const { data: toolsData, isLoading: toolsLoading } = useMcpTools();
  const { mutate: callTool, isPending, data: result, error } = useMcpToolCall();

  const toolDef = toolsData?.tools?.find((t) => t.name === toolName);

  const surface: SurfaceSpec | null = useMemo(() => {
    if (!toolDef) return null;
    return deriveSurface({
      name: toolDef.name,
      description: toolDef.description,
      inputSchema: toolDef.inputSchema as {
        type: "object";
        properties?: Record<
          string,
          {
            type: string;
            description?: string;
            enum?: string[];
            default?: unknown;
            items?: unknown;
            properties?: unknown;
            required?: string[];
          }
        >;
        required?: string[];
      },
      examples: (toolDef as Record<string, unknown>).examples as
        | Array<{ label?: string; args?: Record<string, unknown> }>
        | undefined,
    });
  }, [toolDef]);

  // Initialize form defaults from surface spec
  useEffect(() => {
    if (!surface || Object.keys(formData).length > 0) return;
    const defaults: Record<string, unknown> = {};
    const allFields = [
      ...surface.fieldGroups.flatMap((g) => g.fields),
      ...(surface.advancedGroup?.fields ?? []),
    ];
    for (const field of allFields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      } else if (field.inputType === "boolean") {
        defaults[field.name] = false;
      } else if (field.inputType === "number") {
        defaults[field.name] = 0;
      } else if (field.inputType === "enum" && field.enumValues?.length) {
        defaults[field.name] = field.enumValues[0];
      } else if (field.inputType === "array") {
        defaults[field.name] = [];
      } else if (field.inputType === "object") {
        defaults[field.name] = {};
      } else {
        defaults[field.name] = "";
      }
    }
    setFormData({ ...defaults, ...(initialData ?? {}) });
  }, [surface, initialData, formData]);

  // Pre-fill from session graph
  useEffect(() => {
    if (!graph || !session) return;
    const toolGraph = graph[toolName] as { inputs?: Record<string, unknown> } | undefined;
    if (!toolGraph?.inputs) return;

    const prefill: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(toolGraph.inputs)) {
      if (typeof val === "string" && val.startsWith("from:")) {
        const path = val.slice(5);
        if (session.outputs[path] !== undefined) {
          prefill[key] = session.outputs[path];
        }
      }
    }
    if (Object.keys(prefill).length > 0) {
      setFormData((prev) => ({ ...prev, ...prefill }));
    }
  }, [session, graph, toolName, setFormData]);

  // Record result to session
  useEffect(() => {
    if (result) {
      setLastResult(result);
      recordToolResult?.(toolName, formData, result);
    }
  }, [result, toolName, formData, recordToolResult]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExecute = useCallback(() => {
    callTool({ name: toolName, args: formData });
  }, [callTool, toolName, formData]);

  const handleExampleClick = useCallback((data: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  if (toolsLoading) {
    return (
      <div className="rubik-panel p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading tool...</span>
      </div>
    );
  }

  if (!surface) {
    return (
      <div className="rubik-panel p-4 text-sm text-muted-foreground">
        Tool <code className="font-mono text-primary">{toolName}</code> not found.
      </div>
    );
  }

  return (
    <div className="rubik-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="block text-lg font-semibold tracking-[-0.04em] text-foreground">
                {formatIdentifier(surface.toolName)}
              </span>
              <span className="rounded-md border border-border/70 bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {surface.toolName}
              </span>
            </div>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground line-clamp-2">
              {surface.description}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {isAvailable && (
            <span className="rubik-chip px-2 py-0.5 text-[10px] bg-success/10 text-success-foreground">
              Ready
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {surface.examples.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-5 pt-4 pb-1">
              {surface.examples.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => handleExampleClick(ex.data)}
                  className="rubik-chip px-2.5 py-1 text-[10px] hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecute();
            }}
            className="space-y-6 p-5 sm:p-6"
          >
            {surface.fieldGroups.map((group) => (
              <FieldGroup
                key={group.label}
                label={group.label}
                fields={group.fields}
                formData={formData}
                onChange={handleFieldChange}
              />
            ))}

            {surface.advancedGroup && (
              <FieldGroup
                label={surface.advancedGroup.label}
                fields={surface.advancedGroup.fields}
                formData={formData}
                onChange={handleFieldChange}
                defaultCollapsed
              />
            )}

            <button
              type="submit"
              disabled={isPending || !isAvailable}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-50 sm:w-auto"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isPending ? "Running..." : "Execute"}
            </button>
          </form>

          {(lastResult || error) && (
            <output
              htmlFor={toolName}
              aria-label={`Result for ${toolName}`}
              className="block px-5 pb-5"
            >
              <ResultRenderer result={lastResult} error={error} />
            </output>
          )}
        </div>
      )}
    </div>
  );
}
