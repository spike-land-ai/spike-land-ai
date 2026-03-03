import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getAgentApiKey, verifyAgentAuth } from "./agent";
import { NextRequest } from "next/server";

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new NextRequest("https://example.com/api/agent", { headers });
}

describe("agent auth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyAgentAuth", () => {
    it("returns false when no Authorization header", () => {
      const req = makeRequest();
      expect(verifyAgentAuth(req)).toBe(false);
    });

    it("returns false when Authorization is not Bearer scheme", () => {
      const req = makeRequest("Basic dXNlcjpwYXNz");
      expect(verifyAgentAuth(req)).toBe(false);
    });

    it("returns false when Bearer token is missing", () => {
      const req = makeRequest("Bearer ");
      expect(verifyAgentAuth(req)).toBe(false);
    });

    it("returns false when AGENT_API_KEY is not configured", () => {
      delete process.env.AGENT_API_KEY;
      const req = makeRequest("Bearer some-token");
      expect(verifyAgentAuth(req)).toBe(false);
    });

    it("returns false when token does not match AGENT_API_KEY", () => {
      process.env.AGENT_API_KEY = "correct-key";
      const req = makeRequest("Bearer wrong-key");
      expect(verifyAgentAuth(req)).toBe(false);
    });

    it("returns true when token matches AGENT_API_KEY", () => {
      process.env.AGENT_API_KEY = "correct-key";
      const req = makeRequest("Bearer correct-key");
      expect(verifyAgentAuth(req)).toBe(true);
    });
  });

  describe("getAgentApiKey", () => {
    it("returns null when no Authorization header", () => {
      const req = makeRequest();
      expect(getAgentApiKey(req)).toBeNull();
    });

    it("returns null when not Bearer scheme", () => {
      const req = makeRequest("Basic abc123");
      expect(getAgentApiKey(req)).toBeNull();
    });

    it("returns null when Bearer token is empty", () => {
      const req = makeRequest("Bearer ");
      expect(getAgentApiKey(req)).toBeNull();
    });

    it("returns the token string for valid Bearer header", () => {
      const req = makeRequest("Bearer my-api-key-123");
      expect(getAgentApiKey(req)).toBe("my-api-key-123");
    });
  });
});
