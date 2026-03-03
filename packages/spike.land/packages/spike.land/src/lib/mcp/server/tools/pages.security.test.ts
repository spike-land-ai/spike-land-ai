import { describe, expect, it } from "vitest";
import { sanitizeCss } from "./pages";

describe("sanitizeCss - Security Checks", () => {
  it("should block common XSS vectors", () => {
    expect(sanitizeCss("expression(alert(1))")).toContain("/* blocked */");
    expect(sanitizeCss("javascript:alert(1)")).toContain("/* blocked */");
    expect(sanitizeCss("url(http://evil.com)")).toContain("/* blocked */");
    expect(sanitizeCss("@import 'http://evil.com'")).toContain("/* blocked */");
  });

  it("should sanitize </style> tag breakout", () => {
    // This was the vulnerability: </style> allowed escaping the style block
    const malicious = "</style><script>alert('XSS')</script><style>";
    const sanitized = sanitizeCss(malicious);

    // Now it should be blocked
    expect(sanitized).toContain("/* blocked */");
    expect(sanitized).not.toContain("</style>");

    // With </style> replaced by /* blocked */, the browser treats the remaining
    // <script> tag as CSS content (invalid CSS, safely ignored). The style block
    // continues until the legitimate closing </style> tag added by the framework.
  });

  it("should be case insensitive when blocking </style>", () => {
    const malicious = "</STYLE><script>alert('XSS')</script>";
    const sanitized = sanitizeCss(malicious);
    expect(sanitized).toContain("/* blocked */");
    expect(sanitized).not.toContain("</STYLE>");
  });
});
