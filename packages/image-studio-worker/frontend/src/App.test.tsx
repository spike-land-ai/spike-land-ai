import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { LightboxProvider } from "./contexts/LightboxContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

vi.mock("@/lib/auth", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: null, isPending: false, error: null })),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

vi.mock("@/services/storage", () => ({
  storage: {
    clearAllLocalData: vi.fn(),
  },
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders landing page when not logged in", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText(/CREATE WITH/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sandbox/i })).toBeInTheDocument();
    });
  });

  it("handles Sandbox mode activation", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    const sandboxBtn = await screen.findByRole("button", { name: /Sandbox/i });
    fireEvent.click(sandboxBtn);

    await waitFor(() => {
      expect(screen.getByText(/Node/i)).toBeInTheDocument();
    });
  });

  it("renders studio when logged in", async () => {
    const { authClient } = await import("@/lib/auth");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { name: "Test User", email: "test@example.com", image: null } },
      isPending: false,
      error: null,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Wait for the workspace header to show up, meaning we successfully bypassed the landing page
    await waitFor(() => {
      expect(screen.getByText(/Node/i)).toBeInTheDocument();
    });

    // We can click the first button element that contains the initial "T"
    const userMenuButtons = await screen.findAllByText("T");
    fireEvent.click(userMenuButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  it("handles hash change for workspace navigation", async () => {
    const { authClient } = await import("@/lib/auth");
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { name: "Test User", email: "test@example.com", image: null } },
      isPending: false,
      error: null,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Initial render sets hash to studio, but let's change it
    window.location.hash = "#/gallery";
    fireEvent(window, new HashChangeEvent("hashchange"));

    // Ensure hash reflects in DOM
    await waitFor(() => {
      const workspaceHeaders = screen.getAllByText(/gallery/i);
      expect(workspaceHeaders.length).toBeGreaterThan(0);
    });
  });
});
