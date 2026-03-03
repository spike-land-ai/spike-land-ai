import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAppleConfig,
  getEnabledProviders,
  getFacebookConfig,
  getGitHubConfig,
  getGoogleConfig,
} from "./config";

describe("provider config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getGitHubConfig", () => {
    it("returns config when both env vars are set", () => {
      process.env.GITHUB_ID = "gh-id";
      process.env.GITHUB_SECRET = "gh-secret";
      const config = getGitHubConfig();
      expect(config).toEqual({ clientId: "gh-id", clientSecret: "gh-secret" });
    });

    it("returns null when ID is missing", () => {
      delete process.env.GITHUB_ID;
      process.env.GITHUB_SECRET = "gh-secret";
      expect(getGitHubConfig()).toBeNull();
    });

    it("returns null when secret is missing", () => {
      process.env.GITHUB_ID = "gh-id";
      delete process.env.GITHUB_SECRET;
      expect(getGitHubConfig()).toBeNull();
    });

    it("trims whitespace", () => {
      process.env.GITHUB_ID = "  gh-id  ";
      process.env.GITHUB_SECRET = "  gh-secret  ";
      const config = getGitHubConfig();
      expect(config).toEqual({ clientId: "gh-id", clientSecret: "gh-secret" });
    });
  });

  describe("getGoogleConfig", () => {
    it("returns config when both env vars are set", () => {
      process.env.GOOGLE_ID = "g-id";
      process.env.GOOGLE_SECRET = "g-secret";
      expect(getGoogleConfig()).toEqual({ clientId: "g-id", clientSecret: "g-secret" });
    });

    it("returns null when missing", () => {
      delete process.env.GOOGLE_ID;
      delete process.env.GOOGLE_SECRET;
      expect(getGoogleConfig()).toBeNull();
    });
  });

  describe("getAppleConfig", () => {
    it("returns config when both env vars are set", () => {
      process.env.AUTH_APPLE_ID = "a-id";
      process.env.AUTH_APPLE_SECRET = "a-secret";
      expect(getAppleConfig()).toEqual({ clientId: "a-id", clientSecret: "a-secret" });
    });

    it("returns null when missing", () => {
      delete process.env.AUTH_APPLE_ID;
      expect(getAppleConfig()).toBeNull();
    });
  });

  describe("getFacebookConfig", () => {
    it("returns config when both env vars are set", () => {
      process.env.AUTH_FACEBOOK_ID = "fb-id";
      process.env.AUTH_FACEBOOK_SECRET = "fb-secret";
      expect(getFacebookConfig()).toEqual({ clientId: "fb-id", clientSecret: "fb-secret" });
    });

    it("returns null when missing", () => {
      delete process.env.AUTH_FACEBOOK_ID;
      expect(getFacebookConfig()).toBeNull();
    });
  });

  describe("getEnabledProviders", () => {
    it("returns empty array when no providers configured", () => {
      delete process.env.GITHUB_ID;
      delete process.env.GITHUB_SECRET;
      delete process.env.GOOGLE_ID;
      delete process.env.GOOGLE_SECRET;
      delete process.env.AUTH_APPLE_ID;
      delete process.env.AUTH_APPLE_SECRET;
      delete process.env.AUTH_FACEBOOK_ID;
      delete process.env.AUTH_FACEBOOK_SECRET;
      expect(getEnabledProviders()).toEqual([]);
    });

    it("returns only configured providers", () => {
      process.env.GITHUB_ID = "id";
      process.env.GITHUB_SECRET = "secret";
      process.env.GOOGLE_ID = "id";
      process.env.GOOGLE_SECRET = "secret";
      delete process.env.AUTH_APPLE_ID;
      delete process.env.AUTH_FACEBOOK_ID;
      expect(getEnabledProviders()).toEqual(["github", "google"]);
    });
  });
});
