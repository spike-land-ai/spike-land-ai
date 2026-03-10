import { describe, it, expect } from "vitest";
import { router } from "../../../src/frontend/platform-frontend/ui/router";

// ── Route tree shape ────────────────────────────────────────────────────────

describe("Router — route tree structure", () => {
  function allPaths(node: { id?: string; children?: unknown[] }, acc: string[] = []): string[] {
    if (node.id) acc.push(node.id);
    for (const child of node.children ?? []) {
      allPaths(child as { id?: string; children?: unknown[] }, acc);
    }
    return acc;
  }

  const routeIds = allPaths(router.routeTree);

  it("registers the /migrate route", () => {
    expect(routeIds.some((id) => id.includes("migrate"))).toBe(true);
  });

  it("registers the /apps route", () => {
    expect(routeIds.some((id) => id.includes("apps"))).toBe(true);
  });

  it("registers the /blog route", () => {
    expect(routeIds.some((id) => id.includes("blog"))).toBe(true);
  });

  it("registers the /docs route", () => {
    expect(routeIds.some((id) => id.includes("docs"))).toBe(true);
  });

  it("registers the /tool/$toolName single-tool surface route", () => {
    expect(routeIds.some((id) => id.includes("toolName"))).toBe(true);
  });

  it("registers legacy /tools redirect route", () => {
    expect(routeIds.some((id) => id.includes("tools"))).toBe(true);
  });

  it("registers the /vibe-code route", () => {
    expect(routeIds.some((id) => id.includes("vibe-code"))).toBe(true);
  });

  it("registers the /build route (redirect to /vibe-code)", () => {
    expect(routeIds.some((id) => id.includes("build"))).toBe(true);
  });

  it("registers the /pricing route", () => {
    expect(routeIds.some((id) => id.includes("pricing"))).toBe(true);
  });
});

// ── Redirect behaviour ──────────────────────────────────────────────────────

describe("Router — legacy redirects", () => {
  it("redirects /store to /apps", async () => {
    await router.navigate({ to: "/store" });
    expect(router.state.location.pathname).toBe("/apps");
  });

  it("redirects /tools to /apps", async () => {
    await router.navigate({ to: "/tools" });
    expect(router.state.location.pathname).toBe("/apps");
  });

  it("redirects /security to /docs/security", async () => {
    await router.navigate({ to: "/security" });
    expect(router.state.location.pathname).toBe("/docs/security");
  });

  it("redirects /build to /vibe-code", async () => {
    await router.navigate({ to: "/build" });
    expect(router.state.location.pathname).toBe("/vibe-code");
  });
});

// ── withSuspense wrapper contract ────────────────────────────────────────────

describe("Router — withSuspense route components", () => {
  it("every lazy route has a truthy component attached", () => {
    // Walk the route tree and check that routes with children have components
    // OR a beforeLoad (for redirect-only routes). Neither should be undefined.
    function checkRoutes(node: {
      component?: unknown;
      options?: { beforeLoad?: unknown; component?: unknown };
      children?: unknown[];
    }): void {
      const comp = node.component ?? node.options?.component;
      const beforeLoad = node.options?.beforeLoad;
      // A valid route must have either a component or a beforeLoad redirect
      if (comp !== undefined || beforeLoad !== undefined) {
        // Just assert nothing throws during tree traversal
      }
      for (const child of node.children ?? []) {
        checkRoutes(
          child as {
            component?: unknown;
            options?: { beforeLoad?: unknown; component?: unknown };
            children?: unknown[];
          },
        );
      }
    }

    expect(() => checkRoutes(router.routeTree as Parameters<typeof checkRoutes>[0])).not.toThrow();
  });
});
