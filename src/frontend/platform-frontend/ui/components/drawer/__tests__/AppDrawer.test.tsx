import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DrawerProvider } from "../DrawerProvider";
import { AppDrawer } from "../AppDrawer";
import type { McpAppSummary } from "../../../hooks/useApps";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
}));

vi.mock("../../../hooks/useApps", () => ({
  useApps: () => ({
    data: [
      {
        slug: "qa-studio",
        name: "QA Studio",
        description: "Browser automation via Playwright",
        emoji: "🎭",
        category: "Browser Automation",
        tags: [],
        tagline: "",
        pricing: "free",
        is_featured: true,
        is_new: false,
        tool_count: 5,
        sort_order: 0,
      },
      {
        slug: "chess-engine",
        name: "Chess Engine",
        description: "ELO chess game",
        emoji: "♟️",
        category: "Games & Simulation",
        tags: [],
        tagline: "",
        pricing: "free",
        is_featured: false,
        is_new: false,
        tool_count: 3,
        sort_order: 1,
      },
    ] satisfies McpAppSummary[],
  }),
}));

vi.mock("../../../hooks/useInstalledApps", () => ({
  useInstalledApps: () => ({
    data: [] as McpAppSummary[],
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DrawerProvider>{children}</DrawerProvider>
      </QueryClientProvider>
    );
  };
}

// Helper to open the drawer via keyboard shortcut
function openDrawer() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("is not visible when drawer is closed", () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    const dialog = screen.getByRole("dialog", { name: "App drawer" });
    expect(dialog).toHaveClass("translate-x-full");
  });

  it("becomes visible when drawer is opened", () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();
    const dialog = screen.getByRole("dialog", { name: "App drawer" });
    expect(dialog).not.toHaveClass("translate-x-full");
    expect(dialog).toHaveClass("translate-x-0");
  });

  it("closes when the X button is clicked", () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    const closeButton = screen.getByRole("button", { name: "Close drawer" });
    fireEvent.click(closeButton);

    const dialog = screen.getByRole("dialog", { name: "App drawer" });
    expect(dialog).toHaveClass("translate-x-full");
  });

  it("renders installed, recent, and quick-action sections in default view", () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    expect(screen.getByRole("region", { name: "Installed apps" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Quick actions" })).toBeInTheDocument();
  });

  it("shows search results when query is entered", async () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    const searchInput = screen.getByRole("combobox", { name: "Search apps" });
    fireEvent.change(searchInput, { target: { value: "chess" } });

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Search results" })).toBeInTheDocument();
      expect(screen.getByText("Chess Engine")).toBeInTheDocument();
    });
  });

  it("shows empty state when no apps match the query", async () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    const searchInput = screen.getByRole("combobox", { name: "Search apps" });
    fireEvent.change(searchInput, { target: { value: "zzznomatch" } });

    await waitFor(() => {
      expect(screen.getByText(/No apps match/)).toBeInTheDocument();
    });
  });

  it("focuses the next result on ArrowDown in search", async () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    const searchInput = screen.getByRole("combobox", { name: "Search apps" });
    fireEvent.change(searchInput, { target: { value: "a" } }); // matches both

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    const firstOption = screen.getAllByRole("option")[0];
    expect(firstOption?.querySelector("button")).toHaveFocus();
  });

  it("shows quick action links for store, learn, and vibe-code", () => {
    render(<AppDrawer />, { wrapper: createWrapper() });
    openDrawer();

    expect(screen.getByRole("button", { name: /Browse store/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Learn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vibe Code/i })).toBeInTheDocument();
  });
});
