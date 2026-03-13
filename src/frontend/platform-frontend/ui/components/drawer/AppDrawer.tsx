import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Plus, BookOpen, Store, ChevronRight } from "lucide-react";
import { useDrawer } from "./DrawerProvider";
import { useInstalledApps } from "../../hooks/useInstalledApps";
import { useApps } from "../../hooks/useApps";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { cn } from "../../../styling/cn";
import type { McpAppSummary } from "../../hooks/useApps";

// ---------------------------------------------------------------------------
// Quick actions shown at the bottom of the drawer
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  {
    label: "Browse store",
    description: "Discover MCP apps",
    icon: Store,
    to: "/apps",
  },
  {
    label: "Learn",
    description: "Interactive tutorials",
    icon: BookOpen,
    to: "/learn",
  },
  {
    label: "Vibe Code",
    description: "Build something new",
    icon: Plus,
    to: "/vibe-code",
  },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface AppItemProps {
  app: McpAppSummary;
  isFocused: boolean;
  onClick: (app: McpAppSummary) => void;
  itemRef?: (el: HTMLButtonElement | null) => void;
}

function AppItem({ app, isFocused, onClick, itemRef }: AppItemProps) {
  return (
    <button
      ref={itemRef}
      type="button"
      onClick={() => onClick(app)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        isFocused
          ? "bg-primary/10 text-foreground outline-none ring-1 ring-primary/30"
          : "hover:bg-muted/60 text-foreground",
      )}
      aria-label={`Open ${app.name}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-lg shadow-sm"
        aria-hidden="true"
      >
        {app.emoji || "📦"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{app.name}</p>
        <p className="truncate text-xs text-muted-foreground">{app.category}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 px-3 text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export function AppDrawer() {
  const { isOpen, close, recentApps, trackAppVisit } = useDrawer();
  const navigate = useNavigate();
  const drawerRef = useFocusTrap(isOpen, close);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: installedApps = [], isLoading: installedLoading } = useInstalledApps();
  const { data: allApps = [] } = useApps();

  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Reset state whenever drawer opens/closes.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setFocusedIndex(-1);
      // Autofocus the search input after the animation settles.
      const id = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Search filtering
  // ---------------------------------------------------------------------------

  const normalizedQuery = query.trim().toLowerCase();

  const filteredApps: McpAppSummary[] = normalizedQuery
    ? allApps.filter(
        (app) =>
          app.name.toLowerCase().includes(normalizedQuery) ||
          app.description.toLowerCase().includes(normalizedQuery) ||
          app.slug.toLowerCase().includes(normalizedQuery) ||
          app.category.toLowerCase().includes(normalizedQuery),
      )
    : [];

  // When there is an active search query we show search results. Otherwise we
  // show the Installed / Recent sections.
  const isSearching = normalizedQuery.length > 0;

  // Flat list of items navigable with arrow keys (only in search mode).
  const navigableItems = isSearching ? filteredApps : [];

  // ---------------------------------------------------------------------------
  // Navigate to app
  // ---------------------------------------------------------------------------

  const handleOpenApp = useCallback(
    (app: McpAppSummary) => {
      trackAppVisit(app);
      close();
      void navigate({ to: "/apps/$appSlug", params: { appSlug: app.slug } });
    },
    [close, navigate, trackAppVisit],
  );

  const handleQuickAction = useCallback(
    (to: string) => {
      close();
      void navigate({ to } as Parameters<typeof navigate>[0]);
    },
    [close, navigate],
  );

  // ---------------------------------------------------------------------------
  // Keyboard navigation within search results
  // ---------------------------------------------------------------------------

  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isSearching) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, navigableItems.length - 1);
          itemRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev <= 0) {
            searchRef.current?.focus();
            return -1;
          }
          const next = prev - 1;
          itemRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const app = navigableItems[focusedIndex];
        if (app) handleOpenApp(app);
      }
    },
    [isSearching, navigableItems, focusedIndex, handleOpenApp],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clicking backdrop closes the drawer, keyboard handled by focus trap */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={close}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="App drawer"
        className={cn(
          // Layout
          "fixed right-0 top-0 z-50 flex h-full flex-col",
          // Sizing: 320 px desktop, full width mobile
          "w-full sm:w-80",
          // Background
          "border-l border-border bg-background shadow-2xl",
          // Slide animation
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            role="combobox"
            aria-expanded={isSearching && filteredApps.length > 0}
            aria-autocomplete="list"
            aria-controls="drawer-results"
            aria-label="Search apps"
            placeholder="Search apps… (Cmd+K)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedIndex(-1);
            }}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-5">
          {/* ---------------------------------------------------------------- */}
          {/* Search results */}
          {/* ---------------------------------------------------------------- */}
          {isSearching && (
            <section aria-label="Search results">
              {filteredApps.length > 0 ? (
                <ul id="drawer-results" role="listbox" className="space-y-0.5">
                  {filteredApps.map((app, idx) => (
                    <li key={app.slug} role="option" aria-selected={idx === focusedIndex}>
                      <AppItem
                        app={app}
                        isFocused={idx === focusedIndex}
                        onClick={handleOpenApp}
                        itemRef={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No apps match &ldquo;{query}&rdquo;
                </p>
              )}
            </section>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Default view: Installed + Recent */}
          {/* ---------------------------------------------------------------- */}
          {!isSearching && (
            <>
              {/* Installed apps */}
              <section aria-label="Installed apps">
                <SectionHeading>Installed</SectionHeading>
                {installedLoading ? (
                  <div className="grid grid-cols-4 gap-2 px-1 py-2" aria-busy="true" aria-label="Loading installed apps">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1.5"
                        aria-hidden="true"
                      >
                        <div className="h-12 w-12 animate-pulse rounded-2xl bg-muted" />
                        <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : installedApps.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 px-1 py-2">
                    {installedApps.map((app) => (
                      <button
                        key={app.slug}
                        type="button"
                        onClick={() => handleOpenApp(app)}
                        className="group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-colors hover:bg-muted/60"
                        aria-label={`Open ${app.name}`}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-2xl shadow-sm transition-transform group-hover:scale-105">
                          {app.emoji || "📦"}
                        </span>
                        <span className="w-full truncate text-center text-[0.65rem] font-medium text-muted-foreground group-hover:text-foreground">
                          {app.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/30 px-4 py-5 text-center">
                    <p className="text-sm text-muted-foreground">No apps installed yet.</p>
                    <button
                      type="button"
                      onClick={() => handleQuickAction("/apps")}
                      className="mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                      Browse the store
                    </button>
                  </div>
                )}
              </section>

              {/* Recent apps */}
              {recentApps.length > 0 && (
                <section aria-label="Recent apps">
                  <SectionHeading>Recent</SectionHeading>
                  <ul className="space-y-0.5">
                    {recentApps.map((app) => (
                      <li key={app.slug}>
                        <AppItem
                          app={app}
                          isFocused={false}
                          onClick={handleOpenApp}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {/* Quick actions footer */}
        <div className="border-t border-border px-2 py-3">
          <SectionHeading>Quick actions</SectionHeading>
          <ul className="space-y-0.5">
            {QUICK_ACTIONS.map(({ label, description, icon: Icon, to }) => (
              <li key={to}>
                <button
                  type="button"
                  onClick={() => handleQuickAction(to)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
