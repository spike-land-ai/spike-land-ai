import { describe, it, expect } from "vitest";
import { authClient, authProviders } from "./auth";

describe("authClient", () => {
  it("is defined", () => {
    expect(authClient).toBeDefined();
  });

  it("has useSession hook", () => {
    expect(typeof authClient.useSession).toBe("function");
  });

  it("has signIn method", () => {
    expect(authClient.signIn).toBeDefined();
  });

  it("has signOut method", () => {
    expect(typeof authClient.signOut).toBe("function");
  });
});

describe("authProviders", () => {
  it("includes github and google", () => {
    const ids = authProviders.map((p) => p.id);
    expect(ids).toContain("github");
    expect(ids).toContain("google");
  });

  it("has name and icon for each provider", () => {
    for (const provider of authProviders) {
      expect(provider.name).toBeTruthy();
      expect(provider.icon).toBeTruthy();
    }
  });
});
