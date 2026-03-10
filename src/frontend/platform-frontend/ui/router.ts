import { lazy, Suspense, createElement } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { NotFoundPage } from "./routes/not-found";

function withSuspense(
  load: () => Promise<{ [key: string]: React.ComponentType }>,
  exportName: string,
) {
  const LazyComponent = lazy(() =>
    load().then((mod) => ({ default: mod[exportName] as React.ComponentType })),
  );
  return function SuspenseWrapper() {
    return createElement(
      Suspense,
      {
        fallback: createElement(
          "div",
          {
            role: "status",
            "aria-label": "Loading",
            className: "flex items-center justify-center py-20",
          },
          createElement("div", {
            className: "h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary",
            "aria-hidden": "true",
          }),
          createElement("span", { className: "sr-only" }, "Loading..."),
        ),
      },
      createElement(LazyComponent),
    );
  };
}

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundPage });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: withSuspense(() => import("../lazy-imports/routes-index.tsx"), "IndexPage"),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: withSuspense(() => import("../core-logic/about"), "AboutPage"),
});

const securityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/security",
  beforeLoad: () => {
    throw redirect({ to: "/docs/$slug", params: { slug: "security" } });
  },
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: withSuspense(() => import("./routes/analytics"), "AnalyticsPage"),
});

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/status",
  component: withSuspense(() => import("./routes/status"), "StatusPage"),
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/callback",
  component: withSuspense(() => import("./routes/callback"), "CallbackPage"),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: withSuspense(() => import("./routes/login"), "LoginPage"),
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: withSuspense(() => import("../core-logic/privacy"), "PrivacyPage"),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: withSuspense(() => import("../core-logic/terms"), "TermsPage"),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: withSuspense(() => import("./routes/settings"), "SettingsPage"),
});

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pricing",
  component: withSuspense(() => import("./routes/pricing"), "PricingPage"),
});

const storeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/store",
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/apps", search });
  },
});

const versionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/version",
  component: withSuspense(() => import("./routes/version"), "VersionPage"),
});

// Package routes
const packagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/packages",
});

const packagesIndexRoute = createRoute({
  getParentRoute: () => packagesRoute,
  path: "/",
  component: withSuspense(() => import("./routes/apps/apps-index.tsx"), "AppsIndexPage"),
});

const packagesNewRoute = createRoute({
  getParentRoute: () => packagesRoute,
  path: "new",
  component: withSuspense(() => import("./routes/apps/new"), "AppsNewPage"),
});

const packagesQaStudioRoute = createRoute({
  getParentRoute: () => packagesRoute,
  path: "qa-studio/ui",
  component: withSuspense(() => import("./routes/apps/qa-studio"), "QaStudioPage"),
});

const packageDetailRoute = createRoute({
  getParentRoute: () => packagesRoute,
  path: "$appId",
  component: withSuspense(() => import("./routes/apps/$appId"), "AppDetailPage"),
});

// Docs routes
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
});

const docsIndexRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: "/",
  component: withSuspense(() => import("./routes/docs/docs-index.tsx"), "DocsIndexPage"),
});

const docsSlugRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: "$slug",
  component: withSuspense(() => import("./routes/docs/$slug"), "DocPage"),
});

// Blog routes
const blogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog",
});

const blogIndexRoute = createRoute({
  getParentRoute: () => blogRoute,
  path: "/",
  component: withSuspense(() => import("./routes/blog/blog-index.tsx"), "BlogIndexPage"),
});

const blogPostRoute = createRoute({
  getParentRoute: () => blogRoute,
  path: "$slug",
  component: withSuspense(() => import("./routes/blog/$slug"), "BlogPostPage"),
});

// Bugbook routes
const bugbookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bugbook",
});

const bugbookIndexRoute = createRoute({
  getParentRoute: () => bugbookRoute,
  path: "/",
  component: withSuspense(() => import("./routes/bugbook/bugbook-index.tsx"), "BugbookIndexPage"),
});

const bugbookDetailRoute = createRoute({
  getParentRoute: () => bugbookRoute,
  path: "$bugId",
  component: withSuspense(() => import("./routes/bugbook/$bugId"), "BugbookDetailPage"),
});

const bugbookLeaderboardRoute = createRoute({
  getParentRoute: () => bugbookRoute,
  path: "leaderboard",
  component: withSuspense(() => import("./routes/bugbook/leaderboard"), "BugbookLeaderboardPage"),
});

const bugbookMyReportsRoute = createRoute({
  getParentRoute: () => bugbookRoute,
  path: "my-reports",
  component: withSuspense(() => import("./routes/bugbook/my-reports"), "MyReportsPage"),
});

// Dashboard routes
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Outlet,
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  component: withSuspense(() => import("../core-logic/dashboard-index.tsx"), "DashboardPage"),
});

const bazdmegDashboardRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "bazdmeg",
  component: withSuspense(() => import("./routes/dashboard/bazdmeg"), "BazdmegDashboardPage"),
});

// Learn routes
const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn",
});

const learnIndexRoute = createRoute({
  getParentRoute: () => learnRoute,
  path: "/",
  component: withSuspense(() => import("./routes/learn/learn-index.tsx"), "LearnIndexPage"),
});

const learnSessionRoute = createRoute({
  getParentRoute: () => learnRoute,
  path: "$sessionId",
  component: withSuspense(() => import("./routes/learn/$sessionId"), "LearnSessionPage"),
});

const learnBadgeRoute = createRoute({
  getParentRoute: () => learnRoute,
  path: "badge/$token",
  component: withSuspense(() => import("./routes/learn/badge/$token"), "BadgePage"),
});

// Messages routes
const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: Outlet,
});

const messagesIndexRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: "/",
  component: withSuspense(
    () => import("./routes/messages/messages-index.tsx"),
    "MessagesIndexPage",
  ),
});

const messageThreadRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: "$userId",
  component: withSuspense(() => import("./routes/messages/$userId"), "MessageThreadPage"),
});

// MCP app routes
const appsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps",
});

const appsIndexRoute = createRoute({
  getParentRoute: () => appsRoute,
  path: "/",
  component: withSuspense(() => import("./routes/store"), "StorePage"),
});

const appSessionRoute = createRoute({
  getParentRoute: () => appsRoute,
  path: "$appSlug",
  component: withSuspense(() => import("./routes/tools/$appSlug"), "AppSessionPage"),
});

const legacyToolsIndexRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools",
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/apps", search });
  },
});

const legacyToolDetailRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools/$appSlug",
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/apps/$appSlug", params, search });
  },
});

// Agency routes
const agencyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agency",
});

const agencyPortfolioRoute = createRoute({
  getParentRoute: () => agencyRoute,
  path: "portfolio",
  component: withSuspense(() => import("./agency/PortfolioPage"), "PortfolioPage"),
});

// MCP routes
const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mcp",
});

const mcpIndexRoute = createRoute({
  getParentRoute: () => mcpRoute,
  path: "/",
  component: withSuspense(() => import("./routes/mcp/mcp-index.tsx"), "McpPage"),
});

const mcpAuthorizeRoute = createRoute({
  getParentRoute: () => mcpRoute,
  path: "authorize",
  component: withSuspense(() => import("./routes/mcp/authorize"), "McpAuthorizePage"),
});

const cockpitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cockpit",
  component: withSuspense(() => import("./routes/cockpit"), "CockpitPage"),
});

// BAZDMEG Method Presentation
const bazdmegRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bazdmeg",
  component: withSuspense(() => import("./bazdmeg/BazdmegPage"), "BazdmegPage"),
});

const whatWeDoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/what-we-do",
  component: withSuspense(() => import("./routes/what-we-do"), "WhatWeDoPage"),
});

const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/build",
  beforeLoad: () => {
    throw redirect({ to: "/vibe-code" });
  },
});

const vibeCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vibe-code",
  component: withSuspense(() => import("./routes/vibe-code"), "VibeCodePage"),
});

const startChecklistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spike-land-start-checklist",
  beforeLoad: () => {
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "local.spike.land" &&
      window.location.hostname !== "localhost"
    ) {
      throw redirect({ to: "/" });
    }
  },
  component: withSuspense(
    () => import("./routes/spike-land-start-checklist"),
    "SpikeLandStartChecklistPage",
  ),
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  cockpitRoute,
  bazdmegRoute,
  whatWeDoRoute,
  vibeCodeRoute,
  buildRoute,
  legacyToolDetailRedirectRoute,
  legacyToolsIndexRedirectRoute,
  startChecklistRoute,
  aboutRoute,
  securityRoute,
  analyticsRoute,
  statusRoute,
  callbackRoute,
  loginRoute,
  privacyRoute,
  termsRoute,
  settingsRoute,
  pricingRoute,
  storeRoute,
  versionRoute,
  packagesRoute.addChildren([
    packagesIndexRoute,
    packagesNewRoute,
    packagesQaStudioRoute,
    packageDetailRoute,
  ]),
  docsRoute.addChildren([docsIndexRoute, docsSlugRoute]),
  blogRoute.addChildren([blogIndexRoute, blogPostRoute]),
  bugbookRoute.addChildren([
    bugbookIndexRoute,
    bugbookDetailRoute,
    bugbookLeaderboardRoute,
    bugbookMyReportsRoute,
  ]),
  dashboardRoute.addChildren([dashboardIndexRoute, bazdmegDashboardRoute]),
  learnRoute.addChildren([learnIndexRoute, learnSessionRoute, learnBadgeRoute]),
  messagesRoute.addChildren([messagesIndexRoute, messageThreadRoute]),
  appsRoute.addChildren([appsIndexRoute, appSessionRoute]),
  mcpRoute.addChildren([mcpIndexRoute, mcpAuthorizeRoute]),
  agencyRoute.addChildren([agencyPortfolioRoute]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
