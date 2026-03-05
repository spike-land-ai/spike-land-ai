import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAuth } from "@/hooks/useAuth";
import { LoginButton } from "@/components/LoginButton";
import { AppFooter } from "@/components/AppFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

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
  "/tools": {
    title: "AI Tools Registry - spike.land",
    description: "Browse 80+ MCP tools on spike.land. Find tools for code review, image generation, data analysis, and more.",
  },
  "/apps": {
    title: "MCP Tools - spike.land",
    description: "Browse and interact with Model Context Protocol tools on spike.land. Connect AI agents to real-world data and actions.",
  },
  "/store": {
    title: "App Store - spike.land",
    description: "Discover and install AI-powered applications from the spike.land store. Chess engines, QA studio, data visualization, and more.",
  },
  "/messages": {
    title: "Messages - spike.land",
    description: "Real-time messaging and collaboration on spike.land. Chat with teammates, share code, and coordinate AI workflows.",
  },
  "/analytics": {
    title: "Analytics - spike.land",
    description: "View usage analytics and insights for your spike.land apps. Track tool invocations, message volume, and performance metrics.",
  },
  "/learn": {
    title: "Learn & Verify - spike.land",
    description: "Learn from any content and prove your understanding through interactive AI-powered quizzes. Earn verifiable badges.",
  },
  "/bugbook": {
    title: "Bugbook - spike.land",
    description: "Public bug tracker with ELO ranking on spike.land. Report, track, and fix bugs with community-driven prioritization.",
  },
  "/pricing": {
    title: "Pricing - spike.land | Free, Pro $29, Business $99",
    description: "Simple, transparent pricing for spike.land. Free plan for individuals, Pro at $29/mo, Business at $99/mo with unlimited access and priority support.",
  },
  "/about": {
    title: "About spike.land - MCP-First AI Platform",
    description: "Learn about spike.land — who we are, our mission, and how we're building an open platform for AI tools.",
  },
  "/terms": {
    title: "Terms of Service - spike.land",
    description: "Read the spike.land Terms of Service. Learn about acceptable use, subscription billing, intellectual property rights, and our SaaS agreement.",
  },
  "/privacy": {
    title: "Privacy Policy - spike.land",
    description: "spike.land Privacy Policy. GDPR-aware data handling, cookies, third-party services (Stripe, Cloudflare), and your rights as a user.",
  },
  "/blog": {
    title: "Blog - spike.land",
    description: "Articles, tutorials, and engineering insights from the spike.land team. Learn about MCP, AI development, and edge computing.",
  },
  "/docs": {
    title: "Documentation - spike.land",
    description: "Technical documentation, API reference, MCP tools guide, and architecture overview for spike.land.",
  },
  "/settings": {
    title: "Settings - spike.land",
    description: "Configure your spike.land account, billing, API keys, and preferences.",
  },
  "/login": {
    title: "Sign In - spike.land",
    description: "Sign in to spike.land with GitHub or Google to access your AI development platform.",
  },
  "/version": {
    title: "Version - spike.land",
    description: "View build version, deployed assets, and download links for spike.land.",
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
      description: "500 requests per day, pro tools, BYOK support, natural language chat, priority bug reporting",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "99",
      priceCurrency: "USD",
      description: "Unlimited requests, all tools, priority support, early access, bug bounty eligibility",
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

const NAV_LINKS = [
  { to: "/tools", label: "Tools" },
  { to: "/store", label: "Store" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
] as const;

export function RootLayout() {
  useAnalytics();
  const { theme, setTheme } = useDarkMode();
  useAuth();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useRouterState({ select: (s) => s.location });
  const { pathname, searchStr } = location;

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Inject JSON-LD structured data once on mount
  useEffect(() => {
    injectJsonLd("jsonld-organization", ORGANIZATION_JSON_LD);
    injectJsonLd("jsonld-webapp", WEB_APP_JSON_LD);
  }, []);

  useEffect(() => {
    // Match exact path first, then strip dynamic segments for a best-effort match
    let meta = ROUTE_META[pathname] ??
      ROUTE_META[pathname.replace(/\/[^/]+$/, "")] ?? {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
    };

    // Special handling for dynamic app pages
    if (pathname.startsWith("/apps/") && pathname !== "/apps/new") {
      const appId = pathname.split("/")[2];
      const search = new URLSearchParams(searchStr);
      const tab = search.get("tab") || "Overview";
      const appName = appId ? appId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Tool";
      meta = {
        title: `${appName} (${tab}) — spike.land`,
        description: `Explore ${appName} on spike.land — the MCP-first AI development platform.`,
      };
    }

    const ogImage = meta.ogImage ?? DEFAULT_OG_IMAGE;
    const canonicalUrl = `${SITE_URL}${pathname === "/" ? "" : pathname}${searchStr}`;

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
  }, [pathname, searchStr]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-2 focus:m-2 focus:rounded"
      >
        Skip to main content
      </a>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-card/80 backdrop-blur-md px-6">
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold">spike.land</Link>
              <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
                {NAV_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    aria-current={pathname === to ? "page" : undefined}
                    className={`text-sm font-medium transition-colors hover:text-foreground ${
                      pathname === to ? "text-foreground underline underline-offset-4 decoration-primary/50" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <button
                type="button"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-md hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-[0.98]"
                aria-label="Search site"
                onClick={() => alert("Search coming soon!")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span>Search...</span>
                <kbd className="hidden lg:inline-flex items-center gap-1 font-sans text-[10px] bg-background border border-border rounded px-1.5 py-0.5 opacity-70">
                  ⌘K
                </kbd>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
              <LoginButton />
              {/* Mobile hamburger */}
              <button
                type="button"
                className="md:hidden flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
              >
                {mobileNavOpen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div
            id="mobile-nav"
            className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex flex-col pt-20 px-6 gap-4"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <nav aria-label="Mobile navigation links">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`block py-3 text-lg font-medium border-b border-border transition-colors hover:text-foreground ${
                    pathname === to ? "text-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-x-hidden">
          <noscript>
            <div className="p-8 text-center">
              <h1>JavaScript Required</h1>
              <p>spike.land requires JavaScript to run. Please enable JavaScript in your browser settings.</p>
            </div>
          </noscript>
          <Outlet />
        </main>

        <AppFooter />
        <CookieConsent />
      </div>
    </div>
  );
}
