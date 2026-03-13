import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { DrawerProvider, useDrawer } from "../DrawerProvider";
import type { McpAppSummary } from "../../../hooks/useApps";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <DrawerProvider>{children}</DrawerProvider>;
}

const sampleApp: McpAppSummary = {
  slug: "qa-studio",
  name: "QA Studio",
  description: "Browser automation",
  emoji: "🎭",
  category: "Browser Automation",
  tags: [],
  tagline: "Browser automation",
  pricing: "free",
  is_featured: false,
  is_new: false,
  tool_count: 5,
  sort_order: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DrawerProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore body overflow that may have been set by the provider.
    document.body.style.overflow = "";
  });

  it("starts with the drawer closed", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });
    expect(result.current.isOpen).toBe(false);
  });

  it("opens and closes the drawer", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("toggles the drawer", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it("locks body scroll when open", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => result.current.open());
    expect(document.body.style.overflow).toBe("hidden");

    act(() => result.current.close());
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("toggles with Cmd+K keyboard shortcut", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
      );
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
      );
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("closes with Escape key when open", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("tracks app visits and stores recents in localStorage", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => result.current.trackAppVisit(sampleApp));

    expect(result.current.recentApps).toHaveLength(1);
    expect(result.current.recentApps[0]?.slug).toBe("qa-studio");

    const stored = JSON.parse(localStorage.getItem("spike_recent_apps") ?? "[]") as McpAppSummary[];
    expect(stored[0]?.slug).toBe("qa-studio");
  });

  it("deduplicates recents and moves revisited app to top", () => {
    const another: McpAppSummary = { ...sampleApp, slug: "chess-engine", name: "Chess Engine" };
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      result.current.trackAppVisit(sampleApp);
      result.current.trackAppVisit(another);
      result.current.trackAppVisit(sampleApp); // revisit qa-studio
    });

    expect(result.current.recentApps[0]?.slug).toBe("qa-studio");
    expect(result.current.recentApps).toHaveLength(2);
  });

  it("caps recents at 5 entries", () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    const apps: McpAppSummary[] = Array.from({ length: 7 }, (_, i) => ({
      ...sampleApp,
      slug: `app-${i}`,
      name: `App ${i}`,
    }));

    act(() => {
      for (const app of apps) result.current.trackAppVisit(app);
    });

    expect(result.current.recentApps).toHaveLength(5);
  });

  it("throws when used outside DrawerProvider", () => {
    // Suppress the React error boundary console output in tests.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useDrawer())).toThrow(
      "useDrawer must be used within a DrawerProvider",
    );
    consoleSpy.mockRestore();
  });
});
