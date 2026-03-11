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
      "Tool-first QA surface for Playwright-heavy teams. Navigate, inspect, capture evidence, and progressively move critical verification below the browser while keeping smoke coverage intact.",
    capabilities: [
      "Visual browser control for smoke checks and exploratory QA",
      "Screen-reader style narration and DOM inspection for faster debugging",
      "Repeatable interaction primitives (click, type, navigate, select)",
      "Screenshot capture and evidence gathering for CI and incident review",
      "A bridge into a thinner, tool-first verification stack",
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
    <div className="rubik-container rubik-page rubik-stack">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Link to="/packages" className="transition-colors hover:text-primary">
          Packages
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground/70">{meta.name}</span>
      </nav>

      {/* Header Section */}
      <section className="rubik-panel-strong flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-6">
          <div className="rubik-eyebrow">
            <Terminal className="h-3.5 w-3.5" />
            <span>MCP Tool Package</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-none tracking-[-0.06em] text-foreground sm:text-6xl">
              {meta.name}
            </h1>
            <p className="rubik-lede text-base sm:text-lg">{meta.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="rubik-chip">Cloudflare runtime</span>
            <span className="rubik-chip rubik-chip-accent">
              {meta.toolNames.length || 4} tool methods
            </span>
            <span className="rubik-chip">{meta.packagePath}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            size="lg"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("change-tab", { detail: "Terminal" }));
            }}
            className="h-12 rounded-[calc(var(--radius-control)-0.1rem)] px-6"
          >
            <Terminal className="mr-2 h-5 w-5" />
            Open Terminal
          </Button>
          {appId === "qa-studio" && (
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-12 rounded-[calc(var(--radius-control)-0.1rem)] px-6"
            >
              <Link to="/packages/qa-studio/ui">
                <Layout className="mr-2 h-5 w-5" />
                Launch UI
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Tools Section */}
      {meta.toolNames.length > 0 && (
        <section className="rubik-panel p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Available tool methods
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                Methods that define this product surface
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                The terminal, chat, and generated app layers all route into the same MCP method
                contract.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {meta.toolNames.map((name) => (
                <code
                  key={name}
                  className="rounded-2xl border border-border bg-background/80 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                >
                  {name}()
                </code>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.75fr)]">
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Capabilities
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
              Product-shaped primitives, not just raw endpoints
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {meta.capabilities.map((capability, i) => {
              const Icon = CAPABILITY_ICONS[i % CAPABILITY_ICONS.length]!;
              return (
                <div key={i} className="rubik-panel p-5">
                  <div className="flex items-start gap-4">
                    <div className="rubik-icon-badge">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{capability}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rubik-panel p-6 sm:p-7">
            <div className="space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Technical Details
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Package
                  </span>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground break-all">
                    <Package className="size-3.5 text-primary" />
                    @spike-land-ai/{appId}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Source Path
                  </span>
                  <div className="flex items-center gap-2 text-sm font-mono text-foreground break-all">
                    <Github className="size-3.5 text-primary" />
                    {meta.packagePath}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Architecture
                  </span>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Globe className="size-3.5 text-primary" />
                    MCP Edge Module
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Runtime
                  </span>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Cpu className="size-3.5 text-primary" />
                    Cloudflare Workers
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full" asChild>
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
          </div>

          <div className="rubik-panel-muted rubik-panel p-6 text-left">
            <div className="space-y-3">
              <div className="rubik-icon-badge h-12 w-12">
                <Zap className="size-5" />
              </div>
              <h4 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                Need customization?
              </h4>
              <p className="text-sm leading-7 text-muted-foreground">
                Fork the package, keep the interface contract, and tailor the tool surface to your
                own workflow.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
