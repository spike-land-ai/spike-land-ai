import { useState, useCallback } from "react";
import { Terminal, Play, Loader2, ChevronRight } from "lucide-react";
import { resolveMcpCommandLine } from "./mcp-command-line";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface TerminalSurfaceProps {
  appSlug: string;
  availableTools?: string[];
  className?: string;
}

export function TerminalSurface({ appSlug, availableTools = [], className = "" }: TerminalSurfaceProps) {
  const [history, setHistory] = useState<Array<{
    command: string;
    tool: string;
    input: Record<string, unknown>;
    output: string;
    isError: boolean;
    timestamp: number;
  }>>([]);
  const [commandInput, setCommandInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const commandExamples = getCommandExamples(availableTools);

  const executeTool = useCallback(async () => {
    const command = commandInput.trim();
    if (!command || isRunning) return;

    setIsRunning(true);

    const resolved = resolveMcpCommandLine(command);
    if (!resolved) {
      setHistory((prev) => [
        ...prev,
        {
          command,
          tool: "unknown",
          input: {},
          output:
            "Unsupported command. Use a shell-style alias like `open https://...` or call a tool directly with `tool_name --flag value`.",
          isError: true,
          timestamp: Date.now(),
        },
      ]);
      setIsRunning(false);
      return;
    }

    const entry = {
      command,
      tool: resolved.toolName,
      input: resolved.args,
      output: "",
      isError: false,
      timestamp: Date.now(),
    };

    try {
      const res = await fetch("/mcp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: resolved.toolName, arguments: resolved.args },
          id: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        entry.output = JSON.stringify(data.error, null, 2);
        entry.isError = true;
      } else {
        const result = data.result as ToolResult;
        entry.output = result.content?.map((c: { text: string }) => c.text).join("\n") || JSON.stringify(result, null, 2);
        entry.isError = !!result.isError;
      }
    } catch (err) {
      entry.output = err instanceof Error ? err.message : "Execution failed";
      entry.isError = true;
    }

    setHistory((prev) => [...prev, entry]);
    setIsRunning(false);
  }, [commandInput, isRunning]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      executeTool();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Terminal &mdash; {appSlug}</span>
      </div>

      {/* Output history */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-4">
        {history.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Select a tool and execute it. Results appear here.
          </p>
        )}
        {history.map((entry, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-1 text-primary">
              <ChevronRight className="w-3 h-3" />
              <span className="font-bold">$ {entry.command}</span>
              <span className="text-muted-foreground text-xs ml-2">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground pl-4 truncate">
              {entry.tool} {JSON.stringify(entry.input)}
            </div>
            <pre
              className={`pl-4 whitespace-pre-wrap text-xs ${
                entry.isError ? "text-destructive" : "text-foreground/80"
              }`}
            >
              {entry.output}
            </pre>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 space-y-2">
        <textarea
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="open https://spike.land"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2
                     font-mono text-xs placeholder:text-muted-foreground
                     focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground">
            Cmd+Enter to execute. Use `tool_name --flag value` or shell aliases.
          </p>
          <button
            onClick={executeTool}
            disabled={!commandInput.trim() || isRunning}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-primary-foreground
                       disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-1"
            aria-label="Execute command"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run
          </button>
        </div>
        {commandExamples.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {commandExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setCommandInput(example)}
                className="rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getCommandExamples(availableTools: string[]): string[] {
  const examples: string[] = [];

  if (availableTools.includes("web_navigate")) examples.push("open https://spike.land");
  if (availableTools.includes("web_read")) examples.push("read main");
  if (availableTools.includes("web_click")) examples.push("click 12");
  if (availableTools.includes("web_type")) examples.push('type 4 "hello world"');

  const directTool = availableTools.find((tool) => tool.includes("_"));
  if (directTool) {
    examples.push(`${directTool} --flag value`);
  }

  return examples.slice(0, 5);
}
