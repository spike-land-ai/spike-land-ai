import { describe, expect, it } from "vitest";
import { buildBundleHtml } from "./bundle-template";

const BASE_OPTS = {
  js: "console.log('app');",
  css: "body { margin: 0; }",
  html: "<div>Hello</div>",
  codeSpace: "test-app",
};

describe("buildBundleHtml", () => {
  it("produces valid HTML with embed div", () => {
    const html = buildBundleHtml(BASE_OPTS);
    expect(html).toContain("<div id=\"embed\">");
  });

  it("uses a 15s render timeout", () => {
    const html = buildBundleHtml(BASE_OPTS);
    expect(html).toContain("after 15s");
    expect(html).toContain("15000");
  });

  it("includes MutationObserver to cancel timeout early", () => {
    const html = buildBundleHtml(BASE_OPTS);
    expect(html).toContain("MutationObserver");
    expect(html).toContain("clearTimeout(timer)");
    expect(html).toContain("obs.disconnect()");
  });

  it("includes error reporting via postMessage", () => {
    const html = buildBundleHtml(BASE_OPTS);
    expect(html).toContain("type: \"iframe-error\"");
    expect(html).toContain("source: \"spike-land-bundle\"");
    expect(html).toContain("parent.postMessage");
  });

  it("sanitizes script tags in JS to prevent XSS", () => {
    const html = buildBundleHtml({
      ...BASE_OPTS,
      js: "</script><script>alert(1)",
    });
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("sanitizes style tags in CSS to prevent XSS", () => {
    const html = buildBundleHtml({
      ...BASE_OPTS,
      css: "</style><script>alert(1)",
    });
    expect(html).not.toContain("</style><script>alert(1)");
  });

  it("sanitizes script tags in HTML content", () => {
    const html = buildBundleHtml({
      ...BASE_OPTS,
      html: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
