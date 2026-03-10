import { describe, it, expect } from "vitest";
import { router } from "../../../src/frontend/platform-frontend/ui/router";

describe("Router Configuration", () => {
  it("redirects /store to /apps", async () => {
    expect.assertions(2);
    try {
      await router.navigate({ to: "/store" as any });
    } catch (e: any) {
      expect(e).toBeDefined();
      expect(e.href).toBe("/apps");
    }
  });

  it("redirects /tools to /apps", async () => {
    expect.assertions(2);
    try {
      await router.navigate({ to: "/tools" as any });
    } catch (e: any) {
      expect(e).toBeDefined();
      expect(e.href).toBe("/apps");
    }
  });
});
