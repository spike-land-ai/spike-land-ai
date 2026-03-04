import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAuth } from "@/hooks/useAuth";
import { LoginButton } from "@/components/LoginButton";

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
    description: "Learn about spike.land, the MCP-first AI development platform. Our mission, team, and the technology powering 80+ AI tools on Cloudflare Workers.",
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
      description: "50 messages per day, free-tier tools, bug reporting, community support",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      description: "500 messages per day, pro tools, BYOK support, natural language chat, priority bug reporting",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "99",
      priceCurrency: "USD",
      description: "Unlimited messages, all tools, priority support, early access, bug bounty eligibility",
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

export function RootLayout() {
  useAnalytics();
  useDarkMode();
  useAuth();

  const location = useRouterState({ select: (s) => s.location });
  const { pathname, searchStr } = location;

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
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-card/80 backdrop-blur-md px-6">
          <div className="flex flex-1 items-center justify-between">
            <Link to="/" className="text-xl font-bold">spike.land</Link>
            <LoginButton />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
