import { describe, it, expect } from "vitest";
import { sanitizeUrl, escapeHtml } from "../../../src/frontend/platform-frontend/core-logic/lib/security";

describe("security utils", () => {
  describe("sanitizeUrl", () => {
    it("allows http and https links", () => {
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
      expect(sanitizeUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    });

    it("allows relative links", () => {
      expect(sanitizeUrl("/docs/intro")).toBe("/docs/intro");
      expect(sanitizeUrl("./local")).toBe("./local");
      expect(sanitizeUrl("../parent")).toBe("../parent");
    });

    it("allows mailto and tel links", () => {
      expect(sanitizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
      expect(sanitizeUrl("tel:+123456789")).toBe("tel:+123456789");
    });

    it("blocks javascript: links", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("about:blank");
      expect(sanitizeUrl("  javascript:alert(1)  ")).toBe("about:blank");
      expect(sanitizeUrl("JAVAscript:alert(1)")).toBe("about:blank");
    });

    it("blocks protocol-relative links", () => {
      expect(sanitizeUrl("//evil.com")).toBe("about:blank");
    });

    it("blocks other unknown protocols", () => {
      expect(sanitizeUrl("data:text/html,<html>")).toBe("about:blank");
      expect(sanitizeUrl("file:///etc/passwd")).toBe("about:blank");
    });

    it("handles empty or null input", () => {
      expect(sanitizeUrl("")).toBe("about:blank");
    });
  });

  describe("escapeHtml", () => {
    it("escapes special characters", () => {
      expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
      expect(escapeHtml('content with "quotes" and \'single\'')).toBe("content with &quot;quotes&quot; and &#039;single&#039;");
      expect(escapeHtml("a & b")).toBe("a &amp; b");
    });
  });
});
