import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CookieConsent } from "@/components/CookieConsent";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderAndReveal() {
    render(<CookieConsent />);
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
  }

  it("renders consent region when no prior consent", async () => {
    await renderAndReveal();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("does not render when consent is already accepted", async () => {
    localStorage.setItem("cookie_consent", "accepted");
    render(<CookieConsent />);
    expect(screen.queryByRole("region", { name: /cookie/i })).not.toBeInTheDocument();
  });

  it("does not render when consent is already rejected", async () => {
    localStorage.setItem("cookie_consent", "rejected");
    render(<CookieConsent />);
    expect(screen.queryByRole("region", { name: /cookie/i })).not.toBeInTheDocument();
  });

  it("renders cookie consent title", async () => {
    await renderAndReveal();
    expect(screen.getByText("We use cookies")).toBeInTheDocument();
  });

  it("shows accept and reject buttons", async () => {
    await renderAndReveal();
    expect(screen.getByText("Accept All")).toBeInTheDocument();
    expect(screen.getByText("Necessary Only")).toBeInTheDocument();
  });

  it("clicking Accept All hides the dialog", async () => {
    await renderAndReveal();
    fireEvent.click(screen.getByText("Accept All"));
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    expect(localStorage.getItem("cookie_consent")).toBe("accepted");
  });

  it("clicking Necessary Only hides the dialog", async () => {
    await renderAndReveal();
    fireEvent.click(screen.getByText("Necessary Only"));
    expect(screen.queryByText("We use cookies")).not.toBeInTheDocument();
    expect(localStorage.getItem("cookie_consent")).toBe("rejected");
  });

  it("has Cookie Policy link pointing to /privacy", async () => {
    await renderAndReveal();
    const link = screen.getByText("Cookie Policy").closest("a");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("dialog starts hidden then becomes visible after 1000ms delay", async () => {
    const { container } = render(<CookieConsent />);
    // Before delay fires - should have opacity-0 class
    const dialogBefore = container.querySelector("[role='region']");
    expect(dialogBefore?.className).toContain("opacity-0");

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const dialogAfter = container.querySelector("[role='region']");
    expect(dialogAfter?.className).toContain("opacity-100");
  });
});
