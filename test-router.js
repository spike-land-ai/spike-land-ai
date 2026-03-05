import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
const rootRoute = createRootRoute();
const toolsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tools" });
const toolsCategoryRoute = createRoute({ getParentRoute: () => toolsRoute, path: "/$toolName" });
rootRoute.addChildren([toolsRoute.addChildren([toolsCategoryRoute])]);
const router = createRouter({ routeTree: rootRoute });
console.log(Object.keys(router.routesById));
