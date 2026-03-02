import { describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";
import { NextRequest } from "next/server";

// Mock next-auth to avoid real auth calls in proxy tests
vi.mock("next-auth", () => ({
  default: () => ({
    auth: vi.fn().mockResolvedValue({ user: { name: "Test User" } }),
  }),
}));

vi.mock("@/auth.config", () => ({
  authConfig: { providers: [], callbacks: {} },
}));

vi.mock("@/lib/security/csp-nonce", () => ({
  CSP_NONCE_HEADER: "x-nonce",
  generateNonce: () => "test-nonce-value",
}));

vi.mock("@/lib/security/timing", () => ({
  secureCompare: vi.fn().mockReturnValue(false),
}));

describe("Proxy CSP Header", () => {
  it("should include nonce in script-src directive for protected routes", async () => {
    // Create a mock NextRequest
    const request = new NextRequest("http://localhost:3000/settings", {
      headers: {
        origin: "http://localhost:3000",
      },
    });

    // Call the proxy function
    const response = await proxy(request);

    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).not.toBeNull();
    // Use regex to match 'nonce-test-nonce-value' inside script-src directive
    // script-src ... 'nonce-test-nonce-value' ...
    expect(csp).toMatch(/script-src[^;]*'nonce-test-nonce-value'/);
  });
});
