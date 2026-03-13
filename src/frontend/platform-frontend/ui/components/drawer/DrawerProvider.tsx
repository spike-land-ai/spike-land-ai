import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { McpAppSummary } from "../../hooks/useApps";

const RECENT_APPS_KEY = "spike_recent_apps";
const MAX_RECENT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrawerContextValue {
  /** Whether the app drawer is currently visible. */
  isOpen: boolean;
  /** Open the app drawer. */
  open: () => void;
  /** Close the app drawer. */
  close: () => void;
  /** Toggle the app drawer open/closed. */
  toggle: () => void;
  /** Recently used apps, newest first. */
  recentApps: McpAppSummary[];
  /** Record a navigation to an app so it appears in the recents list. */
  trackAppVisit: (app: McpAppSummary) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DrawerContext = createContext<DrawerContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadRecentApps(): McpAppSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_APPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as McpAppSummary[];
  } catch {
    return [];
  }
}

function saveRecentApps(apps: McpAppSummary[]): void {
  try {
    localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(apps));
  } catch {
    // localStorage may be unavailable (e.g. private browsing with strict settings)
  }
}

function upsertRecent(prev: McpAppSummary[], app: McpAppSummary): McpAppSummary[] {
  const filtered = prev.filter((a) => a.slug !== app.slug);
  return [app, ...filtered].slice(0, MAX_RECENT);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DrawerProviderProps {
  children: React.ReactNode;
}

export function DrawerProvider({ children }: DrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentApps, setRecentApps] = useState<McpAppSummary[]>(() => loadRecentApps());

  // Keep a stable ref so the keyboard handler closure never stales.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const trackAppVisit = useCallback((app: McpAppSummary) => {
    setRecentApps((prev) => {
      const next = upsertRecent(prev, app);
      saveRecentApps(next);
      return next;
    });
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K toggles the drawer.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMacCmd = event.metaKey && !event.ctrlKey;
      const isCtrl = event.ctrlKey && !event.metaKey;
      if ((isMacCmd || isCtrl) && event.key === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Allow Escape to close.
      if (event.key === "Escape" && isOpenRef.current) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const value = useMemo<DrawerContextValue>(
    () => ({ isOpen, open, close, toggle, recentApps, trackAppVisit }),
    [isOpen, open, close, toggle, recentApps, trackAppVisit],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Returns the DrawerContext value.
 * Must be used inside a `<DrawerProvider>`.
 */
export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return ctx;
}
