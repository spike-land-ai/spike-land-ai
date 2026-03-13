import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "../hooks/useAnalytics";
import { useDarkMode } from "../hooks/useDarkMode";
import { useAuth } from "../hooks/useAuth";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { usePageLoadCounter } from "../hooks/usePageLoadCounter";
import { useDevMode } from "@spike-land-ai/block-website/core";
import { LoginButton } from "../components/LoginButton";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { AppFooter } from "../components/AppFooter";
import { CookieConsent } from "../components/CookieConsent";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { WelcomeModal } from "../components/WelcomeModal";
import { QuizPersonaBanner } from "../components/quiz/QuizPersonaBanner";
import { apiUrl } from "../../core-logic/api";
import { initGoogleAds } from "../../core-logic/google-ads";
import { resolveSupportedLanguage } from "../i18n";

const DEFAULT_OG_IMAGE = "https://spike.land/og-image.png";
const SITE_URL = "https://spike.land";

type RouteMeta = { title: string; description: string; ogImage?: string };

function buildRouteMeta(t: (key: string) => string): Record<string, RouteMeta> {
  const defaultTitle = t("meta:defaultTitle");
  const defaultDescription = t("meta:defaultDescription");
  const r = (key: string) => t(`meta:routes.${key}.title`);
  const d = (key: string) => t(`meta:routes.${key}.description`);
  return {
    "/": { title: defaultTitle, description: defaultDescription },
    "/apps": { title: r("apps"), description: d("apps") },
    "/packages": { title: r("packages"), description: d("packages") },
    "/store": { title: r("apps"), description: d("apps") },
    "/messages": { title: r("messages"), description: d("messages") },
    "/analytics": { title: r("analytics"), description: d("analytics") },
    "/status": { title: r("status"), description: d("status") },
    "/learn": { title: r("learn"), description: d("learn") },
    "/bugbook": { title: r("bugbook"), description: d("bugbook") },
    "/pricing": { title: r("pricing"), description: d("pricing") },
    "/about": { title: r("about"), description: d("about") },
    "/security": { title: r("security"), description: d("security") },
    "/terms": { title: r("terms"), description: d("terms") },
    "/privacy": { title: r("privacy"), description: d("privacy") },
    "/blog": { title: r("blog"), description: d("blog") },
    "/docs": { title: r("docs"), description: d("docs") },
    "/settings": { title: r("settings"), description: d("settings") },
    "/build": { title: r("vibeCode"), description: d("vibeCode") },
    "/vibe-code": { title: r("vibeCode"), description: d("vibeCode") },
    "/login": { title: r("login"), description: d("login") },
    "/version": { title: r("version"), description: d("version") },
    "/what-we-do": { title: r("whatWeDo"), description: d("whatWeDo") },
    "/rubik": {
      title: "Rubik 3.0 — spike.land",
      description: "Chat with Rubik 3.0 — spike.land's design + quality + product intelligence",
    },
  };
}

function buildOrganizationJsonLd(description: string) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "spike.land",
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
    description,
    sameAs: ["https://github.com/spike-land-ai"],
  });
}

function buildWebAppJsonLd(description: string) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "spike.land",
    url: SITE_URL,
    description,
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
}

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

const NAV_LINK_ROUTES = [
  { to: "/apps", key: "apps" },
  { to: "/vibe-code", key: "vibeCode" },
  { to: "/rubik", key: "rubik3", label: "Rubik 3.0" },
  { to: "/pricing", key: "pricing" },
  { to: "/docs", key: "docs" },
  { to: "/status", key: "status" },
  { to: "/blog", key: "blog" },
  { to: "/about", key: "about" },
] as const;

export function RootLayout() {
  useAnalytics();
  usePageLoadCounter();
  const { theme, setTheme } = useDarkMode();
  useAuth();
  const { isDeveloper } = useDevMode();
  const { t, i18n } = useTranslation(["common", "nav", "meta"]);
  const resolvedLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  const navLinks = useMemo(
    () =>
      NAV_LINK_ROUTES.map((route) => ({
        to: route.to,
        label: "label" in route && route.label ? route.label : t(`nav:${route.key}`),
      })),
    [t],
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const mobileNavRef = useFocusTrap(mobileNavOpen, closeMobileNav);
  const location = useRouterState({ select: (s) => s.location });
  const { pathname, searchStr } = location;

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
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
    const defaultDescription = t("meta:defaultDescription");
    injectJsonLd("jsonld-organization", buildOrganizationJsonLd(defaultDescription));
    injectJsonLd("jsonld-webapp", buildWebAppJsonLd(defaultDescription));
  }, [t]);

  useEffect(() => {
    const ROUTE_META = buildRouteMeta(t);
    // Match exact path first, then strip dynamic segments for a best-effort match
    let meta = ROUTE_META[pathname] ??
      ROUTE_META[pathname.replace(/\/[^/]+$/, "")] ?? {
        title: t("meta:defaultTitle"),
        description: t("meta:defaultDescription"),
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
      pathname !== "/packages/qa-studio/ui" &&
      pathname !== "/packages/ai-gateway/ui"
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
      document.head.appendChild(ogLocale);
    }
    ogLocale.content = resolvedLanguage === "hu" ? "hu_HU" : "en_US";
    document.documentElement.lang = resolvedLanguage;

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
  }, [pathname, resolvedLanguage, searchStr, t]);

  return (
    <div className="app-shell relative flex min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-2 focus:m-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-[var(--ring-color)]"
      >
        {t("common:skipToContent")}
      </a>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/86 backdrop-blur-xl">
          <div className="rubik-container flex h-14 lg:h-[4.5rem] items-center justify-between gap-6">
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
                    {t("common:mcpNativePlatform")}
                  </p>
                </div>
              </Link>
              <nav className="hidden lg:flex items-center gap-1.5" aria-label={t("common:mainNav")}>
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
                {t("common:toolsOnline")}
              </div>
              {isDeveloper && <ThemeSwitcher theme={theme} setTheme={setTheme} />}
              <LanguageSwitcher />
              <LoginButton />
              {/* Mobile hamburger */}
              <button
                type="button"
                className="flex items-center justify-center rounded-2xl border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                aria-label={mobileNavOpen ? t("common:closeNavMenu") : t("common:openNavMenu")}
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
            className="glass-panel fixed inset-0 z-40 flex flex-col gap-4 px-6 pt-20 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("common:mobileNav")}
          >
            <nav aria-label={t("common:mobileNavLinks")} className="rubik-panel p-4">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  aria-current={pathname === to ? "page" : undefined}
                  className={`block rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
                    pathname === to
                      ? "bg-[var(--card-bg)] text-foreground shadow-[var(--panel-shadow)]"
                      : "text-muted-foreground hover:bg-[var(--card-bg)] hover:text-foreground"
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main
          id="main-content"
          className="flex-1 min-h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-4.5rem)] overflow-x-hidden pb-8"
        >
          <noscript>
            <div className="p-8 text-center">
              <h1>{t("common:jsRequired")}</h1>
              <p>{t("common:jsRequiredDesc")}</p>
            </div>
          </noscript>
          {pathname !== "/quiz" && (
            <div className="rubik-container pt-4">
              <QuizPersonaBanner />
            </div>
          )}
          <Outlet />
        </main>

        <AppFooter />
        <CookieConsent />
        <WelcomeModal userName={null} />
      </div>
    </div>
  );
}
