"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Play, Sparkles } from "lucide-react";
import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { MCP_TOOLS } from "@/components/mcp/mcp-tool-registry";
import { getToolRenderer } from "@/components/chat/tool-renderers/registry";

interface McpFeaturedToolsProps {
  onTryIt: (tool: McpToolDef) => void;
}

interface FeaturedDef {
  name: string;
  exampleLabel: string;
  exampleParams: Record<string, unknown>;
}

const FEATURED_DEFS: FeaturedDef[] = [
  {
    name: "search_tools",
    exampleLabel: "Search for image tools",
    exampleParams: { query: "image" },
  },
  {
    name: "generate_image",
    exampleLabel: "Generate a sunset photo",
    exampleParams: {
      prompt: "A stunning sunset over the ocean, photorealistic",
    },
  },
  {
    name: "get_ai_response",
    exampleLabel: "Ask the AI anything",
    exampleParams: { prompt: "What is the MCP protocol?" },
  },
  {
    name: "list_tools",
    exampleLabel: "List all available tools",
    exampleParams: {},
  },
  {
    name: "create_codespace",
    exampleLabel: "Create a React component",
    exampleParams: { template: "react-ts" },
  },
  {
    name: "get_platform_info",
    exampleLabel: "Get platform info",
    exampleParams: {},
  },
];

interface QuickRunState {
  response: unknown;
  error: string | null;
  isExecuting: boolean;
}

function FeaturedCard({
  tool,
  def,
  onTryIt,
}: {
  tool: McpToolDef;
  def: FeaturedDef;
  onTryIt: (tool: McpToolDef) => void;
}) {
  const [state, setState] = useState<QuickRunState>({
    response: null,
    error: null,
    isExecuting: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const handleQuickRun = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ response: null, error: null, isExecuting: true });

    try {
      const res = await fetch("/api/mcp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.name, params: def.exampleParams }),
        signal: controller.signal,
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg = typeof data === "object" && data !== null && "error" in data
          ? String((data as Record<string, unknown>).error)
          : `HTTP ${res.status}`;
        setState({ response: null, error: msg, isExecuting: false });
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
  }, [tool.name, def.exampleParams]);

  const Renderer = getToolRenderer(tool.name);
  let resultString = "";
  if (state.response) {
    if (typeof state.response === "string") {
      resultString = state.response;
    } else if (typeof state.response === "object" && state.response !== null) {
      const resObj = state.response as {
        result?: { content?: { type?: string; text?: string; }[]; };
        content?: { type?: string; text?: string; }[];
      };
      const contentArray = resObj.content || resObj.result?.content;
      const textContent = contentArray?.find(c => c.type === "text")?.text;
      if (typeof textContent === "string") {
        resultString = textContent;
      } else {
        resultString = JSON.stringify(state.response, null, 2);
      }
    }
  }

  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.03] hover:border-white/[0.10] transition-all flex flex-col gap-3">
      <div>
        <p className="font-mono text-sm text-white font-semibold">
          {tool.name}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
          {tool.description}
        </p>
      </div>

      <div className="rounded-xl bg-zinc-900 border border-white/[0.04] px-3 py-2">
        <p className="text-[10px] text-zinc-600 mb-1">Example</p>
        <p className="text-xs text-zinc-300 font-mono">{def.exampleLabel}</p>
      </div>

      {state.error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      {state.response !== null && (
        <div className="rounded-lg bg-black/20 border border-white/[0.04] p-2 overflow-y-auto max-h-48">
          <Renderer result={resultString} isError={false} name={tool.name} />
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={handleQuickRun}
          disabled={state.isExecuting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 disabled:opacity-50 transition-all"
        >
          {state.isExecuting
            ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running...
              </>
            )
            : (
              <>
                <Play className="w-3.5 h-3.5" />
                Quick Run
              </>
            )}
        </button>
        <button
          type="button"
          onClick={() => onTryIt(tool)}
          className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-xs hover:text-white hover:bg-white/[0.06] transition-all"
        >
          Customize
        </button>
      </div>
    </div>
  );
}

export function McpFeaturedTools({ onTryIt }: McpFeaturedToolsProps) {
  const toolMap = new Map(MCP_TOOLS.map(t => [t.name, t]));

  const featured = FEATURED_DEFS.map(def => ({
    def,
    tool: toolMap.get(def.name),
  })).filter((item): item is { def: FeaturedDef; tool: McpToolDef; } => item.tool !== undefined);

  if (featured.length === 0) return null;

  return (
    <section className="px-4 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-black text-white">Start Here</h2>
          <span className="text-zinc-600 text-sm">
            — popular tools with one-click examples
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featured.map(({ def, tool }) => (
            <FeaturedCard
              key={tool.name}
              tool={tool}
              def={def}
              onTryIt={onTryIt}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
