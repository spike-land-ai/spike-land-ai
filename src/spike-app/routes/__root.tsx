import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
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
    title: "Apps - spike.land",
    description: "Build and deploy AI-powered applications on spike.land",
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
  { to: "/", label: "Dashboard" },
  { to: "/blog", label: "Blog" },
  { to: "/tools", label: "Tools" },
  { to: "/apps", label: "Apps" },
  { to: "/store", label: "Store" },
  { to: "/learn", label: "Learn" },
  { to: "/messages", label: "Messages" },
  { to: "/analytics", label: "Analytics" },
  { to: "/dashboard/bazdmeg", label: "BAZDMEG" },
  { to: "/settings", label: "Settings" },
] as const;

export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAnalytics();

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // Match exact path first, then strip dynamic segments for a best-effort match
    const meta = ROUTE_META[pathname] ??
      ROUTE_META[pathname.replace(/\/[^/]+$/, "")] ?? {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      };

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
      canonical.href = `https://spike.land${pathname === "/" ? "" : pathname}`;
    }

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.content = `https://spike.land${pathname === "/" ? "" : pathname}`;
    }
  }, [pathname]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-lg transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-xl font-bold">Spike</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 [&.active]:bg-blue-50 [&.active]:text-blue-700"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t p-4">
          <LoginButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b bg-white px-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded p-2 hover:bg-gray-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="ml-4 flex-1 text-lg font-bold">Spike</span>
          <LoginButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
