"use client";

import { useCallback, useEffect, useState } from "react";
import { useInViewProgress } from "./useInViewProgress";

interface TabData {
  label: string;
  request: string;
  response: string;
}

const T = (l: string, req: object, res: object): TabData => ({
  label: l,
  request: JSON.stringify(req, null, 2),
  response: JSON.stringify(res, null, 2),
});

const TABS: TabData[] = [
  T(
    "search_tools",
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "search_tools", arguments: { query: "chess" } },
    },
    {
      result: {
        tools: ["chess_new_game", "chess_send_challenge", "chess_get_board"],
        total: 3,
      },
    },
  ),
  T(
    "chess_send_challenge",
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "chess_send_challenge",
        arguments: { opponent: "alice", timeControl: "5+0" },
      },
    },
    {
      result: { challengeId: "ch_7x9k2m", status: "pending", expiresIn: 300 },
    },
  ),
  T(
    "gallery_showcase",
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "gallery_showcase",
        arguments: { theme: "minimalist", limit: 6 },
      },
    },
    { result: { items: 6, layout: "grid", generated: true } },
  ),
];

// Inline syntax highlighter — no external deps
function highlight(raw: string): React.ReactNode[] {
  const KEY = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)/;
  const STR = /^(\s*)("(?:[^"\\]|\\.)*")/;
  const NUM = /^(\s*)(-?\d+(?:\.\d+)?)/;
  const BOOL = /^(\s*)(true|false|null)/;
  const PUNC = /^(\s*[{}[\],])/;
  const WS = /^(\s+)/;

  return raw.split("\n").map((line, li) => {
    const nodes: React.ReactNode[] = [];
    let rest = line;
    let i = 0;
    while (rest.length > 0) {
      let m: RegExpExecArray | null;
      if ((m = KEY.exec(rest))) {
        nodes.push(
          m[1],
          <span key={`k${li}${i++}`} className="text-primary">
            {m[2]}
          </span>,
          <span key={`p${li}${i++}`} className="text-muted-foreground">
            {m[3]}
          </span>,
        );
      } else if ((m = STR.exec(rest))) {
        nodes.push(
          m[1],
          <span key={`s${li}${i++}`} className="text-green-400">
            {m[2]}
          </span>,
        );
      } else if ((m = NUM.exec(rest))) {
        nodes.push(
          m[1],
          <span key={`n${li}${i++}`} className="text-yellow-400">
            {m[2]}
          </span>,
        );
      } else if ((m = BOOL.exec(rest))) {
        nodes.push(
          m[1],
          <span key={`b${li}${i++}`} className="text-yellow-300">
            {m[2]}
          </span>,
        );
      } else if ((m = PUNC.exec(rest))) {
        nodes.push(
          <span key={`br${li}${i++}`} className="text-muted-foreground">
            {m[1]}
          </span>,
        );
      } else if ((m = WS.exec(rest))) nodes.push(m[1]);
      else {
        nodes.push(rest[0]);
        rest = rest.slice(1);
        continue;
      }
      rest = rest.slice(m[0].length);
    }
    return (
      <span key={`l${li}`} className="block">
        {nodes}
        {"\n"}
      </span>
    );
  });
}

export function MCPTerminalDemo() {
  const { ref, progress } = useInViewProgress();
  const [activeTab, setActiveTab] = useState(0);
  const [typed, setTyped] = useState("");
  const [showResp, setShowResp] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);

  const tab = TABS[activeTab]!;

  const startAnimation = useCallback(() => {
    setTyped("");
    setShowResp(false);
    setPlaying(true);
    setStarted(true);
    setPaused(false);
  }, []);

  const resetTab = useCallback((i: number) => {
    setActiveTab(i);
    setTyped("");
    setShowResp(false);
    setPlaying(false);
    setStarted(false);
  }, []);

  // Auto-start on scroll into view
  useEffect(() => {
    if (progress > 0.3 && !started && !paused) startAnimation();
  }, [progress, started, paused, startAnimation]);

  // Typewriter
  useEffect(() => {
    if (!playing || paused) return undefined;
    const target = tab.request;
    if (typed.length >= target.length) {
      setPlaying(false);
      const t = setTimeout(() => setShowResp(true), 400);
      return () => clearTimeout(t);
    }
    const iv = setInterval(() => setTyped((p) => target.slice(0, p.length + 1)), 30);
    return () => clearInterval(iv);
  }, [playing, paused, typed, tab.request]);

  const isDone = typed.length >= tab.request.length;

  return (
    <div ref={ref} className="my-8 flex flex-col gap-3">
      <div
        className="rounded-xl overflow-hidden border border-border bg-card font-mono text-sm shadow-2xl"
        onMouseEnter={() => {
          if (playing) setPaused(true);
        }}
        onMouseLeave={() => {
          if (paused) setPaused(false);
        }}
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
          <span className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" aria-hidden="true" />
          <span className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
          <span className="ml-3 text-xs text-muted-foreground tracking-wide">MCP JSON-RPC</span>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => resetTab(i)}
              className={[
                "px-4 py-2 text-xs tracking-wide transition-colors border-b-2 focus:outline-none focus:ring-2 focus:ring-primary",
                i === activeTab
                  ? "text-primary border-primary bg-card"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 min-h-72 flex flex-col gap-5">
          {/* Request */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Request</div>
            <div className="text-foreground whitespace-pre leading-relaxed">
              {highlight(typed)}
              {playing && !paused && (
                <span
                  className="inline-block w-0.5 h-[1em] bg-primary align-text-bottom animate-pulse"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Response */}
          <div
            aria-live="polite"
            style={{
              opacity: showResp ? 1 : 0,
              transform: showResp ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}
          >
            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">
              Response
            </div>
            <div className="text-foreground whitespace-pre leading-relaxed">
              {highlight(tab.response)}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={startAnimation}
              aria-label={isDone ? "Replay animation" : "Play animation"}
              className="px-4 py-1.5 rounded-full bg-muted/50 border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isDone ? "Replay" : "Play"}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground italic font-mono">
        Click a tab to switch examples. Hover to pause the typewriter effect.
      </p>
    </div>
  );
}
