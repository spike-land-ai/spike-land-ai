import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Blocks,
  Bot,
  Braces,
  Cpu,
  FileCode2,
  FileText,
  MessageSquare,
  Radio,
  Sparkles,
  Terminal,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../shared/ui/button";
import { useApps, type McpAppSummary } from "../hooks/useApps";

type SurfaceId = "chat" | "terminal" | "mdx" | "server";

interface ProductSurface {
  id: SurfaceId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  commands: string[];
  Icon: LucideIcon;
}

const FALLBACK_APPS: McpAppSummary[] = [
  {
    slug: "qa-studio",
    name: "QA Studio",
    description: "Browser automation loops with screenshots, narration, and MCP execution.",
    emoji: "🧪",
    tool_count: 10,
    sort_order: 0,
  },
  {
    slug: "chess-engine",
    name: "Chess Engine",
    description: "Stateful gameplay, ratings, and challenge flows over MCP tools.",
    emoji: "♟️",
    tool_count: 5,
    sort_order: 1,
  },
  {
    slug: "bugbook",
    name: "Bugbook",
    description: "Signal-ranked bug reporting and triage coordination.",
    emoji: "🐞",
    tool_count: 4,
    sort_order: 2,
  },
  {
    slug: "learn-verify",
    name: "Learn & Verify",
    description: "Turn documents into adaptive quiz and badge flows.",
    emoji: "📚",
    tool_count: 6,
    sort_order: 3,
  },
];

const SURFACES: ProductSurface[] = [
  {
    id: "chat",
    label: "Spike Chat",
    eyebrow: "Every app gets a channel",
    title: "Chat is the runtime, not a sidebar.",
    description:
      "Each MCP app owns a persistent channel where users, teammates, bots, and system events all speak in one history.",
    points: [
      "Multi-user state instead of local ephemeral chat.",
      "Bot replies, human comments, and app_updated events share one thread.",
      "The same channel works for design discussion, code review, and execution logs.",
    ],
    commands: [
      "chat.join('app-qa-studio')",
      "chat.post('Turn this flow into a markdown-driven test guide')",
      "event.on('app_updated', refreshPreview)",
    ],
    Icon: MessageSquare,
  },
  {
    id: "terminal",
    label: "Terminal Mode",
    eyebrow: "Run any app as commands",
    title: "Browse the atlas, then execute tools in a terminal.",
    description:
      "The same app can be opened as an operator surface where users run tools directly, inspect output, and keep the transcript tied to the app channel.",
    points: [
      "Command-first access to the MCP tool surface.",
      "Useful for debugging, ops work, and agent-assisted execution.",
      "Outputs remain attached to the same app conversation.",
    ],
    commands: [
      "app.open('qa-studio', { surface: 'terminal' })",
      "tool.run('web_navigate', { url: '/pricing' })",
      "tool.run('web_screenshot', { name: 'pricing-flow' })",
    ],
    Icon: Terminal,
  },
  {
    id: "mdx",
    label: "MDX Apps",
    eyebrow: "Docs become runnable product",
    title: "An app can also ship as a markdown-native interface.",
    description:
      "MDX should be a first-class app surface so teams can mix explanation, controls, embeds, and live MCP actions in one shareable artifact.",
    points: [
      "Good for onboarding, runbooks, and demo-ready explainers.",
      "Lets one app feel like docs, command center, and walkthrough at once.",
      "Pairs naturally with preview embeds and structured params.",
    ],
    commands: [
      "app.open('qa-studio', { surface: 'mdx' })",
      "mdx.embed('tool-result', { tool: 'web_read' })",
      "mdx.render('runbook', { channelId: 'app-qa-studio' })",
    ],
    Icon: FileText,
  },
  {
    id: "server",
    label: "MCP Server",
    eyebrow: "Vibe code the tool itself",
    title: "The app shell can also edit the MCP server behind it.",
    description:
      "Vibe-code should not stop at the frontend. Users should be able to modify the underlying MCP server package, tests, and tool wiring from the same product loop.",
    points: [
      "Frontend and MCP package evolve in the same conversation.",
      "Generated code should prefer spike.land packages and internal tools first.",
      "The product page becomes a launch point for implementation, not just browsing.",
    ],
    commands: [
      "workspace.open('src/mcp-tools/qa-studio')",
      "agent.plan('add a screenshot diff tool using spike.land utilities')",
      "tool.run('test', { package: '@spike-land-ai/qa-studio' })",
    ],
    Icon: Cpu,
  },
];

const CHANNEL_EVENTS = [
  {
    speaker: "you",
    badge: "user",
    message: "Turn QA Studio into a markdown-driven acceptance-test app.",
  },
  {
    speaker: "bot-vibe-agent",
    badge: "agent",
    message: "Drafting MDX surface and wiring browser tools from the spike.land registry.",
  },
  {
    speaker: "system",
    badge: "event",
    message: "app_updated -> preview refreshed -> version 12",
  },
  {
    speaker: "teammate",
    badge: "human",
    message: "Keep screenshots in-channel so the whole review stays attached to the app.",
  },
];

const PRODUCT_RULES = [
  "Prefer spike.land MCP tools and @spike-land-ai packages over ad hoc external glue.",
  "Keep chat, terminal, MDX, and server editing tied to the same app identity.",
  "Treat bot output as durable app history, not transient token streams.",
];

const VALUE_POINTS = [
  {
    title: "Slack-shaped, app-native",
    body: "Every app gets a dedicated conversation instead of a disconnected support widget.",
    Icon: Users,
  },
  {
    title: "Hot reload from events",
    body: "Structured app_updated events turn chat activity directly into refreshed product state.",
    Icon: Radio,
  },
  {
    title: "One loop for all surfaces",
    body: "Browse an app, open terminal mode, publish an MDX shell, then patch the MCP server.",
    Icon: Waves,
  },
];

function AppAtlasCard({
  app,
  selected,
  onSelect,
}: {
  app: McpAppSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: selected
          ? "color-mix(in srgb, var(--chat-accent) 55%, transparent)"
          : "color-mix(in srgb, var(--border-color) 82%, transparent)",
        background: selected
          ? "linear-gradient(180deg, color-mix(in srgb, var(--chat-accent) 10%, var(--card-bg)), color-mix(in srgb, var(--card-bg) 90%, transparent))"
          : "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--muted-bg) 54%, transparent))",
        boxShadow: selected
          ? "0 20px 55px color-mix(in srgb, var(--chat-accent) 12%, transparent)"
          : "0 18px 44px color-mix(in srgb, var(--fg) 7%, transparent)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 items-center justify-center rounded-2xl text-xl"
          style={{
            background: "color-mix(in srgb, var(--chat-accent) 10%, transparent)",
          }}
        >
          {app.emoji || "🔧"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black tracking-tight">{app.name}</p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
              style={{
                background: "color-mix(in srgb, var(--primary-color) 10%, transparent)",
                color: "var(--primary-color)",
              }}
            >
              MCP
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {app.tool_count} tool{app.tool_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6" style={{ color: "var(--muted-fg)" }}>
        {app.description}
      </p>
    </button>
  );
}

export function BuildPage() {
  const { data: apps, isLoading, isError } = useApps();
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>("chat");
  const [selectedAppSlug, setSelectedAppSlug] = useState<string | null>(null);

  const atlasApps = useMemo(() => {
    if (apps && apps.length > 0) return apps.slice(0, 6);
    return FALLBACK_APPS;
  }, [apps]);

  useEffect(() => {
    if (!selectedAppSlug && atlasApps.length > 0) {
      setSelectedAppSlug(atlasApps[0].slug);
    }
  }, [atlasApps, selectedAppSlug]);

  const activeApp = useMemo(() => {
    return atlasApps.find((app) => app.slug === selectedAppSlug) ?? atlasApps[0] ?? null;
  }, [atlasApps, selectedAppSlug]);

  const activeSurface = SURFACES.find((surface) => surface.id === selectedSurface) ?? SURFACES[0];
  const ActiveSurfaceIcon = activeSurface.Icon;
  const registryStatus = isLoading
    ? "Loading live registry"
    : isError
      ? "Showing curated atlas"
      : "Live registry connected";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--chat-accent) 12%, transparent), transparent 28%), radial-gradient(circle at 85% 10%, color-mix(in srgb, var(--primary-light) 14%, transparent), transparent 30%), var(--bg)",
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--chat-accent) 10%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute right-[-5rem] top-[12rem] h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary-light) 13%, transparent)" }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div
            className="rounded-[34px] border p-6 sm:p-8"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 85%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--bg) 68%, transparent))",
              boxShadow: "0 28px 90px color-mix(in srgb, var(--fg) 9%, transparent)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em]"
                style={{
                  background: "color-mix(in srgb, var(--chat-accent) 12%, transparent)",
                  color: "var(--chat-accent)",
                }}
              >
                vibe-code
              </span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                spike-chat native
              </span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                terminal + mdx + server
              </span>
            </div>

            <div className="mt-6 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.34em] text-muted-foreground">
                mcp apps with a conversation model
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground sm:text-6xl">
                Every app should feel like
                <span
                  className="block text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--fg) 0%, var(--chat-accent-light) 44%, var(--primary-light) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  chat, runtime, and source control at once.
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Vibe-code is the product page for a different operating model: each MCP app gets its
                own spike-chat channel, can be browsed from an atlas, opened in terminal mode,
                published as an MDX app, and even edited at the MCP server layer using spike.land
                tools first.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-2xl px-6 text-sm font-black">
                <Link to="/tools">
                  Browse MCP Apps
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-2xl px-6 text-sm font-bold"
              >
                <Link to="/messages">Open Messages</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 rounded-2xl px-4 text-sm font-bold"
              >
                <Link to="/docs">Read Docs</Link>
              </Button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {VALUE_POINTS.map(({ title, body, Icon }) => (
                <div
                  key={title}
                  className="rounded-[24px] border p-4"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border-color) 78%, transparent)",
                    background: "color-mix(in srgb, var(--muted-bg) 62%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <p className="text-sm font-black tracking-tight text-foreground">{title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[34px] border p-5 sm:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 85%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--muted-bg) 66%, transparent))",
              boxShadow: "0 26px 70px color-mix(in srgb, var(--chat-accent) 10%, transparent)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                  channel anatomy
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  One app, one room, many actors.
                </h2>
              </div>
              <div
                className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em]"
                style={{
                  background: "color-mix(in srgb, var(--success-fg) 12%, transparent)",
                  color: "var(--success-fg)",
                }}
              >
                live model
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {CHANNEL_EVENTS.map((event, index) => (
                <div
                  key={String(index)}
                  className="rounded-[24px] border p-4"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border-color) 78%, transparent)",
                    background: "color-mix(in srgb, var(--bg) 74%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        background:
                          event.badge === "agent"
                            ? "color-mix(in srgb, var(--chat-accent) 12%, transparent)"
                            : event.badge === "event"
                              ? "color-mix(in srgb, var(--info-fg) 12%, transparent)"
                              : "color-mix(in srgb, var(--primary-color) 10%, transparent)",
                        color:
                          event.badge === "agent"
                            ? "var(--chat-accent)"
                            : event.badge === "event"
                              ? "var(--info-fg)"
                              : "var(--primary-color)",
                      }}
                    >
                      {event.badge}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {event.speaker}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">{event.message}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-[24px] border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--border-color) 78%, transparent)",
                  background: "color-mix(in srgb, var(--muted-bg) 55%, transparent)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <p className="text-sm font-black text-foreground">Bot-safe updates</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Agents post full messages, structured events, and code changes back into the same
                  app identity.
                </p>
              </div>
              <div
                className="rounded-[24px] border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--border-color) 78%, transparent)",
                  background: "color-mix(in srgb, var(--muted-bg) 55%, transparent)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-primary" />
                  <p className="text-sm font-black text-foreground">Preview-aware events</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  app_updated is not just a message. It is a chat-visible summary plus a reload
                  trigger for the active surface.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div
            className="rounded-[34px] border p-5 sm:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 82%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--bg) 72%, transparent))",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                  app atlas
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  Browse real apps, then choose the surface.
                </h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {registryStatus}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{atlasApps.length} shown</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {atlasApps.map((app) => (
                <AppAtlasCard
                  key={app.slug}
                  app={app}
                  selected={activeApp?.slug === app.slug}
                  onSelect={() => setSelectedAppSlug(app.slug)}
                />
              ))}
            </div>
          </div>

          <div
            className="rounded-[34px] border p-5 sm:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 82%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--muted-bg) 60%, transparent))",
            }}
          >
            {activeApp ? (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-14 items-center justify-center rounded-[20px] text-2xl"
                        style={{
                          background: "color-mix(in srgb, var(--chat-accent) 12%, transparent)",
                        }}
                      >
                        {activeApp.emoji || "🔧"}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                          active app
                        </p>
                        <h3 className="mt-1 text-3xl font-black tracking-tight text-foreground">
                          {activeApp.name}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                      {activeApp.description}
                    </p>
                  </div>

                  <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-[22px] border px-4 py-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border-color) 75%, transparent)",
                        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
                      }}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        tools
                      </p>
                      <p className="mt-2 text-2xl font-black text-foreground">{activeApp.tool_count}</p>
                    </div>
                    <div
                      className="rounded-[22px] border px-4 py-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border-color) 75%, transparent)",
                        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
                      }}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        route
                      </p>
                      <p className="mt-2 text-sm font-black text-foreground">/tools/{activeApp.slug}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SURFACES.map((surface) => {
                    const Icon = surface.Icon;
                    const isActive = surface.id === selectedSurface;

                    return (
                      <button
                        key={surface.id}
                        type="button"
                        onClick={() => setSelectedSurface(surface.id)}
                        className="rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                          borderColor: isActive
                            ? "color-mix(in srgb, var(--chat-accent) 55%, transparent)"
                            : "color-mix(in srgb, var(--border-color) 80%, transparent)",
                          background: isActive
                            ? "color-mix(in srgb, var(--chat-accent) 10%, var(--card-bg))"
                            : "color-mix(in srgb, var(--bg) 72%, transparent)",
                        }}
                      >
                        <Icon className="size-4 text-primary" />
                        <p className="mt-3 text-sm font-black tracking-tight text-foreground">
                          {surface.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {surface.eyebrow}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[0.98fr_1.02fr]">
                  <div
                    className="rounded-[28px] border p-5"
                    style={{
                      borderColor: "color-mix(in srgb, var(--border-color) 80%, transparent)",
                      background: "color-mix(in srgb, var(--bg) 72%, transparent)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ActiveSurfaceIcon className="size-4 text-primary" />
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                        {activeSurface.eyebrow}
                      </p>
                    </div>
                    <h4 className="mt-3 text-2xl font-black tracking-tight text-foreground">
                      {activeSurface.title}
                    </h4>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {activeSurface.description}
                    </p>
                    <div className="mt-5 grid gap-3">
                      {activeSurface.points.map((point) => (
                        <div
                          key={point}
                          className="rounded-[20px] border px-4 py-3"
                          style={{
                            borderColor: "color-mix(in srgb, var(--border-color) 76%, transparent)",
                            background: "color-mix(in srgb, var(--muted-bg) 54%, transparent)",
                          }}
                        >
                          <p className="text-sm leading-6 text-foreground">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-[28px] border p-5"
                    style={{
                      borderColor: "color-mix(in srgb, var(--border-color) 80%, transparent)",
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--muted-bg) 52%, transparent))",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Braces className="size-4 text-primary" />
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                        execution sketch
                      </p>
                    </div>
                    <div className="mt-4 rounded-[24px] border border-border bg-black px-4 py-4 font-mono text-[12px] leading-6 text-white shadow-xl shadow-black/15">
                      {activeSurface.commands.map((command) => (
                        <div key={command} className="flex gap-3">
                          <span className="text-amber-300">$</span>
                          <span>{command}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild className="h-11 rounded-2xl px-5 text-sm font-black">
                        <Link
                          to="/tools/$appSlug"
                          params={{ appSlug: activeApp.slug }}
                        >
                          Open {activeApp.name}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 rounded-2xl px-5 text-sm font-bold"
                      >
                        <Link to="/tools">Back to Atlas</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
          <div
            className="rounded-[34px] border p-5 sm:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 82%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--bg) 70%, transparent))",
            }}
          >
            <div className="flex items-center gap-2">
              <Blocks className="size-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
                generation rules
              </p>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground">
              Code should stay inside the spike.land ecosystem.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              If vibe-code writes a feature, it should reach for spike.land tools, internal packages,
              and MCP contracts before inventing random infrastructure around them.
            </p>

            <div className="mt-5 grid gap-3">
              {PRODUCT_RULES.map((rule) => (
                <div
                  key={rule}
                  className="rounded-[22px] border px-4 py-4"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border-color) 76%, transparent)",
                    background: "color-mix(in srgb, var(--muted-bg) 54%, transparent)",
                  }}
                >
                  <p className="text-sm leading-6 text-foreground">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[34px] border p-5 sm:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--border-color) 82%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, transparent), color-mix(in srgb, var(--muted-bg) 56%, transparent))",
            }}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: "color-mix(in srgb, var(--border-color) 76%, transparent)",
                  background: "color-mix(in srgb, var(--bg) 74%, transparent)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                    from app page to editor
                  </p>
                </div>
                <p className="mt-3 text-lg font-black tracking-tight text-foreground">
                  Browse, select, and launch.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Start from a real app in the atlas instead of a blank editor. The app identity,
                  tools, and channel already exist before the first generated diff.
                </p>
              </div>

              <div
                className="rounded-[28px] border p-5"
                style={{
                  borderColor: "color-mix(in srgb, var(--border-color) 76%, transparent)",
                  background: "color-mix(in srgb, var(--bg) 74%, transparent)",
                }}
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="size-4 text-primary" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                    one source of truth
                  </p>
                </div>
                <p className="mt-3 text-lg font-black tracking-tight text-foreground">
                  Frontend and MCP logic stay linked.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  UI changes, MDX flows, terminal commands, and server patches should resolve back to
                  the same package graph.
                </p>
              </div>
            </div>

            <div
              className="mt-4 rounded-[28px] border p-5"
              style={{
                borderColor: "color-mix(in srgb, var(--border-color) 76%, transparent)",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--chat-accent) 8%, var(--card-bg)), color-mix(in srgb, var(--bg) 72%, transparent))",
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em]"
                  style={{
                    background: "color-mix(in srgb, var(--chat-accent) 12%, transparent)",
                    color: "var(--chat-accent)",
                  }}
                >
                  product claim
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Slack-like shape, but attached to execution.
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                A message can become a command, a command can become an app update, and the update
                can become the new default surface.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                That is the real difference: the conversation is not commentary around the app. It is
                how the app gets shaped, run, reviewed, and evolved.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
