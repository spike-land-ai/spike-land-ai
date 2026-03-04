import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useDarkMode } from "@/hooks/useDarkMode";
import { LoginButton } from "@/components/LoginButton";

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
  useDarkMode();

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
    <div className="flex h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white dark:bg-zinc-900 shadow-lg transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } dark:border-r dark:border-zinc-800`}
      >
        <div className="flex h-16 items-center gap-2 border-b dark:border-zinc-800 px-6">
          <Link to="/" className="text-xl font-bold hover:opacity-80">spike.land</Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 [&.active]:bg-blue-50 dark:[&.active]:bg-blue-900/30 [&.active]:text-blue-700 dark:[&.active]:text-blue-400"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t dark:border-zinc-800 p-4">
          <LoginButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 px-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded p-2 hover:bg-gray-100 dark:hover:bg-zinc-800" aria-label="Open navigation menu">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <Link to="/" className="ml-4 flex-1 text-lg font-bold hover:opacity-80">spike.land</Link>
          <LoginButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
