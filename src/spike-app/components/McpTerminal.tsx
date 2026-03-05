import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { mcpUrl } from "@/lib/api";

interface McpTerminalProps {
  appId?: string;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema?: { properties?: Record<string, unknown> };
}

const PROMPT = "\x1b[36mspike.land\x1b[0m> ";

export function McpTerminal({ appId }: McpTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [tools, setTools] = useState<McpTool[]>([]);

  const fetchTools = useCallback(async (): Promise<McpTool[]> => {
    try {
      const res = await fetch(mcpUrl("/tools"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tools?: McpTool[] } = await res.json();
      return data.tools ?? [];
    } catch (err) {
      return [{ name: "error", description: `Failed to fetch tools: ${err}` }];
    }
  }, []);

  const callTool = useCallback(async (toolName: string, args: Record<string, unknown>) => {
    const res = await fetch(mcpUrl("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });
    return res.json();
  }, []);

  const writeOutput = useCallback((term: Terminal, text: string) => {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      term.write(line);
      if (i < lines.length - 1) term.write("\r\n");
    }
    term.write("\r\n");
  }, []);

  const handleCommand = useCallback(async (term: Terminal, input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      term.write(PROMPT);
      return;
    }

    historyRef.current.unshift(trimmed);
    historyIndexRef.current = -1;

    if (trimmed === "help") {
      writeOutput(term, [
        "\x1b[1mAvailable commands:\x1b[0m",
        "  \x1b[33mtools\x1b[0m              List available MCP tools",
        "  \x1b[33mcall\x1b[0m <tool> [json]  Call an MCP tool with optional JSON args",
        "  \x1b[33mhelp\x1b[0m               Show this help message",
        "  \x1b[33mclear\x1b[0m              Clear the terminal",
      ].join("\r\n"));
      term.write(PROMPT);
      return;
    }

    if (trimmed === "clear") {
      term.clear();
      term.write(PROMPT);
      return;
    }

    if (trimmed === "tools") {
      term.write("\x1b[2mFetching tools...\x1b[0m\r\n");
      const fetched = await fetchTools();
      setTools(fetched);

      // Group by package prefix if appId provided
      const filtered = appId
        ? fetched.filter((t) => t.name.startsWith(appId.replace(/-/g, "_")))
        : fetched;

      if (filtered.length === 0 && appId) {
        writeOutput(term, `\x1b[33mNo tools found for ${appId}. Showing all ${fetched.length} tools:\x1b[0m`);
        for (const tool of fetched.slice(0, 30)) {
          writeOutput(term, `  \x1b[32m${tool.name}\x1b[0m  ${tool.description.slice(0, 60)}`);
        }
        if (fetched.length > 30) {
          writeOutput(term, `  ... and ${fetched.length - 30} more (type "tools" without filter to see all)`);
        }
      } else {
        writeOutput(term, `\x1b[1m${filtered.length} tool${filtered.length === 1 ? "" : "s"} available:\x1b[0m`);
        for (const tool of filtered) {
          const paramCount = tool.inputSchema?.properties
            ? Object.keys(tool.inputSchema.properties).length
            : 0;
          writeOutput(term, `  \x1b[32m${tool.name}\x1b[0m (${paramCount} params)  ${tool.description.slice(0, 50)}`);
        }
      }
      term.write(PROMPT);
      return;
    }

    if (trimmed.startsWith("call ")) {
      const rest = trimmed.slice(5).trim();
      const spaceIdx = rest.indexOf(" ");
      const toolName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
      let args: Record<string, unknown> = {};

      if (spaceIdx !== -1) {
        const jsonStr = rest.slice(spaceIdx + 1).trim();
        try {
          args = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          writeOutput(term, `\x1b[31mInvalid JSON: ${jsonStr}\x1b[0m`);
          term.write(PROMPT);
          return;
        }
      }

      term.write(`\x1b[2mCalling ${toolName}...\x1b[0m\r\n`);
      try {
        const result: unknown = await callTool(toolName, args);
        writeOutput(term, `\x1b[32m${JSON.stringify(result, null, 2)}\x1b[0m`);
      } catch (err) {
        writeOutput(term, `\x1b[31mError: ${err}\x1b[0m`);
      }
      term.write(PROMPT);
      return;
    }

    writeOutput(term, `\x1b[31mUnknown command: ${trimmed}\x1b[0m. Type \x1b[33mhelp\x1b[0m for usage.`);
    term.write(PROMPT);
  }, [appId, fetchTools, callTool, writeOutput]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        cursor: "#38bdf8",
        selectionBackground: "#334155",
        black: "#0f172a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e2e8f0",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message
    term.writeln("\x1b[1;36m  spike.land MCP Terminal\x1b[0m");
    term.writeln("\x1b[2m  Type \"help\" for commands, \"tools\" to list available MCP tools\x1b[0m");
    if (appId) {
      term.writeln(`\x1b[2m  Filtered to: ${appId}\x1b[0m`);
    }
    term.writeln("");
    term.write(PROMPT);

    // Input handling
    term.onData((data) => {
      const code = data.charCodeAt(0);

      if (data === "\r") {
        // Enter
        term.write("\r\n");
        const cmd = lineBufferRef.current;
        lineBufferRef.current = "";
        handleCommand(term, cmd);
      } else if (code === 127 || data === "\b") {
        // Backspace
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\x1b[A") {
        // Up arrow — history
        if (historyRef.current.length > 0) {
          const newIdx = Math.min(historyIndexRef.current + 1, historyRef.current.length - 1);
          historyIndexRef.current = newIdx;
          // Clear current line
          while (lineBufferRef.current.length > 0) {
            term.write("\b \b");
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
          const histLine = historyRef.current[newIdx] ?? "";
          lineBufferRef.current = histLine;
          term.write(histLine);
        }
      } else if (data === "\x1b[B") {
        // Down arrow — history
        while (lineBufferRef.current.length > 0) {
          term.write("\b \b");
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        }
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const histLine = historyRef.current[historyIndexRef.current] ?? "";
          lineBufferRef.current = histLine;
          term.write(histLine);
        } else {
          historyIndexRef.current = -1;
        }
      } else if (code === 3) {
        // Ctrl+C
        lineBufferRef.current = "";
        term.write("^C\r\n");
        term.write(PROMPT);
      } else if (code >= 32) {
        // Printable characters
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [appId, handleCommand]);

  return (
    <div className="flex h-full min-h-[400px] flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <div className="h-3 w-3 rounded-full bg-warning" />
            <div className="h-3 w-3 rounded-full bg-success" />
          </div>
          <span className="ml-2 text-xs text-muted-foreground">
            MCP Terminal {appId ? `— ${appId}` : ""}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {tools.length > 0 ? `${tools.length} tools loaded` : ""}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 bg-[#0f172a]" />
    </div>
  );
}

export type { McpTerminalProps };
