import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useDarkMode } from "@/hooks/useDarkMode";
import { LoginButton } from "@/components/LoginButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const DEFAULT_TITLE = "spike.land - AI Development Platform";
const DEFAULT_DESCRIPTION =
  "Build, deploy, and manage AI-powered applications with real-time collaboration";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/tools": {
    title: "Tools - spike.land",
    description: "Browse and manage AI tools on the spike.land platform",
  },
  "/apps": {
    title: "MCP Tools - spike.land",
    description: "Browse and interact with MCP tools on the spike.land platform",
  },
  "/store": {
    title: "Store - spike.land",
    description: "Discover and install AI tools and applications from the spike.land store",
  },
  "/messages": {
    title: "Messages - spike.land",
    description: "Real-time messaging and collaboration on spike.land",
  },
  "/analytics": {
    title: "Analytics - spike.land",
    description: "View usage analytics and insights for your spike.land apps",
  },
  "/learn": {
    title: "Learn & Verify - spike.land",
    description: "Learn from any content and prove your understanding through interactive quizzes",
  },
  "/bugbook": {
    title: "Bugbook - spike.land",
    description: "Public bug tracker with ELO ranking - report, track, and fix bugs",
  },
  "/pricing": {
    title: "Pricing - spike.land",
    description: "Simple, transparent pricing for spike.land — Free, Pro, and Elite plans",
  },
  "/settings": {
    title: "Settings - spike.land",
    description: "Configure your spike.land account and preferences",
  },
  "/login": {
    title: "Sign In - spike.land",
    description: "Sign in to spike.land to access your AI development platform",
  },
  "/version": {
    title: "Version - spike.land",
    description: "View build version, deployed assets, and download links for spike.land",
  },
};

const navItems = [
  { to: "/blog", label: "Blog" },
  { to: "/tools", label: "Tools" },
  { to: "/apps", label: "MCP Tools" },
  { to: "/store", label: "Store" },
  { to: "/pricing", label: "Pricing" },
  { to: "/learn", label: "Learn" },
  { to: "/messages", label: "Messages" },
  { to: "/analytics", label: "Analytics" },
  { to: "/bugbook", label: "Bugbook" },
  { to: "/dashboard/bazdmeg", label: "BAZDMEG" },
  { to: "/settings", label: "Settings" },
] as const;

export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAnalytics();
  const { theme, setTheme } = useDarkMode();

  const location = useRouterState({ select: (s) => s.location });
  const { pathname, searchStr } = location;

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
        description: `Explore ${appName} on spike.land — the AI multi-agent operating system.`,
      };
    }

    document.title = meta.title;

    const descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descEl) descEl.content = meta.description;

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = meta.title;

    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = meta.description;

    const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twTitle) twTitle.content = meta.title;

    const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twDesc) twDesc.content = meta.description;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      canonical.href = `https://spike.land${pathname === "/" ? "" : pathname}${searchStr}`;
    }

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.content = `https://spike.land${pathname === "/" ? "" : pathname}${searchStr}`;
    }
  }, [pathname, searchStr]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-card shadow-lg transition-transform lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } border-r border-border`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link to="/" className="text-xl font-bold hover:opacity-80" onClick={() => setSidebarOpen(false)}>spike.land</Link>
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted [&.active]:bg-accent [&.active]:text-primary"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-border p-4">
          <LoginButton />
        </div>
      </aside>

      {/* Top header — always visible */}
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-card px-6">
        {/* Mobile hamburger */}
        <button onClick={() => setSidebarOpen(true)} className="rounded p-2 hover:bg-muted lg:hidden" aria-label="Open navigation menu">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="text-xl font-bold hover:opacity-80 lg:mr-8">spike.land</Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted [&.active]:bg-accent [&.active]:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
          <LoginButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
