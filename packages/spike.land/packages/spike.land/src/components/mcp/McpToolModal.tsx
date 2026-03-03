"use client";

import { useCallback, useRef, useState } from "react";
import type React from "react";
import { ICON_MAP } from "@/components/mcp/mcp-icon-map";
import { McpToolForm } from "@/components/mcp/McpToolForm";
import { McpResponseViewer } from "@/components/mcp/McpResponseViewer";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { MCP_CATEGORIES } from "@/components/mcp/mcp-tool-registry";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRecentTools } from "@/components/mcp/useMcpHistory";

interface McpToolModalProps {
  tool: McpToolDef | null;
  onClose: () => void;
}

const categoryMap = new Map(MCP_CATEGORIES.map(c => [c.id, c]));

interface ToolState {
  response: unknown;
  error: string | null;
  isExecuting: boolean;
}

export function McpToolModal({ tool, onClose }: McpToolModalProps) {
  const [state, setState] = useState<ToolState>({
    response: null,
    error: null,
    isExecuting: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const { addRecent } = useRecentTools();

  const handleExecute = useCallback(async (params: Record<string, unknown>) => {
    if (!tool) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ response: null, error: null, isExecuting: true });

    // Track usage
    addRecent(tool.name);

    try {
      const res = await fetch("/api/mcp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tool: tool.name, params }),
        signal: controller.signal,
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const errorMsg = typeof data === "object" && data !== null && "error" in data
          ? String((data as Record<string, unknown>).error)
          : `HTTP ${res.status}`;
        setState({ response: null, error: errorMsg, isExecuting: false });
        return;
      }

      setState({ response: data, error: null, isExecuting: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState({
        response: null,
        error: err instanceof Error ? err.message : "Unknown error",
        isExecuting: false,
      });
    }
  }, [tool, addRecent]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      abortRef.current?.abort();
      setState({ response: null, error: null, isExecuting: false });
      onClose();
    }
  }, [onClose]);

  if (!tool) return null;

  const cat = categoryMap.get(tool.category);
  const Icon = (cat?.icon ? ICON_MAP[cat.icon] : null) as
    | React.ComponentType<{ className?: string; }>
    | null;

  return (
    <Dialog open={tool !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-white/[0.08]">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0 mt-0.5">
              {Icon
                ? <Icon className="w-5 h-5 text-cyan-400" />
                : (
                  <span className="text-cyan-400 text-xs font-bold">
                    {tool.displayName[0]}
                  </span>
                )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-mono text-white text-base leading-tight">
                {tool.name}
              </DialogTitle>
              <p className="text-xs text-zinc-500 mt-0.5 mb-2">
                {tool.displayName}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {cat && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0">
                    {cat.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 ${
                    tool.tier === "free"
                      ? "text-green-400 border-green-400/30"
                      : "text-amber-400 border-amber-400/30"
                  }`}
                >
                  {tool.tier === "free" ? "Free" : "Pro"}
                </Badge>
              </div>
            </div>
          </div>
          {tool.description && (
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              {tool.description}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <McpToolForm
            tool={tool}
            onSubmit={handleExecute}
            isExecuting={state.isExecuting}
          />
          <McpResponseViewer
            response={state.response}
            error={state.error}
            isExecuting={state.isExecuting}
            responseType={tool.responseType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
