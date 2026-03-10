// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ── Dependency mocks ──────────────────────────────────────────────────────────

vi.mock("@/ui/hooks/useAnalytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("@/core-logic/google-ads", () => ({
  trackGoogleAdsEvent: vi.fn(),
  trackMigrationConversion: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function importMocks() {
  const analytics = await import("@/ui/hooks/useAnalytics");
  const googleAds = await import("@/core-logic/google-ads");
  return {
    trackAnalyticsEvent: vi.mocked(analytics.trackAnalyticsEvent),
    trackGoogleAdsEvent: vi.mocked(googleAds.trackGoogleAdsEvent),
    trackMigrationConversion: vi.mocked(googleAds.trackMigrationConversion),
  };
}

async function renderPage() {
  const { MigratePage } = await import("@/ui/routes/migrate");
  return render(<MigratePage />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MigratePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Render smoke tests ──────────────────────────────────────────────────────

  describe("renders key content", () => {
    it("renders the hero heading", async () => {
      await renderPage();
      expect(
        screen.getByRole("heading", { name: /From 40 Minutes to 4 Seconds/i }),
      ).toBeInTheDocument();
    });

    it("renders three tier cards", async () => {
      await renderPage();
      expect(screen.getByText("The Blog Post")).toBeInTheDocument();
      expect(screen.getByText("The Script")).toBeInTheDocument();
      expect(screen.getByText("The MCP Server")).toBeInTheDocument();
    });

    it("renders the FAQ section", async () => {
      await renderPage();
      expect(
        screen.getByText(/Will my Next.js API routes survive the migration/i),
      ).toBeInTheDocument();
    });

    it("renders social proof metrics", async () => {
      await renderPage();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText(/Next.js projects migrated/i)).toBeInTheDocument();
    });

    it("renders the why-migrate section", async () => {
      await renderPage();
      expect(
        screen.getByRole("heading", { name: /The case for leaving Next.js/i }),
      ).toBeInTheDocument();
    });

    it("renders the highlighted Best Value badge on the MCP Server tier", async () => {
      await renderPage();
      expect(screen.getByText("Best Value")).toBeInTheDocument();
    });

    it("renders CTAs for all three tiers", async () => {
      await renderPage();
      expect(screen.getByRole("button", { name: /Commission the Blog Post/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Fund the Script/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sponsor the MCP Server/i })).toBeInTheDocument();
    });
  });

  // ── Page view tracking on mount ─────────────────────────────────────────────

  describe("analytics on mount", () => {
    it("fires migration_page_view analytics event on mount", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();
      expect(trackAnalyticsEvent).toHaveBeenCalledWith("migration_page_view", {
        page: "/migrate",
      });
    });

    it("fires migration_page_view Google Ads event on mount", async () => {
      const { trackGoogleAdsEvent } = await importMocks();
      await renderPage();
      expect(trackGoogleAdsEvent).toHaveBeenCalledWith("migration_page_view", {
        page: "/migrate",
      });
    });
  });

  // ── FAQ accordion ───────────────────────────────────────────────────────────

  describe("FaqItem accordion", () => {
    it("answer is not visible before clicking the question", async () => {
      await renderPage();
      const firstQuestion = screen.getByText(/Will my Next.js API routes survive the migration/i);
      const answer = screen.queryByText(/they become Cloudflare Workers handlers/i);
      expect(firstQuestion).toBeInTheDocument();
      expect(answer).not.toBeInTheDocument();
    });

    it("reveals the answer when the question button is clicked", async () => {
      await renderPage();
      const button = screen.getByRole("button", {
        name: /Will my Next.js API routes survive the migration/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(button);

      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText(/they become Cloudflare Workers handlers/i)).toBeInTheDocument();
    });

    it("hides the answer again on second click (toggle)", async () => {
      await renderPage();
      const button = screen.getByRole("button", {
        name: /Will my Next.js API routes survive the migration/i,
      });

      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByText(/they become Cloudflare Workers handlers/i),
      ).not.toBeInTheDocument();
    });

    it("multiple FAQ items can be opened independently", async () => {
      await renderPage();
      const q1 = screen.getByRole("button", {
        name: /Will my Next.js API routes survive the migration/i,
      });
      const q2 = screen.getByRole("button", {
        name: /What about next\/image/i,
      });

      fireEvent.click(q1);
      fireEvent.click(q2);

      expect(q1).toHaveAttribute("aria-expanded", "true");
      expect(q2).toHaveAttribute("aria-expanded", "true");
    });
  });

  // ── TierCard CTA ────────────────────────────────────────────────────────────

  describe("TierCard CTA interactions", () => {
    it("tracks migration_interest analytics event when blog post CTA is clicked", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      const assignMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: { href: "", hostname: "localhost" },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.location, "href", {
        set: assignMock,
        configurable: true,
      });

      await renderPage();
      const cta = screen.getByRole("button", { name: /Commission the Blog Post/i });
      fireEvent.click(cta);

      expect(trackAnalyticsEvent).toHaveBeenCalledWith(
        "migration_interest",
        expect.objectContaining({ tier: "blog-post" }),
      );
    });

    it("calls trackMigrationConversion with blog tier when blog post CTA is clicked", async () => {
      const { trackMigrationConversion } = await importMocks();

      await renderPage();
      const cta = screen.getByRole("button", { name: /Commission the Blog Post/i });
      fireEvent.click(cta);

      expect(trackMigrationConversion).toHaveBeenCalledWith("blog", 420, "USD");
    });

    it("calls trackMigrationConversion with script tier when script CTA is clicked", async () => {
      const { trackMigrationConversion } = await importMocks();

      await renderPage();
      const cta = screen.getByRole("button", { name: /Fund the Script/i });
      fireEvent.click(cta);

      expect(trackMigrationConversion).toHaveBeenCalledWith("script", 1000, "GBP");
    });

    it("calls trackMigrationConversion with mcp tier when MCP server CTA is clicked", async () => {
      const { trackMigrationConversion } = await importMocks();

      await renderPage();
      const cta = screen.getByRole("button", { name: /Sponsor the MCP Server/i });
      fireEvent.click(cta);

      expect(trackMigrationConversion).toHaveBeenCalledWith("mcp", 10000, "USD");
    });

    it("navigates to mailto link when a tier CTA is clicked", async () => {
      const hrefValues: string[] = [];
      Object.defineProperty(window, "location", {
        value: {
          get href() {
            return hrefValues[hrefValues.length - 1] ?? "";
          },
          set href(v: string) {
            hrefValues.push(v);
          },
          hostname: "localhost",
        },
        writable: true,
        configurable: true,
      });

      await renderPage();
      const cta = screen.getByRole("button", { name: /Commission the Blog Post/i });
      fireEvent.click(cta);

      const lastHref = hrefValues[hrefValues.length - 1] ?? "";
      expect(lastHref).toContain("mailto:");
      expect(lastHref).toContain("The%20Blog%20Post");
    });
  });

  // ── Hero section analytics ──────────────────────────────────────────────────

  describe("Hero CTA link analytics", () => {
    it("tracks migration_interest with hero_cta section on 'See the options' click", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();

      const link = screen.getByRole("link", { name: /See the options/i });
      fireEvent.click(link);

      expect(trackAnalyticsEvent).toHaveBeenCalledWith("migration_interest", {
        section: "hero_cta",
      });
    });

    it("tracks migration_interest with hero_contact section on 'Ask a question first' click", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();

      const link = screen.getByRole("link", { name: /Ask a question first/i });
      fireEvent.click(link);

      expect(trackAnalyticsEvent).toHaveBeenCalledWith("migration_interest", {
        section: "hero_contact",
      });
    });
  });

  // ── Scroll depth tracking ───────────────────────────────────────────────────

  describe("scroll depth tracking", () => {
    it("tracks migration_interest with scroll_depth_60 when user scrolls past 60%", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();

      // Simulate scroll past 60% depth
      Object.defineProperty(window, "scrollY", { value: 600, writable: true, configurable: true });
      Object.defineProperty(window, "innerHeight", {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "scrollHeight", {
        value: 1000,
        writable: true,
        configurable: true,
      });

      fireEvent.scroll(window);

      expect(trackAnalyticsEvent).toHaveBeenCalledWith("migration_interest", {
        section: "scroll_depth_60",
      });
    });

    it("does not fire scroll tracking twice (only fires once)", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();

      Object.defineProperty(window, "scrollY", { value: 600, writable: true, configurable: true });
      Object.defineProperty(window, "innerHeight", {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "scrollHeight", {
        value: 1000,
        writable: true,
        configurable: true,
      });

      fireEvent.scroll(window);
      fireEvent.scroll(window);

      const scrollCalls = vi
        .mocked(trackAnalyticsEvent)
        .mock.calls.filter(
          ([, data]) => (data as { section?: string } | undefined)?.section === "scroll_depth_60",
        );
      expect(scrollCalls.length).toBe(1);
    });

    it("does not fire scroll tracking when user is below 60% depth", async () => {
      const { trackAnalyticsEvent } = await importMocks();
      await renderPage();
      trackAnalyticsEvent.mockClear();

      // Shallow scroll — only 30% depth
      Object.defineProperty(window, "scrollY", { value: 100, writable: true, configurable: true });
      Object.defineProperty(window, "innerHeight", {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "scrollHeight", {
        value: 1000,
        writable: true,
        configurable: true,
      });

      fireEvent.scroll(window);

      const scrollCalls = vi
        .mocked(trackAnalyticsEvent)
        .mock.calls.filter(
          ([, data]) => (data as { section?: string } | undefined)?.section === "scroll_depth_60",
        );
      expect(scrollCalls.length).toBe(0);
    });
  });

  // ── Structured data ─────────────────────────────────────────────────────────

  describe("structured data (LD+JSON)", () => {
    it("injects a JSON-LD Service schema script tag", async () => {
      const { container } = await renderPage();
      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();

      const json = JSON.parse(script!.textContent ?? "{}") as {
        "@type": string;
        name: string;
        offers: { "@type": string }[];
      };
      expect(json["@type"]).toBe("Service");
      expect(json.name).toContain("Migration");
      expect(Array.isArray(json.offers)).toBe(true);
      expect(json.offers.length).toBe(3);
    });
  });
});
