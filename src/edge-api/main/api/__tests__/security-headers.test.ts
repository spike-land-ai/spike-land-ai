import { describe, expect, it } from "vitest";
import { applySecurityHeaders, isAllowedBrowserOrigin } from "../lib/security-headers.js";

describe("security header policy", () => {
  it("allows configured origins, spike.land subdomains, and localhost", () => {
    const configuredOrigins = ["https://spike.land"];

    expect(isAllowedBrowserOrigin("https://spike.land", configuredOrigins)).toBe(true);
    expect(isAllowedBrowserOrigin("https://notes-pwa.spike.land", configuredOrigins)).toBe(true);
    expect(isAllowedBrowserOrigin("https://local.spike.land:5173", configuredOrigins)).toBe(true);
    expect(isAllowedBrowserOrigin("http://localhost:5173", configuredOrigins)).toBe(true);
    expect(isAllowedBrowserOrigin("https://evil.example.com", configuredOrigins)).toBe(false);
  });

  it("applies the stable worker security header set", () => {
    const headers = new Headers();

    applySecurityHeaders(headers);

    const contentSecurityPolicy = headers.get("content-security-policy");

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("strict-transport-security")).toContain("max-age=63072000");
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    // frame-ancestors must restrict to spike.land family, never "*"
    expect(contentSecurityPolicy).toContain("frame-ancestors 'self' https://*.spike.land");
    expect(contentSecurityPolicy).not.toContain("frame-ancestors *");
    expect(contentSecurityPolicy).toContain("wss://chat.spike.land");
    expect(contentSecurityPolicy).toContain("https://*.google.co.uk");
  });
});
