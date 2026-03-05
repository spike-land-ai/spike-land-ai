import { useState, useEffect } from "react";
import { Link } from "../ui/link";
import { TOTAL_TOOL_COUNT } from "./LandingHero";

export function TryItNow() {
  const [activeTab, setActiveTab] = useState<"claude-code" | "cursor" | "vscode">("claude-code");
  const [copied, setCopied] = useState(false);

  const getCommand = () => {
    switch (activeTab) {
      case "claude-code":
        return "claude mcp add spike-land --transport http https://spike.land/mcp";
      case "cursor":
        return '{ "mcpServers": { "spike-land": { "url": "https://spike.land/mcp" } } }';
      case "vscode":
        return '{ "servers": { "spike-land": { "type": "http", "url": "https://spike.land/mcp" } } }';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCommand());
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copied]);

  return (
    <section className="py-12 bg-background border-y border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
          <div className="p-6 sm:p-8 border-b border-border relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 4.238 9.617 9.634 10.828.576.106.788-.25.788-.556 0-.273-.01-1.185-.015-2.171-4.037.876-4.889-1.731-4.889-1.731-.66-1.676-1.61-2.122-1.61-2.122-1.318-.9.1-.882.1-.882 1.457.102 2.224 1.496 2.224 1.496 1.296 2.218 3.39 1.577 4.216 1.206.13-.938.533-1.577.976-1.94-3.221-.366-6.608-1.61-6.608-7.17 0-1.583.565-2.877 1.492-3.892-.15-.366-.647-1.84.142-3.838 0 0 1.217-.422 3.992 1.486 1.157-.322 2.397-.483 3.633-.488 1.235.005 2.476.166 3.635.488 2.772-1.908 3.987-1.486 3.987-1.486.791 1.998.294 3.472.144 3.838.929 1.015 1.49 2.309 1.49 3.892 0 5.574-3.393 6.801-6.624 7.16.524.452.991 1.344.991 2.709 0 1.957-.014 3.532-.014 4.012 0 .31.209.669.799.554 5.393-1.213 9.629-5.526 9.629-10.828 0-6.627-5.373-12-12-12z"/></svg>
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 text-xs font-semibold tracking-wide uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              {TOTAL_TOOL_COUNT}+ MCP Tools · Instant Access
            </div>
            
            <h2 className="text-3xl font-bold mb-3 text-foreground tracking-tight">Try spike.land in one command</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
              Connect your AI to the entire platform instantly. Zero config, no npm install required.
            </p>

            <div className="rounded-xl overflow-hidden border border-[#334155] shadow-2xl bg-[#0f172a]">
              <div className="flex overflow-x-auto border-b border-[#334155] bg-[#0f172a]">
                <button
                  onClick={() => setActiveTab("claude-code")}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === "claude-code"
                      ? "border-cyan-400 text-cyan-400 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  Claude Code
                </button>
                <button
                  onClick={() => setActiveTab("cursor")}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === "cursor"
                      ? "border-cyan-400 text-cyan-400 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  Cursor
                </button>
                <button
                  onClick={() => setActiveTab("vscode")}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === "vscode"
                      ? "border-cyan-400 text-cyan-400 bg-white/5"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  VS Code
                </button>
              </div>

              <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="font-mono text-sm overflow-x-auto w-full">
                  {activeTab === "claude-code" && (
                    <div className="flex gap-2">
                      <span className="text-cyan-400 shrink-0">$</span>
                      <span className="text-slate-200 break-all">claude mcp add spike-land --transport http https://spike.land/mcp</span>
                    </div>
                  )}
                  {activeTab === "cursor" && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs mb-1">Add to Cursor Settings → MCP</span>
                      <span className="text-slate-200 break-all">{getCommand()}</span>
                    </div>
                  )}
                  {activeTab === "vscode" && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-xs mb-1">Add to .vscode/mcp.json</span>
                      <span className="text-slate-200 break-all">{getCommand()}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors text-sm font-medium w-full sm:w-auto"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <p className="mt-4 text-center text-sm text-muted-foreground">
              This installs the spike.land CLI or configures your editor. Requires Node.js 18+.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-muted/30">
            <h3 className="font-semibold text-foreground mb-4">What happens next:</h3>
            <ol className="space-y-3 mb-8 text-muted-foreground text-sm list-decimal list-inside ml-1">
              <li>Registers spike.land as an MCP server with your AI client.</li>
              <li>First use will automatically open your browser for a quick 1-click approval.</li>
              <li>Instant access to all tools. Try asking your AI:</li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <div className="bg-background border border-border rounded-lg p-3 text-sm shadow-sm text-muted-foreground">
                "Search for code review tools"
              </div>
              <div className="bg-background border border-border rounded-lg p-3 text-sm shadow-sm text-muted-foreground">
                "Generate a chess game and challenge alice"
              </div>
              <div className="bg-background border border-border rounded-lg p-3 text-sm shadow-sm text-muted-foreground">
                "Create an AI image of a mountain at sunset"
              </div>
            </div>

            <div className="flex justify-center sm:justify-start">
              <Link href="/tools" className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-cyan-600 transition-colors">
                Browse all tools 
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
