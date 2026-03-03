import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isE2EBypassAllowed, isEnvBypassEnabled, validateBypassHeader } from "./bypass";

// Mock secureCompare
vi.mock("@/lib/security/timing", () => ({
  secureCompare: (a: string, b: string) => a === b,
}));

vi.mock("@/lib/errors/structured-logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Helper to set NODE_ENV without TS readonly complaint
function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", { value, writable: true, configurable: true });
}

describe("E2E bypass", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isE2EBypassAllowed", () => {
    it("returns true in development", () => {
      setNodeEnv("development");
      expect(isE2EBypassAllowed()).toBe(true);
    });

    it("returns false in production with APP_ENV=production", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://spike.land";
      expect(isE2EBypassAllowed()).toBe(false);
    });

    it("returns true for staging domain even in production", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://next.spike.land";
      expect(isE2EBypassAllowed()).toBe(true);
    });

    it("returns true for localhost", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      expect(isE2EBypassAllowed()).toBe(true);
    });
  });

  describe("isEnvBypassEnabled", () => {
    it("returns true when E2E_BYPASS_AUTH=true", () => {
      process.env.E2E_BYPASS_AUTH = "true";
      expect(isEnvBypassEnabled()).toBe(true);
    });

    it("returns false when E2E_BYPASS_AUTH is not set", () => {
      delete process.env.E2E_BYPASS_AUTH;
      expect(isEnvBypassEnabled()).toBe(false);
    });

    it("returns false for non-true values", () => {
      process.env.E2E_BYPASS_AUTH = "false";
      expect(isEnvBypassEnabled()).toBe(false);
    });
  });

  describe("validateBypassHeader", () => {
    it("returns true when header matches secret", () => {
      setNodeEnv("development");
      process.env.E2E_BYPASS_SECRET = "test-secret";
      expect(validateBypassHeader("test-secret")).toBe(true);
    });

    it("returns false when header does not match", () => {
      setNodeEnv("development");
      process.env.E2E_BYPASS_SECRET = "test-secret";
      expect(validateBypassHeader("wrong-secret")).toBe(false);
    });

    it("returns false when header is null", () => {
      process.env.E2E_BYPASS_SECRET = "test-secret";
      expect(validateBypassHeader(null)).toBe(false);
    });

    it("returns false when secret is not set", () => {
      setNodeEnv("development");
      delete process.env.E2E_BYPASS_SECRET;
      expect(validateBypassHeader("any-value")).toBe(false);
    });

    it("returns false in production", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://spike.land";
      process.env.E2E_BYPASS_SECRET = "test-secret";
      expect(validateBypassHeader("test-secret")).toBe(false);
    });
  });
});
