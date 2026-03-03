import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so mock fns are available inside vi.mock factory
const { mockNextAuthSignIn, mockNextAuthSignOut } = vi.hoisted(() => ({
  mockNextAuthSignIn: vi.fn(),
  mockNextAuthSignOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: mockNextAuthSignIn,
  signOut: mockNextAuthSignOut,
}));

import { signIn, signOut } from "./actions";
import type { SignInProvider } from "./actions";

describe("auth client actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signIn", () => {
    it("delegates to nextAuthSignIn with no args", async () => {
      mockNextAuthSignIn.mockResolvedValue({ ok: true });
      await signIn();
      expect(mockNextAuthSignIn).toHaveBeenCalledWith(undefined, undefined);
    });

    it("passes provider to nextAuthSignIn", async () => {
      mockNextAuthSignIn.mockResolvedValue({ ok: true });
      await signIn("github");
      expect(mockNextAuthSignIn).toHaveBeenCalledWith("github", undefined);
    });

    it("passes provider and options to nextAuthSignIn", async () => {
      mockNextAuthSignIn.mockResolvedValue({ ok: true });
      await signIn("google", { callbackUrl: "/dashboard", redirect: true });
      expect(mockNextAuthSignIn).toHaveBeenCalledWith("google", {
        callbackUrl: "/dashboard",
        redirect: true,
      });
    });

    it("returns the result from nextAuthSignIn", async () => {
      const fakeResult = { ok: true, url: "/dashboard" };
      mockNextAuthSignIn.mockResolvedValue(fakeResult);
      const result = await signIn("github");
      expect(result).toEqual(fakeResult);
    });

    it("supports all valid SignInProvider values", async () => {
      const providers: SignInProvider[] = [
        "github",
        "google",
        "apple",
        "facebook",
        "email",
        "qr-auth",
        "credentials",
      ];
      for (const provider of providers) {
        mockNextAuthSignIn.mockResolvedValue({ ok: true });
        await signIn(provider);
        expect(mockNextAuthSignIn).toHaveBeenCalledWith(provider, undefined);
      }
    });

    it("passes extra options fields through", async () => {
      mockNextAuthSignIn.mockResolvedValue(null);
      await signIn("email", { callbackUrl: "/home", redirect: false, email: "user@test.com" });
      expect(mockNextAuthSignIn).toHaveBeenCalledWith("email", {
        callbackUrl: "/home",
        redirect: false,
        email: "user@test.com",
      });
    });
  });

  describe("signOut", () => {
    it("delegates to nextAuthSignOut with no args", async () => {
      mockNextAuthSignOut.mockResolvedValue(undefined);
      await signOut();
      expect(mockNextAuthSignOut).toHaveBeenCalledWith(undefined);
    });

    it("passes options to nextAuthSignOut", async () => {
      mockNextAuthSignOut.mockResolvedValue(undefined);
      await signOut({ callbackUrl: "/", redirect: true });
      expect(mockNextAuthSignOut).toHaveBeenCalledWith({
        callbackUrl: "/",
        redirect: true,
      });
    });

    it("returns result from nextAuthSignOut", async () => {
      mockNextAuthSignOut.mockResolvedValue({ url: "/" });
      const result = await signOut({ callbackUrl: "/" });
      expect(result).toEqual({ url: "/" });
    });
  });
});
