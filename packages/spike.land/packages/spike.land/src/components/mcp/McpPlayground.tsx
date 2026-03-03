"use client";

import { useCallback, useState } from "react";

import type { McpToolDef } from "@/components/mcp/mcp-tool-registry";
import { McpTerminal } from "@/components/mcp/McpTerminal";
import { McpToolSidebar } from "@/components/mcp/McpToolSidebar";

interface McpPlaygroundProps {
  initialCategory?: string;
}

export function McpPlayground({ initialCategory }: McpPlaygroundProps) {
  const [selectedTool, setSelectedTool] = useState<McpToolDef | null>(null);
  // Track the tool name + a counter so repeated clicks on the same tool still trigger
  const [terminalToolCmd, setTerminalToolCmd] = useState<string | null>(null);

  const handleSelectTool = useCallback((tool: McpToolDef) => {
    setSelectedTool(tool);
    // Use a unique key to ensure the effect fires even for the same tool
    setTerminalToolCmd(tool.name + ":" + Date.now());
  }, []);

  return (
    <section className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">
        Interactive Playground
      </h2>
      <div className="flex flex-col lg:flex-row gap-6">
        <McpToolSidebar
          selectedTool={selectedTool}
          onSelectTool={handleSelectTool}
          initialCategory={initialCategory}
        />
        <div className="flex-1 min-w-0">
          <McpTerminal onToolSelected={terminalToolCmd} />
        </div>
      </div>
    </section>
  );
}
