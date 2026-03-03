import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMcpBaseUrl } from "./get-base-url";

describe("getMcpBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.APP_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns spike.land when APP_ENV is production", () => {
    process.env.APP_ENV = "production";
    expect(getMcpBaseUrl()).toBe("https://spike.land");
  });

  it("production takes priority over NEXT_PUBLIC_APP_URL", () => {
    process.env.APP_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://preview-abc.example.com";
    expect(getMcpBaseUrl()).toBe("https://spike.land");
  });

  it("returns NEXT_PUBLIC_APP_URL when not production", () => {
    process.env.APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_URL = "https://preview-abc.example.com";
    expect(getMcpBaseUrl()).toBe("https://preview-abc.example.com");
  });

  it("falls back to spike.land when no env vars are set", () => {
    expect(getMcpBaseUrl()).toBe("https://spike.land");
  });

  it("returns NEXT_PUBLIC_APP_URL when APP_ENV is not production", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com";
    expect(getMcpBaseUrl()).toBe("https://custom.example.com");
  });
});
