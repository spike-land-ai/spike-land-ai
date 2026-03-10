import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { useParams, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useApp } from "../../hooks/useApps";
import { useAppSession } from "../../hooks/useAppSession";
import { trackAnalyticsEvent } from "../../hooks/useAnalytics";
import { AppMarkdownRenderer } from "../../src/components/tools/AppMarkdownRenderer";
import { SpikeChatPanel } from "../../components/SpikeChatPanel";
import { TerminalSurface } from "../../components/TerminalSurface";
import { MdxSurface } from "../../components/MdxSurface";
import type { AppUpdatedEvent } from "../../hooks/useSpikeChat";
import {
  RotateCcw,
  ArrowLeft,
  MessageSquare,
  TerminalIcon,
  FileText,
  Server,
  Loader2,
} from "lucide-react";

const HackerNewsApp = lazy(() =>
  import("../../apps/hackernews").then((m) => ({ default: m.HackerNewsApp })),
);
const PagesTemplateChooserApp = lazy(() =>
  import("../../apps/pages-template-chooser").then((m) => ({ default: m.PagesTemplateChooserApp })),
);
const ChessArenaApp = lazy(() =>
  import("../../apps/chess-arena").then((m) => ({ default: m.ChessArenaApp })),
);
const AiAutomatizalasApp = lazy(() =>
  import("../../apps/ai-automatizalas").then((m) => ({ default: m.AiAutomatizalasApp })),
);

type SurfaceType = "overview" | "chat" | "terminal" | "mdx";

const SURFACES: { id: SurfaceType; label: string; icon: typeof MessageSquare }[] = [
  { id: "overview", label: "Overview", icon: Server },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "mdx", label: "MDX", icon: FileText },
];

export function AppSessionPage() {
  const { appSlug } = useParams({ strict: false });
  const search = useSearch({ from: "/apps/$appSlug" }) as { surface?: SurfaceType };
  const navigate = useNavigate();
  const { data: app, isLoading, isError, error } = useApp(appSlug as string);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track app view once the app data has loaded
  useEffect(() => {
    if (!app || !appSlug) return;
    trackAnalyticsEvent("app_view", {
      appSlug,
      appName: app.name,
      category: app.category ?? "",
    });
  }, [appSlug, app?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const { session, recordToolResult, resetSession, isToolAvailable } = useAppSession(
    appSlug as string,
    app?.graph || {},
    app?.tools || [],
  );

  const channelId = `app-${appSlug}`;
  const isHackerNews =
    appSlug === "hackernews" || appSlug === "hn-reader" || appSlug === "hackernews-reader";
  const isPagesTemplateChooser = appSlug === "pages-template-chooser";
  const isChessArena = appSlug === "chess-arena";
  const isAiAutomatizalas = appSlug === "ai-automatizalas";
  const isShowcaseApp = isHackerNews || isPagesTemplateChooser || isChessArena || isAiAutomatizalas;
  const availableSurfaces = app?.tools.length
    ? SURFACES
    : SURFACES.filter((surface) => surface.id !== "terminal");
  const activeSurface = availableSurfaces.some((surface) => surface.id === search.surface)
    ? (search.surface as SurfaceType)
    : "overview";

  const setActiveSurface = useCallback(
    (surface: SurfaceType) => {
      void navigate({
        to: "/apps/$appSlug",
        params: { appSlug: appSlug ?? "" },
        search: (prev) => ({ ...prev, surface }),
      });
    },
    [appSlug, navigate],
  );

  const handleAppUpdated = useCallback((_event: AppUpdatedEvent) => {
    // Trigger a refresh of the overview/preview when an app_updated event arrives
    setRefreshKey((k) => k + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div role="status" aria-live="polite" className="text-muted-foreground animate-pulse">
          Loading app...
        </div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">Unable to load app.</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "App not found."}
          </p>
          <Link
            to="/apps"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Apps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border pb-4 mb-0 px-2">
        <Link
          to="/apps"
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          title="Back to Apps"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-4xl">{app.emoji}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{app.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{app.description}</p>
        </div>
      </div>

      {/* Surface tabs */}
      <div
        className="flex gap-1 border-b border-border px-2 bg-muted/20"
        role="tablist"
        aria-label="App surfaces"
      >
        {availableSurfaces.map((surface) => {
          const Icon = surface.icon;
          const isActive = activeSurface === surface.id;
          return (
            <button
              key={surface.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${surface.id}`}
              onClick={() => setActiveSurface(surface.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors
                border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
            >
              <Icon className="w-4 h-4" />
              {surface.label}
            </button>
          );
        })}
      </div>

      {/* Surface panels */}
      <div className="flex-1 min-h-0 flex">
        {/* Main surface content */}
        <div
          className="flex-1 min-w-0 overflow-hidden"
          role="tabpanel"
          id={`panel-${activeSurface}`}
        >
          {activeSurface === "overview" && (
            <div className="flex flex-col lg:flex-row gap-8 p-4 overflow-y-auto h-full">
              <div className="flex-1 min-w-0" key={refreshKey}>
                {isHackerNews ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <HackerNewsApp />
                  </Suspense>
                ) : isPagesTemplateChooser ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <PagesTemplateChooserApp />
                  </Suspense>
                ) : isChessArena ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <ChessArenaApp />
                  </Suspense>
                ) : isAiAutomatizalas ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <AiAutomatizalasApp />
                  </Suspense>
                ) : (
                  <AppMarkdownRenderer
                    content={app.markdown}
                    appSlug={app.slug}
                    graph={app.graph}
                    session={session}
                    recordToolResult={recordToolResult}
                    isToolAvailable={isToolAvailable}
                  />
                )}
              </div>

              {/* Session sidebar (only for non-showcase apps) */}
              {!isShowcaseApp && (
                <div className="w-full lg:w-72 shrink-0">
                  <div className="sticky top-4 space-y-4">
                    <SessionPanel session={session} onReset={resetSession} />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSurface === "chat" && (
            <SpikeChatPanel
              channelId={channelId}
              onAppUpdated={handleAppUpdated}
              className="h-full"
            />
          )}

          {activeSurface === "terminal" && (
            <TerminalSurface
              appSlug={appSlug as string}
              availableTools={app.tools}
              className="h-full"
            />
          )}

          {activeSurface === "mdx" && (
            <MdxSurface appSlug={appSlug as string} content={app.markdown} className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

/** Sidebar showing session outputs and history */
function SessionPanel({
  session,
  onReset,
}: {
  session: {
    outputs: Record<string, unknown>;
    history: Array<{ tool: string; timestamp: number }>;
  };
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Session State</h3>
        <button
          onClick={onReset}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Reset Session"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Stored Outputs
        </h4>
        {Object.keys(session.outputs).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No outputs stored yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(session.outputs).map(([key, val]) => (
              <div key={key} className="bg-muted/50 p-2 rounded-lg border border-border/50">
                <div className="text-[10px] font-mono font-bold text-primary mb-1 break-all">
                  {key}
                </div>
                <div
                  className="text-xs font-mono text-muted-foreground truncate"
                  title={typeof val === "object" ? JSON.stringify(val) : String(val)}
                >
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          History ({session.history.length})
        </h4>
        {session.history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No tools executed.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {session.history
              .slice()
              .reverse()
              .map((entry, i) => (
                <div key={i} className="text-sm flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-mono font-medium">{entry.tool}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
