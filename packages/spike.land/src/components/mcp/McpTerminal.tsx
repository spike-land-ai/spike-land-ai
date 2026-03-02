"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MCP_CATEGORIES,
  MCP_SUPER_CATEGORIES,
  MCP_TOOLS,
} from "@/components/mcp/mcp-tool-registry";
import { McpImagePreview } from "@/components/mcp/McpImagePreview";
import { TerminalShell } from "@/components/mcp/terminal-shell";
import { PROMPT, welcomeBanner } from "@/components/mcp/terminal-formatter";

// ── Types for xterm (loaded dynamically) ─────────────────────────────
type XTerminal = import("@xterm/xterm").Terminal;
type XFitAddon = import("@xterm/addon-fit").FitAddon;

interface McpTerminalProps {
  /** Called externally when sidebar tool is clicked */
  onToolSelected?: string | null;
}

export function McpTerminal({ onToolSelected }: McpTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<XFitAddon | null>(null);
  const shellRef = useRef<TerminalShell | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // ── Initialize xterm.js ──────────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);

      // Also load the CSS
      await import("@xterm/xterm/css/xterm.css");

      if (disposed) return;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
        fontSize: 14,
        lineHeight: 1.4,
        theme: {
          background: "#0a0f1a",
          foreground: "#cbd5e1",
          cursor: "#10b981",
          cursorAccent: "#0a0f1a",
          selectionBackground: "#334155",
          selectionForeground: "#f8fafc",
          black: "#1e293b",
          red: "#ef4444",
          green: "#10b981",
          yellow: "#f59e0b",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#f1f5f9",
          brightBlack: "#64748b",
          brightRed: "#f87171",
          brightGreen: "#34d399",
          brightYellow: "#fbbf24",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
      });

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current!);
      fitAddon.fit();

      termRef.current = term;
      fitRef.current = fitAddon;

      // Create shell
      const shell = new TerminalShell(
        {
          write: (data) => term.write(data),
          clear: () => {
            term.clear();
            term.write(PROMPT);
          },
          executeTool: async (toolName, params) => {
            setImageUrl(null);
            const res = await fetch("/api/mcp/proxy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tool: toolName, params }),
            });
            const data = await res.json();
            if (!res.ok) {
              const body = data as Record<string, unknown>;
              throw new Error((body.error as string) || `Request failed with status ${res.status}`);
            }
            return data;
          },
          onImageUrl: (url) => setImageUrl(url),
        },
        {
          tools: MCP_TOOLS,
          categories: MCP_CATEGORIES,
          superCategories: MCP_SUPER_CATEGORIES,
        },
      );

      shellRef.current = shell;

      // Write welcome banner + prompt
      term.write(welcomeBanner());
      term.write(PROMPT);

      // Wire input
      term.onData((data) => shell.handleInput(data));

      setLoaded(true);
    }

    init();

    return () => {
      disposed = true;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      shellRef.current = null;
    };
  }, []);

  // ── Handle resize ────────────────────────────────────────────────
  useEffect(() => {
    if (!fitRef.current) return;

    const fit = fitRef.current;
    const handleResize = () => fit.fit();

    window.addEventListener("resize", handleResize);

    // Also observe the container
    const observer = new ResizeObserver(() => fit.fit());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [loaded]);

  // ── Handle sidebar tool selection ────────────────────────────────
  // onToolSelected is "toolName:timestamp" so the effect fires on every click
  useEffect(() => {
    if (onToolSelected && shellRef.current) {
      const toolName = onToolSelected.split(":")[0]!;
      shellRef.current.injectCommand(`help ${toolName}`);
    }
  }, [onToolSelected]);

  const handleDismissImage = useCallback(() => setImageUrl(null), []);

  return (
    <div className="space-y-0">
      {/* Terminal window */}
      <div className="glass-1 glass-edge rounded-2xl overflow-hidden shadow-2xl">
        {/* macOS window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1f2e] border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="ml-4 text-xs text-gray-400 font-mono">spike.land MCP Terminal</div>
        </div>

        {/* Terminal container */}
        <div ref={containerRef} className="h-[500px] lg:h-[600px] bg-[#0a0f1a] px-2 py-1" />
      </div>

      {/* Image preview (below terminal) */}
      <McpImagePreview url={imageUrl} onDismiss={handleDismissImage} />
    </div>
  );
}
