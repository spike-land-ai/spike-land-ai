import { describe, it, expect } from "vitest";
import { router } from "../../../src/frontend/platform-frontend/ui/router";

async function expectRedirect(to: "/store" | "/tools") {
  await expect(router.navigate({ to })).rejects.toMatchObject({ href: "/apps" });
}

describe("Router Configuration", () => {
  it("redirects /store to /apps", async () => {
    await expectRedirect("/store");
  });

  it("redirects /tools to /apps", async () => {
    await expectRedirect("/tools");
  });
});
