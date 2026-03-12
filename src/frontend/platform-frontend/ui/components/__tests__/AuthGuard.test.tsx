import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthGuard } from "../AuthGuard";

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock @tanstack/react-router Navigate
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Navigate: ({ to, search }: { to: string; search?: Record<string, string> }) => (
      <div
        data-testid="navigate"
        data-to={to}
        data-search={search ? JSON.stringify(search) : undefined}
      />
    ),
  };
});

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default location
    Object.defineProperty(window, "location", {
      value: { pathname: "/apps", search: "" },
      writable: true,
    });
  });

  describe("loading state", () => {
    it("renders loading skeleton when isLoading is true", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      render(
        <AuthGuard>
          <p>Protected</p>
        </AuthGuard>,
      );
      expect(screen.getByRole("status", { name: "Loading protected content" })).toBeInTheDocument();
    });

    it("loading skeleton has aria-live='polite'", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      render(
        <AuthGuard>
          <p>Protected</p>
        </AuthGuard>,
      );
      const skeleton = screen.getByRole("status");
      expect(skeleton).toHaveAttribute("aria-live", "polite");
    });

    it("does not render children when loading", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      render(
        <AuthGuard>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("includes screen reader announcement in loading skeleton", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      render(
        <AuthGuard>
          <p>Protected</p>
        </AuthGuard>,
      );
      expect(screen.getByText("Verifying your session, please wait.")).toBeInTheDocument();
    });
  });

  describe("unauthenticated state", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    });

    it("redirects to /login when not authenticated and no fallback", () => {
      render(
        <AuthGuard>
          <p>Protected</p>
        </AuthGuard>,
      );
      const navigate = screen.getByTestId("navigate");
      expect(navigate).toHaveAttribute("data-to", "/login");
    });

    it("includes returnUrl in redirect search params", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/apps/my-app", search: "?tab=preview" },
        writable: true,
      });
      render(
        <AuthGuard>
          <p>Protected</p>
        </AuthGuard>,
      );
      const navigate = screen.getByTestId("navigate");
      const search = JSON.parse(navigate.getAttribute("data-search") ?? "{}");
      expect(search.returnUrl).toBe("/apps/my-app?tab=preview");
    });

    it("renders fallback content when provided and not authenticated", () => {
      render(
        <AuthGuard fallback={<p>Please log in</p>}>
          <p>Protected</p>
        </AuthGuard>,
      );
      expect(screen.getByText("Please log in")).toBeInTheDocument();
      expect(screen.queryByText("Protected")).not.toBeInTheDocument();
    });

    it("does not redirect when fallback is provided", () => {
      render(
        <AuthGuard fallback={<p>Please log in</p>}>
          <p>Protected</p>
        </AuthGuard>,
      );
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    });

    it("does not render children when unauthenticated without fallback", () => {
      render(
        <AuthGuard>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  describe("authenticated state", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    });

    it("renders children when authenticated", () => {
      render(
        <AuthGuard>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("does not render loading skeleton when authenticated", () => {
      render(
        <AuthGuard>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does not redirect when authenticated", () => {
      render(
        <AuthGuard>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    });

    it("renders children wrapped in a div", () => {
      render(
        <AuthGuard>
          <p data-testid="child-content">Protected</p>
        </AuthGuard>,
      );
      const child = screen.getByTestId("child-content");
      expect(child.parentElement?.tagName).toBe("DIV");
    });

    it("does not render fallback when authenticated", () => {
      render(
        <AuthGuard fallback={<p>Login prompt</p>}>
          <p>Protected Content</p>
        </AuthGuard>,
      );
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(screen.queryByText("Login prompt")).not.toBeInTheDocument();
    });

    it("renders multiple children correctly", () => {
      render(
        <AuthGuard>
          <p>First child</p>
          <p>Second child</p>
        </AuthGuard>,
      );
      expect(screen.getByText("First child")).toBeInTheDocument();
      expect(screen.getByText("Second child")).toBeInTheDocument();
    });
  });
});
