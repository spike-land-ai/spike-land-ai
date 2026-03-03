import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { IndexPage } from "./routes/index";
import { LoginPage } from "./routes/login";
import { CallbackPage } from "./routes/callback";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: lazyRouteComponent(() => import("./routes/dashboard/index"), "DashboardPage"),
});

const blogIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog",
  component: lazyRouteComponent(() => import("./routes/blog/index"), "BlogIndexPage"),
});

const blogPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog/$slug",
  component: lazyRouteComponent(() => import("./routes/blog/$slug"), "BlogPostPage"),
});

const toolsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools",
  component: lazyRouteComponent(() => import("./routes/tools/index"), "ToolsIndexPage"),
});

const toolsCategoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools/$category",
  component: lazyRouteComponent(() => import("./routes/tools/$category"), "ToolsCategoryPage"),
});

const appsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps",
  component: lazyRouteComponent(() => import("./routes/apps/index"), "AppsIndexPage"),
});

const appsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps/new",
  component: lazyRouteComponent(() => import("./routes/apps/new"), "AppsNewPage"),
});

const appDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps/$appId",
  component: lazyRouteComponent(() => import("./routes/apps/$appId"), "AppDetailPage"),
});

const storeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/store",
  component: lazyRouteComponent(() => import("./routes/store"), "StorePage"),
});

const messagesIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: lazyRouteComponent(() => import("./routes/messages/index"), "MessagesIndexPage"),
});

const messageThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages/$userId",
  component: lazyRouteComponent(() => import("./routes/messages/$userId"), "MessageThreadPage"),
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: lazyRouteComponent(() => import("./routes/analytics"), "AnalyticsPage"),
});

const bazdmegDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/bazdmeg",
  component: lazyRouteComponent(() => import("./routes/dashboard/bazdmeg"), "BazdmegDashboardPage"),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./routes/settings"), "SettingsPage"),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/callback",
  component: CallbackPage,
});

const learnIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn",
  component: lazyRouteComponent(() => import("./routes/learn/index"), "LearnIndexPage"),
});

const learnSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$sessionId",
  component: lazyRouteComponent(() => import("./routes/learn/$sessionId"), "LearnSessionPage"),
});

const learnBadgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/badge/$token",
  component: lazyRouteComponent(() => import("./routes/learn/badge/$token"), "BadgePage"),
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: lazyRouteComponent(() => import("./routes/about"), "AboutPage"),
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: lazyRouteComponent(() => import("./routes/privacy"), "PrivacyPage"),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: lazyRouteComponent(() => import("./routes/terms"), "TermsPage"),
});

const versionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/version",
  component: lazyRouteComponent(() => import("./routes/version"), "VersionPage"),
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  blogIndexRoute,
  blogPostRoute,
  toolsIndexRoute,
  toolsCategoryRoute,
  appsIndexRoute,
  appsNewRoute,
  appDetailRoute,
  storeRoute,
  messagesIndexRoute,
  messageThreadRoute,
  analyticsRoute,
  bazdmegDashboardRoute,
  settingsRoute,
  loginRoute,
  callbackRoute,
  learnBadgeRoute,
  learnSessionRoute,
  learnIndexRoute,
  aboutRoute,
  privacyRoute,
  termsRoute,
  versionRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
