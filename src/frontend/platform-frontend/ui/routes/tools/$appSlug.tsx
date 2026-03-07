import { useParams } from "@tanstack/react-router";
import { useApp } from "../../hooks/useApps";
import { useAppSession } from "../../hooks/useAppSession";
import { AppMarkdownRenderer } from "../../src/components/tools/AppMarkdownRenderer";
import { RotateCcw, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AppSessionPage() {
  const { appSlug } = useParams({ strict: false });
  const { data: app, isLoading, isError, error } = useApp(appSlug as string);
  
  const { session, recordToolResult, resetSession, isToolAvailable } = useAppSession(
    appSlug as string,
    app?.graph || {},
    app?.tools || []
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div role="status" aria-live="polite" className="text-muted-foreground animate-pulse">Loading app...</div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Unable to load app.
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "App not found."}
          </p>
          <Link
            to="/tools"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Apps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
      <div className="flex-1 min-w-0">
        <div className="mb-8 flex items-center gap-4 border-b border-border pb-6">
          <Link
            to="/tools"
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            title="Back to Apps"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-4xl">{app.emoji}</div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{app.name}</h1>
            <p className="text-muted-foreground mt-1">{app.description}</p>
          </div>
        </div>

        <AppMarkdownRenderer
          content={app.markdown}
          appSlug={app.slug}
          graph={app.graph}
          session={session}
          recordToolResult={recordToolResult}
          isToolAvailable={isToolAvailable}
        />
      </div>

      <div className="w-full lg:w-80 shrink-0">
        <div className="sticky top-24 space-y-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Session State</h3>
              <button
                onClick={resetSession}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Reset Session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stored Outputs</h4>
              {Object.keys(session.outputs).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No outputs stored yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(session.outputs).map(([key, val]) => (
                    <div key={key} className="bg-muted/50 p-2 rounded-lg border border-border/50">
                      <div className="text-[10px] font-mono font-bold text-primary mb-1 break-all">{key}</div>
                      <div className="text-xs font-mono text-muted-foreground truncate" title={typeof val === 'object' ? JSON.stringify(val) : String(val)}>
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">History ({session.history.length})</h4>
              {session.history.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No tools executed.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 nice-scrollbar">
                  {session.history.slice().reverse().map((entry, i) => (
                    <div key={i} className="text-sm flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
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
        </div>
      </div>
    </div>
  );
}
