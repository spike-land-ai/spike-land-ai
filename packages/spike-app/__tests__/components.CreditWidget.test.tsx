import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CreditWidget } from "@/components/CreditWidget";

describe("CreditWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading skeleton initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const { container } = render(<CreditWidget />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("Unable to load your credit balance at this time.")).toBeInTheDocument();
    });
  });

  it("shows error state when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("Unable to load your credit balance at this time.")).toBeInTheDocument();
    });
  });

  it("renders credit balance data on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        balance: 1500,
        dailyLimit: 2000,
        tier: "pro",
        usedToday: 500,
      }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("1,500")).toBeInTheDocument();
      expect(screen.getByText("credits remaining")).toBeInTheDocument();
    });
  });

  it("shows tier badge", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 100, dailyLimit: 1000, tier: "free", usedToday: 0 }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("free")).toBeInTheDocument();
    });
  });

  it("shows usage meter when dailyLimit > 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 500, dailyLimit: 1000, tier: "basic", usedToday: 300 }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute("aria-valuenow", "30");
    });
  });

  it("shows unlimited message when dailyLimit is 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 9999, dailyLimit: 0, tier: "enterprise", usedToday: 0 }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("Unlimited daily credits included")).toBeInTheDocument();
    });
  });

  it("shows used today and daily limit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 700, dailyLimit: 1000, tier: "pro", usedToday: 300 }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("300 used today")).toBeInTheDocument();
      expect(screen.getByText("1,000 daily limit")).toBeInTheDocument();
    });
  });

  it("shows Buy More Credits link", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 100, dailyLimit: 1000, tier: "free", usedToday: 10 }),
    });
    render(<CreditWidget />);
    await waitFor(() => {
      expect(screen.getByText("Buy More Credits")).toBeInTheDocument();
    });
  });

  it("uses destructive bar color when remaining < 20%", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 50, dailyLimit: 1000, tier: "free", usedToday: 900 }),
    });
    const { container } = render(<CreditWidget />);
    await waitFor(() => {
      const bar = container.querySelector(".bg-destructive");
      expect(bar).toBeInTheDocument();
    });
  });

  it("uses warning bar color when remaining between 20-50%", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 300, dailyLimit: 1000, tier: "free", usedToday: 700 }),
    });
    const { container } = render(<CreditWidget />);
    await waitFor(() => {
      const bar = container.querySelector(".bg-warning");
      expect(bar).toBeInTheDocument();
    });
  });

  it("uses success bar color when remaining > 50%", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 600, dailyLimit: 1000, tier: "pro", usedToday: 100 }),
    });
    const { container } = render(<CreditWidget />);
    await waitFor(() => {
      const bar = container.querySelector(".bg-success");
      expect(bar).toBeInTheDocument();
    });
  });
});
