import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginButton } from "../LoginButton";

// Mock useAuth hook
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth:signIn": "Sign In",
        "auth:proMember": "Pro Member",
        "auth:accountSettings": "Account Settings",
        "auth:billingCredits": "Billing & Credits",
        "auth:logOut": "Log Out",
        "common:loading": "Loading",
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      role,
      onClick,
    }: {
      to: string;
      children: React.ReactNode;
      role?: string;
      onClick?: () => void;
      search?: unknown;
    }) => (
      <a role={role} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

// Mock Button component
vi.mock("../../shared/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => <button onClick={onClick}>{children}</button>,
}));

// Mock cn utility
vi.mock("../../../styling/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Settings: () => <svg data-testid="icon-settings" />,
  LogOut: () => <svg data-testid="icon-logout" />,
  ChevronDown: () => <svg data-testid="icon-chevron" />,
  CreditCard: () => <svg data-testid="icon-credit-card" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

describe("LoginButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders a loading spinner when isLoading is true", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: mockLogin,
        logout: mockLogout,
      });
      render(<LoginButton />);
      expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    });

    it("does not render sign in button when loading", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        login: mockLogin,
        logout: mockLogout,
      });
      render(<LoginButton />);
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  describe("unauthenticated state", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
      });
    });

    it("renders the Sign In button when not authenticated", () => {
      render(<LoginButton />);
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("calls login() when Sign In button is clicked", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByText("Sign In"));
      expect(mockLogin).toHaveBeenCalledOnce();
    });

    it("does not render the account menu button", () => {
      render(<LoginButton />);
      expect(screen.queryByRole("button", { name: /Account menu/ })).not.toBeInTheDocument();
    });
  });

  describe("authenticated state", () => {
    const mockUser = {
      sub: "u1",
      name: "Alice Johnson",
      email: "alice@example.com",
      picture: null,
      preferred_username: "Alice Johnson",
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
      });
    });

    it("renders account menu button with user name", () => {
      render(<LoginButton />);
      expect(
        screen.getByRole("button", { name: /Account menu for Alice Johnson/ }),
      ).toBeInTheDocument();
    });

    it("renders user initials when no picture", () => {
      render(<LoginButton />);
      expect(screen.getByText("AJ")).toBeInTheDocument();
    });

    it("renders user picture when available", () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, picture: "https://example.com/avatar.jpg" },
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
      });
      render(<LoginButton />);
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    it("displays user name and Pro Member label", () => {
      render(<LoginButton />);
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Pro Member")).toBeInTheDocument();
    });

    it("account menu button has aria-haspopup='menu'", () => {
      render(<LoginButton />);
      const button = screen.getByRole("button", { name: /Account menu/ });
      expect(button).toHaveAttribute("aria-haspopup", "menu");
    });

    it("account menu button has aria-expanded='false' when closed", () => {
      render(<LoginButton />);
      const button = screen.getByRole("button", { name: /Account menu/ });
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("dropdown menu is not shown initially", () => {
      render(<LoginButton />);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("opens dropdown menu when account button is clicked", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("aria-expanded is 'true' when menu is open", () => {
      render(<LoginButton />);
      const button = screen.getByRole("button", { name: /Account menu/ });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("renders user email in the dropdown header", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    it("renders Account Settings menu item", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menuitem", { name: /Account Settings/ })).toBeInTheDocument();
    });

    it("renders Billing & Credits menu item", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menuitem", { name: /Billing & Credits/ })).toBeInTheDocument();
    });

    it("renders Log Out menu item", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menuitem", { name: /Log Out/ })).toBeInTheDocument();
    });

    it("calls logout() when Log Out is clicked", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: /Log Out/ }));
      expect(mockLogout).toHaveBeenCalledOnce();
    });

    it("closes menu after clicking Log Out", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      fireEvent.click(screen.getByRole("menuitem", { name: /Log Out/ }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes menu on outside click", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes menu on Escape key press", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("uses 'U' initial when user has no name or email", () => {
      mockUseAuth.mockReturnValue({
        user: { sub: "u2", name: null, email: null, picture: null, preferred_username: null },
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
      });
      render(<LoginButton />);
      expect(screen.getByText("U")).toBeInTheDocument();
    });

    it("closes settings link menu after click", () => {
      render(<LoginButton />);
      fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
      const menuItems = screen.getAllByRole("menuitem");
      fireEvent.click(menuItems[0]); // Account Settings
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
