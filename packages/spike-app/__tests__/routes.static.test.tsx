import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock hooks used by CallbackPage
vi.mock("@/ui/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn(), trackPageView: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("@/ui/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

// Mock TanStack Router Navigate for routes that use it
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

describe("Static route pages", () => {
  describe("AboutPage", () => {
    it("renders the about page heading", async () => {
      const { AboutPage } = await import("@/routes/about");
      render(<AboutPage />);
      expect(screen.getByText("About spike.land")).toBeInTheDocument();
    });

    it("renders Our Mission section", async () => {
      const { AboutPage } = await import("@/routes/about");
      render(<AboutPage />);
      expect(screen.getByText("Our Mission")).toBeInTheDocument();
    });

    it("renders GitHub link", async () => {
      const { AboutPage } = await import("@/routes/about");
      render(<AboutPage />);
      expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    });
  });

  describe("PrivacyPage", () => {
    it("renders privacy policy h1 heading", async () => {
      const { PrivacyPage } = await import("@/routes/privacy");
      const { container } = render(<PrivacyPage />);
      const h1 = container.querySelector("h1");
      expect(h1).toHaveTextContent("Privacy Policy");
    });

    it("renders GDPR rights section", async () => {
      const { PrivacyPage } = await import("@/routes/privacy");
      render(<PrivacyPage />);
      expect(screen.getByText(/Your Rights/)).toBeInTheDocument();
    });

    it("renders contact email", async () => {
      const { PrivacyPage } = await import("@/routes/privacy");
      render(<PrivacyPage />);
      expect(screen.getAllByText("zoltan.erdos@spike.land").length).toBeGreaterThan(0);
    });
  });

  describe("TermsPage", () => {
    it("renders terms of service h1 heading", async () => {
      const { TermsPage } = await import("@/routes/terms");
      const { container } = render(<TermsPage />);
      const h1 = container.querySelector("h1");
      expect(h1).toHaveTextContent("Terms of Service");
    });

    it("renders Acceptable Use section", async () => {
      const { TermsPage } = await import("@/routes/terms");
      const { container } = render(<TermsPage />);
      const headings = container.querySelectorAll("h2");
      const texts = Array.from(headings).map((h) => h.textContent);
      expect(texts.some((t) => t?.includes("Acceptable Use"))).toBe(true);
    });

    it("renders billing section", async () => {
      const { TermsPage } = await import("@/routes/terms");
      const { container } = render(<TermsPage />);
      const headings = container.querySelectorAll("h2");
      const texts = Array.from(headings).map((h) => h.textContent);
      expect(texts.some((t) => t?.includes("Subscription Billing"))).toBe(true);
    });
  });

  describe("CallbackPage", () => {
    it("renders Navigate to root", async () => {
      const { CallbackPage } = await import("@/routes/callback");
      render(<CallbackPage />);
      const nav = screen.getByTestId("navigate");
      expect(nav).toHaveAttribute("data-to", "/");
    });
  });
});
