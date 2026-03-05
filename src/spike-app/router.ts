import { lazy, Suspense, createElement } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";

function withSuspense(load: () => Promise<{ [key: string]: React.ComponentType }>, exportName: string) {
  const LazyComponent = lazy(() =>
    load().then((mod) => ({ default: mod[exportName] as React.ComponentType }))
  );
  return function SuspenseWrapper() {
    return createElement(
      Suspense,
      {
        fallback: createElement(
          "div",
          { className: "flex items-center justify-center py-20" },
          createElement("div", {
            className:
              "h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary",
          })
        ),
      },
      createElement(LazyComponent)
    );
  };
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: withSuspense(() => import("./routes/index"), "IndexPage"),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: withSuspense(() => import("./routes/about"), "AboutPage"),
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: withSuspense(() => import("./routes/analytics"), "AnalyticsPage"),
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
  component: withSuspense(() => import("./routes/privacy"), "PrivacyPage"),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: withSuspense(() => import("./routes/terms"), "TermsPage"),
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
  component: withSuspense(() => import("./routes/store"), "StorePage"),
});

const versionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/version",
  component: withSuspense(() => import("./routes/version"), "VersionPage"),
});

// Apps routes
const appsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps",
});

const appsIndexRoute = createRoute({
  getParentRoute: () => appsRoute,
  path: "/",
  component: withSuspense(() => import("./routes/apps/index"), "AppsIndexPage"),
});

const appsNewRoute = createRoute({
  getParentRoute: () => appsRoute,
  path: "new",
  component: withSuspense(() => import("./routes/apps/new"), "AppsNewPage"),
});

const appsQaStudioRoute = createRoute({
  getParentRoute: () => appsRoute,
  path: "qa-studio",
  component: withSuspense(() => import("./routes/apps/qa-studio"), "QaStudioPage"),
});

const appDetailRoute = createRoute({
  getParentRoute: () => appsRoute,
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
  component: withSuspense(() => import("./routes/docs/index"), "DocsIndexPage"),
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
  component: withSuspense(() => import("./routes/blog/index"), "BlogIndexPage"),
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
  component: withSuspense(() => import("./routes/bugbook/index"), "BugbookIndexPage"),
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

// Dashboard routes
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  component: withSuspense(() => import("./routes/dashboard/index"), "DashboardPage"),
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
  component: withSuspense(() => import("./routes/learn/index"), "LearnIndexPage"),
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
});

const messagesIndexRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: "/",
  component: withSuspense(() => import("./routes/messages/index"), "MessagesIndexPage"),
});

const messageThreadRoute = createRoute({
  getParentRoute: () => messagesRoute,
  path: "$userId",
  component: withSuspense(() => import("./routes/messages/$userId"), "MessageThreadPage"),
});

// Tools routes
const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools",
});

const toolsIndexRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: "/",
  component: withSuspense(() => import("./routes/tools/index"), "ToolsIndexPage"),
});

const toolsCategoryRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: "$toolName",
  component: withSuspense(() => import("./routes/tools/$toolName"), "ToolsCategoryPage"),
});

// MCP routes
const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mcp",
});

const mcpIndexRoute = createRoute({
  getParentRoute: () => mcpRoute,
  path: "/",
  component: withSuspense(() => import("./routes/mcp/index"), "McpPage"),
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

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  cockpitRoute,
  aboutRoute,
  analyticsRoute,
  callbackRoute,
  loginRoute,
  privacyRoute,
  termsRoute,
  settingsRoute,
  pricingRoute,
  storeRoute,
  versionRoute,
  appsRoute.addChildren([appsIndexRoute, appsNewRoute, appsQaStudioRoute, appDetailRoute]),
  docsRoute.addChildren([docsIndexRoute, docsSlugRoute]),
  blogRoute.addChildren([blogIndexRoute, blogPostRoute]),
  bugbookRoute.addChildren([
    bugbookIndexRoute,
    bugbookDetailRoute,
    bugbookLeaderboardRoute,
  ]),
  dashboardRoute.addChildren([dashboardIndexRoute, bazdmegDashboardRoute]),
  learnRoute.addChildren([learnIndexRoute, learnSessionRoute, learnBadgeRoute]),
  messagesRoute.addChildren([messagesIndexRoute, messageThreadRoute]),
  toolsRoute.addChildren([toolsIndexRoute, toolsCategoryRoute]),
  mcpRoute.addChildren([mcpIndexRoute, mcpAuthorizeRoute]),
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
