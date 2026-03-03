import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { useTools } from "@/hooks/useTools";
import { callTool, parseToolResult, type ToolInfo, type ToolInputSchema } from "@/api/client";
import { ENHANCEMENT_COSTS } from "@/constants/enums";
import { DynamicToolForm } from "@/components/ui/DynamicToolForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalEntry =
  | { type: "welcome" }
  | { type: "command"; text: string }
  | { type: "output"; content: string }
  | { type: "json"; data: unknown }
  | { type: "error"; message: string }
  | { type: "tool-form"; tool: ToolInfo; onComplete: () => void }
  | { type: "help" };

// ---------------------------------------------------------------------------
// JSON syntax highlighter
// ---------------------------------------------------------------------------

function JsonNode({ value, indent = 0 }: { value: unknown; indent?: number }) {
  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);

  if (value === null) {
    return <span className="text-gray-500">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-emerald-400">{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-purple-400">{value}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-amber-400">"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-500">[]</span>;
    }
    return (
      <>
        <span className="text-gray-500">{"["}</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: `${(indent + 1) * 1.25}rem` }}>
            <JsonNode value={item} indent={indent + 1} />
            {i < value.length - 1 && <span className="text-gray-500">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: `${indent * 1.25}rem` }}>
          <span className="text-gray-500">{"]"}</span>
        </div>
      </>
    );
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-gray-500">{"{}"}</span>;
    }
    return (
      <>
        <span className="text-gray-500">{"{"}</span>
        {entries.map(([k, v], i) => (
          <div key={k} style={{ paddingLeft: `${(indent + 1) * 1.25}rem` }}>
            <span className="text-sky-400">"{k}"</span>
            <span className="text-gray-500">: </span>
            <JsonNode value={v} indent={indent + 1} />
            {i < entries.length - 1 && <span className="text-gray-500">,</span>}
          </div>
        ))}
        <div style={{ paddingLeft: `${indent * 1.25}rem` }}>
          <span className="text-gray-500">{"}"}</span>
        </div>
      </>
    );
  }

  // fallback for undefined, symbol, function, etc.
  return <span className="text-gray-500">{String(value)}</span>;
}

// ---------------------------------------------------------------------------
// Entry renderers
// ---------------------------------------------------------------------------

function WelcomeEntry() {
  return (
    <div className="text-emerald-400 text-xs leading-tight select-none mb-1">
      <pre className="font-mono whitespace-pre">{` ____  _          _   ____  _             _ _
|  _ \\(_)_  _____| | / ___|| |_ _   _  __| (_) ___
| |_) | \\ \\/ / _ \\ | \\___ \\| __| | | |/ _\` | |/ _ \\
|  __/| |>  <  __/ |  ___) | |_| |_| | (_| | | (_) |
|_|   |_/_/\\_\\___|_| |____/ \\__|\\__,_|\\__,_|_|\\___/ `}</pre>
      <p className="text-gray-500 mt-2 text-xs">
        Type <span className="text-gray-300">'help'</span> for commands, or enter a tool name to get
        started.
      </p>
    </div>
  );
}

function HelpEntry() {
  const commands = [
    { cmd: "help", desc: "Show this help message" },
    { cmd: "tools", desc: "List all tools grouped by category" },
    { cmd: "tools <category>", desc: "Filter tools by category" },
    { cmd: "<tool_name>", desc: "Open interactive form for that tool" },
    { cmd: "credits", desc: "Check your credit balance" },
    { cmd: "history", desc: "Show command history" },
    { cmd: "clear", desc: "Clear the terminal" },
  ];
  return (
    <div className="text-xs space-y-0.5">
      <p className="text-gray-400 mb-2 font-semibold">Available commands:</p>
      {commands.map(({ cmd, desc }) => (
        <div key={cmd} className="flex gap-4">
          <span className="text-emerald-400 w-40 shrink-0">{cmd}</span>
          <span className="text-gray-400">{desc}</span>
        </div>
      ))}
    </div>
  );
}

function CommandEntry({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs select-none">
      <span className="text-emerald-400 font-semibold shrink-0">pixel&gt;</span>
      <span className="text-gray-100">{text}</span>
    </div>
  );
}

function OutputEntry({ content }: { content: string }) {
  return (
    <pre className="text-gray-300 text-xs whitespace-pre-wrap break-words leading-relaxed">
      {content}
    </pre>
  );
}

function JsonEntry({ data }: { data: unknown }) {
  return (
    <div className="text-xs font-mono leading-relaxed">
      <JsonNode value={data} />
    </div>
  );
}

function ErrorEntry({ message }: { message: string }) {
  return (
    <p className="text-red-400 text-xs">
      <span className="font-semibold">error: </span>
      {message}
    </p>
  );
}

interface ToolFormEntryProps {
  tool: ToolInfo;
  onComplete: () => void;
  onResult: (data: unknown) => void;
  onError: (msg: string) => void;
}

function ToolFormEntry({ tool, onComplete, onResult, onError }: ToolFormEntryProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const creditCost = (() => {
    const tier = tool.tier as keyof typeof ENHANCEMENT_COSTS | undefined;
    if (tier && tier in ENHANCEMENT_COSTS) return ENHANCEMENT_COSTS[tier];
    return undefined;
  })();

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setLoading(true);
      try {
        const result = await callTool(tool.name, values);
        const parsed = parseToolResult<unknown>(result);
        onResult(parsed);
        setDone(true);
        onComplete();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Tool call failed");
        setDone(true);
        onComplete();
      } finally {
        setLoading(false);
      }
    },
    [tool.name, onResult, onError, onComplete],
  );

  if (done) return null;

  const schema: ToolInputSchema = tool.inputSchema ?? {
    type: "object",
    properties: {},
    required: [],
  };

  return (
    <div className="border border-gray-800 rounded-lg p-3 bg-gray-900/50 text-xs space-y-2">
      <div>
        <span className="text-sky-400 font-semibold">{tool.name}</span>
        <span className="text-gray-500 ml-2">{tool.description}</span>
      </div>
      <DynamicToolForm
        schema={schema}
        toolName={tool.name}
        creditCost={creditCost}
        onSubmit={handleSubmit}
        loading={loading}
        compact={true}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PixelTerminal() {
  const { tools, byName, grouped, categories, loading: toolsLoading } = useTools();

  const [entries, setEntries] = useState<TerminalEntry[]>([{ type: "welcome" }]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pushEntries = useCallback((...next: TerminalEntry[]) => {
    setEntries((prev) => [...prev, ...next]);
  }, []);

  const handleToolResult = useCallback((data: unknown) => {
    setEntries((prev) => [...prev, { type: "json", data }]);
  }, []);

  const handleToolError = useCallback((msg: string) => {
    setEntries((prev) => [...prev, { type: "error", message: msg }]);
  }, []);

  const noopComplete = useCallback(() => {
    // no-op: result is pushed separately via handleToolResult/handleToolError
  }, []);

  const runCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Record history
      setCommandHistory((prev) => [trimmed, ...prev]);
      setHistoryIndex(-1);

      // Echo the command
      const commandEntry: TerminalEntry = { type: "command", text: trimmed };

      if (trimmed === "clear") {
        setEntries([{ type: "welcome" }]);
        return;
      }

      if (trimmed === "help") {
        pushEntries(commandEntry, { type: "help" });
        return;
      }

      if (trimmed === "history") {
        const lines =
          commandHistory.length === 0
            ? "No history yet."
            : commandHistory.map((c, i) => `  ${i + 1}  ${c}`).join("\n");
        pushEntries(commandEntry, { type: "output", content: lines });
        return;
      }

      if (trimmed === "credits") {
        pushEntries(commandEntry, { type: "output", content: "Fetching credits..." });
        try {
          const result = await callTool("img_credits", {});
          const parsed = parseToolResult<unknown>(result);
          setEntries((prev) => [
            ...prev.slice(0, -1), // remove "Fetching credits..."
            { type: "json", data: parsed },
          ]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch credits";
          setEntries((prev) => [...prev.slice(0, -1), { type: "error", message: msg }]);
        }
        return;
      }

      // tools [<category>]
      if (trimmed === "tools" || trimmed.startsWith("tools ")) {
        const filterArg = trimmed.startsWith("tools ") ? trimmed.slice(6).trim() : "";

        if (toolsLoading) {
          pushEntries(commandEntry, { type: "output", content: "Tools are still loading..." });
          return;
        }

        const lines: string[] = [];

        if (filterArg) {
          const lowerFilter = filterArg.toLowerCase();
          const matchedCats = categories.filter((c) => c.toLowerCase().includes(lowerFilter));

          if (matchedCats.length === 0) {
            pushEntries(commandEntry, {
              type: "error",
              message: `No category matching "${filterArg}". Available: ${categories.join(", ")}`,
            });
            return;
          }

          for (const cat of matchedCats) {
            lines.push(`\n[${cat}]`);
            for (const tool of grouped.get(cat) ?? []) {
              const cost =
                tool.tier in ENHANCEMENT_COSTS
                  ? ` (${ENHANCEMENT_COSTS[tool.tier as keyof typeof ENHANCEMENT_COSTS]} cr)`
                  : "";
              lines.push(`  ${tool.name.padEnd(32)}${tool.description}${cost}`);
            }
          }
        } else {
          for (const cat of categories) {
            lines.push(`\n[${cat}]`);
            for (const tool of grouped.get(cat) ?? []) {
              const cost =
                tool.tier in ENHANCEMENT_COSTS
                  ? ` (${ENHANCEMENT_COSTS[tool.tier as keyof typeof ENHANCEMENT_COSTS]} cr)`
                  : "";
              lines.push(`  ${tool.name.padEnd(32)}${tool.description}${cost}`);
            }
          }
          lines.push(`\n${tools.length} tools across ${categories.length} categories.`);
        }

        pushEntries(commandEntry, { type: "output", content: lines.join("\n").trimStart() });
        return;
      }

      // Exact tool name match
      const matchedTool = byName.get(trimmed);
      if (matchedTool) {
        const formEntry: TerminalEntry = {
          type: "tool-form",
          tool: matchedTool,
          onComplete: noopComplete,
        };
        pushEntries(commandEntry, formEntry);
        return;
      }

      // Unknown command
      pushEntries(commandEntry, {
        type: "error",
        message: `Unknown command: "${trimmed}". Type 'help' for a list of commands.`,
      });
    },
    [
      byName,
      categories,
      commandHistory,
      grouped,
      noopComplete,
      pushEntries,
      tools.length,
      toolsLoading,
    ],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const value = input;
        setInput("");
        void runCommand(value);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (!input.trim()) return;

        const partial = input.trim().toLowerCase();
        const matches = tools.filter((t) => t.name.startsWith(partial));

        if (matches.length === 1) {
          setInput(matches[0].name);
        } else if (matches.length > 1) {
          pushEntries(
            { type: "command", text: input },
            {
              type: "output",
              content: matches.map((t) => t.name).join("  "),
            },
          );
          // Find longest common prefix
          const names = matches.map((t) => t.name);
          let prefix = names[0];
          for (const name of names.slice(1)) {
            let i = 0;
            while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
            prefix = prefix.slice(0, i);
          }
          if (prefix.length > partial.length) setInput(prefix);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const next = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(next);
        setInput(commandHistory[next] ?? "");
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setInput("");
          return;
        }
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(commandHistory[next] ?? "");
        return;
      }
    },
    [commandHistory, historyIndex, input, pushEntries, runCommand, tools],
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="h-full flex flex-col bg-gray-950 rounded-xl border border-gray-800 overflow-hidden font-mono cursor-text"
      onClick={focusInput}
      role="application"
      aria-label="Pixel Studio terminal"
    >
      {/* Terminal header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0 select-none">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-gray-500 ml-2">image-studio — terminal</span>
        {toolsLoading && (
          <span className="ml-auto text-xs text-gray-600 animate-pulse">loading tools...</span>
        )}
      </div>

      {/* Scrollable output area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {entries.map((entry, i) => {
          switch (entry.type) {
            case "welcome":
              return <WelcomeEntry key={i} />;
            case "help":
              return <HelpEntry key={i} />;
            case "command":
              return <CommandEntry key={i} text={entry.text} />;
            case "output":
              return <OutputEntry key={i} content={entry.content} />;
            case "json":
              return <JsonEntry key={i} data={entry.data} />;
            case "error":
              return <ErrorEntry key={i} message={entry.message} />;
            case "tool-form":
              return (
                <ToolFormEntry
                  key={i}
                  tool={entry.tool}
                  onComplete={entry.onComplete}
                  onResult={handleToolResult}
                  onError={handleToolError}
                />
              );
          }
        })}
        {/* Scroll anchor */}
        <div ref={scrollRef} />
      </div>

      {/* Input row */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-emerald-400 text-sm font-semibold shrink-0 select-none">
          pixel&gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-gray-100 text-sm outline-none placeholder:text-gray-700 caret-emerald-400"
          placeholder="type a command or tool name…"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Terminal input"
        />
      </div>
    </div>
  );
}
