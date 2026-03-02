import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("next-auth", () => ({
  default: () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "test" } }),
  }),
}));
vi.mock("@/auth.config", () => ({
  authConfig: {},
}));
vi.mock("@/lib/security/csp-nonce", () => ({
  CSP_NONCE_HEADER: "x-nonce",
  generateNonce: () => "test-nonce",
}));
vi.mock("@/lib/security/timing", () => ({
  secureCompare: vi.fn().mockReturnValue(false),
}));

describe("Middleware CSP", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should set object-src 'none' but NOT upgrade-insecure-requests in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest("http://localhost:3000/profile", {
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy");

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");

    // Should NOT include upgrade-insecure-requests in dev
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("should set upgrade-insecure-requests in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost:3000/profile", {
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy");

    expect(csp).toBeDefined();
    expect(csp).toContain("object-src 'none'");

    // Should include upgrade-insecure-requests in prod
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
