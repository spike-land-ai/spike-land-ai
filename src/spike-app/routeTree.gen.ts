import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { DashboardPage } from "./routes/index";
import { ToolsIndexPage } from "./routes/tools/index";
import { ToolsCategoryPage } from "./routes/tools/$category";
import { AppsIndexPage } from "./routes/apps/index";
import { AppsNewPage } from "./routes/apps/new";
import { AppDetailPage } from "./routes/apps/$appId";
import { StorePage } from "./routes/store";
import { MessagesIndexPage } from "./routes/messages/index";
import { MessageThreadPage } from "./routes/messages/$userId";
import { AnalyticsPage } from "./routes/analytics";
import { BazdmegDashboardPage } from "./routes/dashboard/bazdmeg";
import { SettingsPage } from "./routes/settings";
import { LoginPage } from "./routes/login";
import { CallbackPage } from "./routes/callback";
import { LearnIndexPage } from "./routes/learn/index";
import { LearnSessionPage } from "./routes/learn/$sessionId";
import { BadgePage } from "./routes/learn/badge/$token";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const toolsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools",
  component: ToolsIndexPage,
});

const toolsCategoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools/$category",
  component: ToolsCategoryPage,
});

const appsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps",
  component: AppsIndexPage,
});

const appsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps/new",
  component: AppsNewPage,
});

const appDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/apps/$appId",
  component: AppDetailPage,
});

const storeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/store",
  component: StorePage,
});

const messagesIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: MessagesIndexPage,
});

const messageThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages/$userId",
  component: MessageThreadPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const bazdmegDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/bazdmeg",
  component: BazdmegDashboardPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
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
  component: LearnIndexPage,
});

const learnSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$sessionId",
  component: LearnSessionPage,
});

const learnBadgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/badge/$token",
  component: BadgePage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
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
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
