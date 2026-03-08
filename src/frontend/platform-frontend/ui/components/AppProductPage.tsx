import {
  Shield,
  Zap,
  Layout,
  CheckCircle,
  Terminal,
  Package,
  Globe,
  Cpu,
  Github,
  ChevronRight,
} from "lucide-react";
import { Button } from "../shared/ui/button";

import { Link } from "@tanstack/react-router";

interface AppProductPageProps {
  appId: string;
}

const CAPABILITY_ICONS = [Shield, Zap, Layout, CheckCircle, Terminal, Globe, Cpu];

const toolMetadata: Record<
  string,
  {
    name: string;
    description: string;
    capabilities: string[];
    toolNames: string[];
    packagePath: string;
  }
> = {
  "chess-engine": {
    name: "Chess Engine",
    description:
      "ELO-rated chess engine with game, player, and challenge management. Create games, make moves, query boards, track ratings, and manage tournaments — all via MCP tools.",
    capabilities: [
      "Game lifecycle management (create, move, resign, draw)",
      "ELO rating system with player tracking",
      "Challenge management for matchmaking",
      "Board state queries in FEN/PGN format",
      "Tournament and leaderboard support",
    ],
    toolNames: ["create_game", "make_move", "get_board", "get_player", "create_challenge"],
    packagePath: "src/chess-engine",
  },
  "qa-studio": {
    name: "QA Studio",
    description:
      "Browser automation utilities powered by Playwright. Navigate, click, type, capture screenshots, and automate browser workflows visually or through MCP tool calls.",
    capabilities: [
      "Visual Web UI without registration",
      "Screen-reader style narration of web pages",
      "Page interaction automation (click, type, navigate)",
      "Screenshot capture and element inspection",
      "Form extraction and tab management",
    ],
    toolNames: [
      "web_navigate",
      "web_read",
      "web_click",
      "web_type",
      "web_select",
      "web_press",
      "web_scroll",
      "web_tabs",
      "web_screenshot",
      "web_forms",
    ],
    packagePath: "src/qa-studio",
  },
  "audio-mixer": {
    name: "Audio Mixer",
    description:
      "Audio track creation and effects processing via MCP. Create tracks, apply effects, mix channels, and export audio programmatically.",
    capabilities: [
      "Multi-track audio creation and mixing",
      "Real-time effects and filter application",
      "Channel volume and pan control",
      "Audio export in multiple formats",
      "Effect chain management",
    ],
    toolNames: ["create_track", "apply_effect", "mix_channels", "export_audio"],
    packagePath: "src/audio-mixer",
  },
};

export function AppProductPage({ appId }: AppProductPageProps) {
  const meta = toolMetadata[appId] ?? {
    name: appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description:
      "An MCP tool package on the Spike Land platform. Use the Terminal tab to interact with its tools.",
    capabilities: [
      "MCP-compatible tool interface",
      "JSON-RPC invocation via spike-edge",
      "Zod-validated input schemas",
      "Structured output responses",
    ],
    toolNames: [],
    packagePath: `src/${appId}`,
  };

  return (
    <div className="flex flex-col space-y-12 p-6 lg:p-16 max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
        <Link to="/packages" className="hover:text-primary transition-colors">
          Packages
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground/70">{meta.name}</span>
      </nav>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-primary border border-primary/10">
            <Terminal className="h-3.5 w-3.5" />
            <span>MCP Tool Package</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-foreground leading-[0.9]">
            {meta.name}
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
            {meta.description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
          <Button
            size="lg"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("change-tab", { detail: "Terminal" }));
            }}
            className="rounded-2xl h-14 px-8 text-lg font-bold shadow-xl shadow-primary/20"
          >
            <Terminal className="mr-2 h-5 w-5" />
            Open Terminal
          </Button>
          {appId === "qa-studio" && (
            <Button
              variant="outline"
              size="lg"
              asChild
              className="rounded-2xl h-14 px-8 text-lg font-bold"
            >
              <Link to="/packages/qa-studio/ui">
                <Layout className="mr-2 h-5 w-5" />
                Launch UI
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tools Section */}
      {meta.toolNames.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
              Available Tool Methods
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {meta.toolNames.map((name) => (
              <code
                key={name}
                className="rounded-xl bg-muted/50 border border-border px-4 py-2 text-sm font-mono text-foreground hover:border-primary/30 transition-colors cursor-default"
              >
                {name}()
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-12 lg:grid-cols-3">
        {/* Capabilities Column */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-black tracking-tight">Capabilities</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {meta.capabilities.map((capability, i) => {
              const Icon = CAPABILITY_ICONS[i % CAPABILITY_ICONS.length]!;
              return (
                <div
                  key={i}
                  className="group flex items-start gap-4 rounded-3xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/20"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                    {capability}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="rounded-3xl border border-border bg-muted/30 p-8 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground/40">
              Technical Details
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                  Package
                </span>
                <div className="flex items-center gap-2 text-sm font-mono text-foreground break-all">
                  <Package className="size-3.5 text-primary" />
                  @spike-land-ai/{appId}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                  Source Path
                </span>
                <div className="flex items-center gap-2 text-sm font-mono text-foreground break-all">
                  <Github className="size-3.5 text-primary" />
                  {meta.packagePath}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                  Architecture
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Globe className="size-3.5 text-primary" />
                  MCP Edge Module
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                  Runtime
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Cpu className="size-3.5 text-primary" />
                  Cloudflare Workers
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full rounded-2xl font-bold" asChild>
              <a
                href={`https://github.com/spike-land-ai/spike-land-ai/tree/main/${meta.packagePath}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 size-4" />
                View Source
              </a>
            </Button>
          </div>

          <div className="rounded-3xl border border-primary/10 bg-primary/5 p-8 text-center space-y-4">
            <div className="bg-primary/10 size-12 rounded-2xl flex items-center justify-center mx-auto text-primary">
              <Zap className="size-6" />
            </div>
            <h4 className="text-sm font-bold text-primary">Need customization?</h4>
            <p className="text-xs text-primary/60 leading-relaxed">
              This package is open source. You can fork it and deploy your own version with custom
              tools.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
