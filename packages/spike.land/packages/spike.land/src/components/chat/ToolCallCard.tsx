"use client";

import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentContentBlock } from "@/hooks/useAgentChat";
import { getToolRenderer } from "./tool-renderers/registry";
import { JsonView } from "./JsonView";

type ToolCallBlock = Extract<AgentContentBlock, { type: "tool_call"; }>;

interface ToolCallCardProps {
  block: ToolCallBlock;
}

const statusIcons = {
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};

export const ToolCallCard = memo(
  function ToolCallCard({ block }: ToolCallCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const Renderer = getToolRenderer(block.name);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            "rounded-lg border text-sm transition-colors",
            block.status === "error"
              ? "border-red-500/30 bg-red-500/5"
              : "border-white/10 bg-white/5",
          )}
        >
          {/* Header */}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors rounded-lg"
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-zinc-500 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              <Wrench className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-medium text-zinc-200 truncate">
                {formatToolName(block.name)}
              </span>
              <Badge
                variant="outline"
                className="ml-auto text-[10px] px-1.5 py-0 h-5 border-white/10 text-zinc-500"
              >
                {block.serverName}
              </Badge>
              {statusIcons[block.status]}
            </button>
          </CollapsibleTrigger>

          {/* Collapsible content */}
          <CollapsibleContent>
            <div className="border-t border-white/10 px-3 py-2 space-y-2">
              {/* Input */}
              {Object.keys(block.input).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Input
                  </p>
                  <JsonView data={block.input} maxExpandDepth={2} />
                </div>
              )}

              {/* Result */}
              {block.result !== undefined && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    {block.isError ? "Error" : "Result"}
                  </p>
                  <Renderer
                    result={block.result}
                    isError={block.isError ?? false}
                    name={block.name}
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  },
);

/** Strip namespace prefix and format tool name for display. */
function formatToolName(name: string): string {
  // Remove namespace prefix (e.g., "server__tool_name" -> "tool_name")
  const parts = name.split("__");
  const toolName = parts.length > 1 ? parts.slice(1).join("__") : name;
  // Convert underscores/hyphens to spaces and title-case
  return toolName.replace(/[_-]/g, " ").replace(
    /\b\w/g,
    c => c.toUpperCase(),
  );
}
