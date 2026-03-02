"use client";

import { type ReactNode, useCallback, useReducer, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Loader2, Minimize2 } from "lucide-react";
import { qaNavigate } from "@/lib/qa-studio/actions";
import { toast } from "sonner";

import { ScreenshotPanel } from "./ScreenshotPanel";
import { ConsolePanel } from "./ConsolePanel";
import { NetworkPanel } from "./NetworkPanel";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { EvaluatePanel } from "./EvaluatePanel";
import { TestRunnerPanel } from "./TestRunnerPanel";
import { CoveragePanel } from "./CoveragePanel";

type PanelStatus = "idle" | "loading" | "success" | "error";

interface QaStudioState {
  url: string;
  currentTitle: string;
  activeTab: string;
  navigationStatus: PanelStatus;
  navigationError: string | null;
}

type QaStudioAction =
  | { type: "SET_URL"; payload: string }
  | { type: "SET_ACTIVE_TAB"; payload: string }
  | { type: "NAVIGATE_START" }
  | { type: "NAVIGATE_SUCCESS"; payload: { url: string; title: string } }
  | { type: "NAVIGATE_ERROR"; payload: string };

function qaStudioReducer(state: QaStudioState, action: QaStudioAction): QaStudioState {
  switch (action.type) {
    case "SET_URL":
      return { ...state, url: action.payload };
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };
    case "NAVIGATE_START":
      return {
        ...state,
        navigationStatus: "loading",
        navigationError: null,
      };
    case "NAVIGATE_SUCCESS":
      return {
        ...state,
        navigationStatus: "success",
        url: action.payload.url,
        currentTitle: action.payload.title,
        navigationError: null,
      };
    case "NAVIGATE_ERROR":
      return {
        ...state,
        navigationStatus: "error",
        navigationError: action.payload,
      };
    default:
      return state;
  }
}

const initialState: QaStudioState = {
  url: "",
  currentTitle: "",
  activeTab: "browser",
  navigationStatus: "idle",
  navigationError: null,
};

/** Double-click a panel to expand it to fullscreen overlay. Click minimize or press Esc to close. */
function FullscreenPanel({ children, className }: { children: ReactNode; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Don't expand if user is interacting with buttons/inputs/selects inside
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, [role=combobox]")) {
      return;
    }
    setExpanded(true);
  }, []);

  const handleClose = useCallback(() => setExpanded(false), []);

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") setExpanded(false);
  }, []);

  if (expanded) {
    return (
      <dialog
        open
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-6 overflow-auto w-full h-full max-w-none max-h-none m-0 border-none"
        onKeyDown={handleKeyDown}
        ref={ref}
        aria-label="Expanded panel"
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 h-8 px-2 gap-1.5"
        >
          <Minimize2 className="h-4 w-4" />
          Close
        </Button>
        <div className="max-w-7xl mx-auto pt-2">{children}</div>
      </dialog>
    );
  }

  return (
    <div
      className={className}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
      role="button"
      tabIndex={0}
      aria-label="Double-click to expand panel"
    >
      {children}
    </div>
  );
}

export function QaStudioClient() {
  const [state, dispatch] = useReducer(qaStudioReducer, initialState);

  const handleNavigate = useCallback(async () => {
    if (!state.url.trim()) return;

    let targetUrl = state.url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    dispatch({ type: "NAVIGATE_START" });
    try {
      const result = await qaNavigate(targetUrl);
      dispatch({
        type: "NAVIGATE_SUCCESS",
        payload: { url: result.url, title: result.title },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Navigation failed";
      dispatch({ type: "NAVIGATE_ERROR", payload: message });
    }
  }, [state.url]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate],
  );

  return (
    <div className="space-y-4">
      {/* URL Navigation Bar */}
      <div className="flex items-center gap-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/40 p-3">
        <Globe className="h-4 w-4 text-primary shrink-0" />
        <Input
          value={state.url}
          onChange={(e) => dispatch({ type: "SET_URL", payload: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          className="text-sm font-mono h-9 bg-black/20 border-border/30 flex-1"
          aria-label="URL to navigate"
        />
        <Button
          size="sm"
          onClick={handleNavigate}
          disabled={state.navigationStatus === "loading" || !state.url.trim()}
          className="h-9 px-4 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {state.navigationStatus === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : null}
          Navigate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-4 shrink-0 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => {
            handleNavigate();
            // In a real implementation, this would queue up accessibility and coverage audits
            toast.info("Queueing full system audit...");
          }}
        >
          Auto-Audit
        </Button>
        {state.navigationStatus === "success" && state.currentTitle && (
          <Badge variant="secondary" className="shrink-0 max-w-[200px] truncate">
            {state.currentTitle}
          </Badge>
        )}
      </div>

      {/* Navigation error */}
      {state.navigationStatus === "error" && state.navigationError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.navigationError}
        </div>
      )}

      {/* Navigation loading skeleton */}
      {state.navigationStatus === "loading" && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs
        value={state.activeTab}
        onValueChange={(value) => dispatch({ type: "SET_ACTIVE_TAB", payload: value })}
      >
        <TabsList>
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        {/* Browser Tab */}
        <TabsContent value="browser">
          <div className="space-y-4">
            {/* Top row: Screenshot + Console side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <FullscreenPanel className="lg:col-span-3">
                <ScreenshotPanel />
              </FullscreenPanel>
              <FullscreenPanel className="lg:col-span-2">
                <ConsolePanel />
              </FullscreenPanel>
            </div>
            {/* Bottom row: Network, Accessibility, Evaluate */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FullscreenPanel>
                <NetworkPanel />
              </FullscreenPanel>
              <FullscreenPanel>
                <AccessibilityPanel />
              </FullscreenPanel>
              <FullscreenPanel>
                <EvaluatePanel />
              </FullscreenPanel>
            </div>
          </div>
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FullscreenPanel>
              <TestRunnerPanel />
            </FullscreenPanel>
            <FullscreenPanel>
              <CoveragePanel />
            </FullscreenPanel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
