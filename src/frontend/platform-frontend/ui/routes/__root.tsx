import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnalytics } from "../hooks/useAnalytics";
import { useDarkMode } from "../hooks/useDarkMode";
import { useAuth } from "../hooks/useAuth";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { usePageLoadCounter } from "../hooks/usePageLoadCounter";
import { useDevMode } from "@spike-land-ai/block-website/core";
import { LoginButton } from "../components/LoginButton";
import { AppFooter } from "../components/AppFooter";
import { CookieConsent } from "../components/CookieConsent";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { WelcomeModal } from "../components/WelcomeModal";
import { apiUrl } from "../../core-logic/api";
import { initGoogleAds } from "../../core-logic/google-ads";

const DEFAULT_TITLE = "spike.land - MCP-First AI Development Platform";
const DEFAULT_DESCRIPTION =
  "Build, deploy, and manage AI-powered applications with 80+ MCP tools, real-time collaboration, and edge deployment on Cloudflare Workers.";
const DEFAULT_OG_IMAGE = "https://spike.land/og-image.png";
const SITE_URL = "https://spike.land";

const ROUTE_META: Record<string, { title: string; description: string; ogImage?: string }> = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  "/apps": {
    title: "App Store - spike.land",
    description:
      "Discover and install AI-powered applications from the spike.land store. Chess engines, QA studio, data visualization, and more.",
  },
  "/packages": {
    title: "MCP Packages - spike.land",
    description:
      "Inspect MCP package details, terminals, and implementation surfaces behind spike.land apps.",
  },
  "/store": {
    title: "App Store - spike.land",
    description:
      "Discover and install AI-powered applications from the spike.land store. Chess engines, QA studio, data visualization, and more.",
  },
  "/messages": {
    title: "Messages - spike.land",
    description:
      "Real-time messaging and collaboration on spike.land. Chat with teammates, share code, and coordinate AI workflows.",
  },
  "/analytics": {
    title: "Analytics - spike.land",
    description:
      "View usage analytics and insights for your spike.land apps. Track tool invocations, message volume, and performance metrics.",
  },
  "/status": {
    title: "System Status - spike.land",
    description:
      "Historical system status for spike.land services. Review requests per minute, min and max request time, mean latency, and deviation from the mean.",
  },
  "/learn": {
    title: "Learn & Verify - spike.land",
    description:
      "Learn from any content and prove your understanding through interactive AI-powered quizzes. Earn verifiable badges.",
  },
  "/bugbook": {
    title: "Bugbook - spike.land",
    description:
      "Public bug tracker with ELO ranking on spike.land. Report, track, and fix bugs with community-driven prioritization.",
  },
  "/pricing": {
    title: "Pricing - spike.land | Free, Pro $29, Business $99",
    description:
      "Simple, transparent pricing for spike.land. Free plan for individuals, Pro at $29/mo, Business at $99/mo with unlimited access and priority support.",
  },
  "/about": {
    title: "About spike.land - MCP-First AI Platform",
    description:
      "Learn about spike.land — who we are, our mission, and how we're building an open platform for AI tools.",
  },
  "/security": {
    title: "Security - spike.land",
    description:
      "Security practices, disclosure policy, and platform hardening details for spike.land.",
  },
  "/terms": {
    title: "Terms of Service - spike.land",
    description:
      "Read the spike.land Terms of Service. Learn about acceptable use, subscription billing, intellectual property rights, and our SaaS agreement.",
  },
  "/privacy": {
    title: "Privacy Policy - spike.land",
    description:
      "spike.land Privacy Policy. GDPR-aware data handling, cookies, third-party services (Stripe, Cloudflare), and your rights as a user.",
  },
  "/blog": {
    title: "Blog - spike.land",
    description:
      "Articles, tutorials, and engineering insights from the spike.land team. Learn about MCP, AI development, and edge computing.",
  },
  "/docs": {
    title: "Documentation - spike.land",
    description:
      "Technical documentation, API reference, MCP tools guide, and architecture overview for spike.land.",
  },
  "/settings": {
    title: "Settings - spike.land",
    description: "Configure your spike.land account, billing, API keys, and preferences.",
  },
  "/build": {
    title: "vibe-code - Chat-Native MCP App Builder | spike.land",
    description:
      "See how vibe-code turns every MCP app into a chat-native product surface with spike-chat, terminal execution, MDX app views, and MCP server editing.",
  },
  "/vibe-code": {
    title: "vibe-code - Chat-Native MCP App Builder | spike.land",
    description:
      "See how vibe-code turns every MCP app into a chat-native product surface with spike-chat, terminal execution, MDX app views, and MCP server editing.",
  },
  "/login": {
    title: "Sign In - spike.land",
    description:
      "Sign in to spike.land with GitHub or Google to access your AI development platform.",
  },
  "/version": {
    title: "Version - spike.land",
    description: "View build version, deployed assets, and download links for spike.land.",
  },
  "/what-we-do": {
    title: "What We Do - spike.land | MCP-First AI Platform",
    description:
      "Explore spike.land's 80+ MCP tools across 11 domains. Code intelligence, image studio, analytics, authentication, and more — all edge-deployed.",
  },
};

const ORGANIZATION_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "spike.land",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description: DEFAULT_DESCRIPTION,
  sameAs: ["https://github.com/spike-land-ai"],
});

const WEB_APP_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "spike.land",
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "50 requests per day, free-tier tools, bug reporting, community support",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      description:
        "500 requests per day, pro tools, BYOK support, natural language chat, priority bug reporting",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "99",
      priceCurrency: "USD",
      description:
        "Unlimited requests, all tools, priority support, early access, bug bounty eligibility",
    },
  ],
});

function injectJsonLd(id: string, content: string) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = content;
}

const BASE_NAV_LINKS = [
  { to: "/apps", label: "Apps" },
  { to: "/vibe-code", label: "Vibe Code" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
  { to: "/status", label: "Status" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
] as const;

export function RootLayout() {
  useAnalytics();
  usePageLoadCounter();
  const { theme, setTheme } = useDarkMode();
  useAuth();
  const { isDeveloper } = useDevMode();

  const navLinks = useMemo(() => [...BASE_NAV_LINKS], []);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const mobileNavRef = useFocusTrap(mobileNavOpen, closeMobileNav);
  const location = useRouterState({ select: (s) => s.location });
  const { pathname, searchStr } = location;

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Inject JSON-LD structured data and RSS link once on mount
  useEffect(() => {
    injectJsonLd("jsonld-organization", ORGANIZATION_JSON_LD);
    injectJsonLd("jsonld-webapp", WEB_APP_JSON_LD);
    initGoogleAds();

    if (!document.querySelector('link[type="application/rss+xml"]')) {
      const rssLink = document.createElement("link");
      rssLink.rel = "alternate";
      rssLink.type = "application/rss+xml";
      rssLink.title = "spike.land Blog";
      rssLink.href = apiUrl("/blog/rss");
      document.head.appendChild(rssLink);
    }
  }, []);

  useEffect(() => {
    // Match exact path first, then strip dynamic segments for a best-effort match
    let meta = ROUTE_META[pathname] ??
      ROUTE_META[pathname.replace(/\/[^/]+$/, "")] ?? {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      };

    // Special handling for dynamic MCP app pages
    if (pathname.startsWith("/apps/")) {
      const appId = pathname.split("/")[2];
      const search = new URLSearchParams(searchStr);
      const surface = search.get("surface") || "overview";
      const appName = appId
        ? appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : "App";
      meta = {
        title: `${appName} (${surface}) — spike.land`,
        description: `Open ${appName} as a categorized MCP app on spike.land across chat, terminal, MDX, and overview surfaces.`,
      };
    }

    if (
      pathname.startsWith("/packages/") &&
      pathname !== "/packages/new" &&
      pathname !== "/packages/qa-studio/ui"
    ) {
      const appId = pathname.split("/")[2];
      const search = new URLSearchParams(searchStr);
      const tab = search.get("tab") || "Overview";
      const appName = appId
        ? appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : "Package";
      meta = {
        title: `${appName} Package (${tab}) — spike.land`,
        description: `Inspect the ${appName} MCP package on spike.land — package details, terminal access, and implementation context.`,
      };
    }

    const ogImage = meta.ogImage ?? DEFAULT_OG_IMAGE;
    const canonicalUrl = `${SITE_URL}${pathname === "/" ? "" : pathname}`;

    document.title = meta.title;

    const descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descEl) descEl.content = meta.description;

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = meta.title;

    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = meta.description;

    const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImg) ogImg.content = ogImage;

    const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twTitle) twTitle.content = meta.title;

    const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twDesc) twDesc.content = meta.description;

    const twImg = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twImg) twImg.content = ogImage;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = canonicalUrl;

    let ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
    if (!ogLocale) {
      ogLocale = document.createElement("meta");
      ogLocale.setAttribute("property", "og:locale");
      ogLocale.content = "en_US";
      document.head.appendChild(ogLocale);
    }

    // BreadcrumbList structured data
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const breadcrumbItems = [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        ...segments.map((seg, i) => ({
          "@type": "ListItem",
          position: i + 2,
          name: seg.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          item: `${SITE_URL}/${segments.slice(0, i + 1).join("/")}`,
        })),
      ];
      injectJsonLd(
        "jsonld-breadcrumb",
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems,
        }),
      );
    } else {
      // Homepage — remove breadcrumb if present
      const existing = document.getElementById("jsonld-breadcrumb");
      if (existing) existing.remove();
    }
  }, [pathname, searchStr]);

  return (
    <div className="app-shell relative flex min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-2 focus:m-2 focus:rounded"
      >
        Skip to main content
      </a>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/86 backdrop-blur-xl">
          <div className="rubik-container flex h-[4.5rem] items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-5">
              <Link to="/" className="flex min-w-0 items-center gap-3">
                <div className="rubik-icon-badge h-11 w-11 rounded-2xl text-sm font-semibold tracking-[-0.06em] text-foreground shadow-[var(--panel-shadow)]">
                  SL
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-semibold tracking-[-0.03em] text-foreground">
                    spike.land
                  </p>
                  <p className="hidden text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground md:block">
                    MCP-native platform
                  </p>
                </div>
              </Link>
              <nav className="hidden lg:flex items-center gap-1.5" aria-label="Main navigation">
                {navLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    aria-current={pathname === to ? "page" : undefined}
                    className={`rounded-full px-3 py-2 text-[0.82rem] font-medium tracking-[0.01em] transition-colors ${
                      pathname === to
                        ? "bg-card text-foreground shadow-[var(--panel-shadow)]"
                        : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground xl:inline-flex">
                <span className="h-2 w-2 rounded-full bg-primary" />
                80+ tools online
              </div>
              {isDeveloper && <ThemeSwitcher theme={theme} setTheme={setTheme} />}
              <LoginButton />
              {/* Mobile hamburger */}
              <button
                type="button"
                className="flex items-center justify-center rounded-2xl border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
              >
                {mobileNavOpen ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div
            ref={mobileNavRef}
            id="mobile-nav"
            className="fixed inset-0 z-40 flex flex-col gap-4 bg-background/95 px-6 pt-20 backdrop-blur-xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <nav aria-label="Mobile navigation links" className="rubik-panel p-4">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`block rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
                    pathname === to
                      ? "bg-background text-foreground shadow-[var(--panel-shadow)]"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-x-hidden pb-8">
          <noscript>
            <div className="p-8 text-center">
              <h1>JavaScript Required</h1>
              <p>
                spike.land requires JavaScript to run. Please enable JavaScript in your browser
                settings.
              </p>
            </div>
          </noscript>
          <Outlet />
        </main>

        <AppFooter />
        <CookieConsent />
        <WelcomeModal userName={null} />
      </div>
    </div>
  );
}
