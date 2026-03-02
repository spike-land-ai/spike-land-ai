import { describe, expect, it } from "vitest";
import { buildEmbedHtml, HTML_TEMPLATE, IMPORT_MAP } from "./html-template";

describe("HTML_TEMPLATE", () => {
  it("should be a valid HTML5 document", () => {
    expect(HTML_TEMPLATE).toContain("<!DOCTYPE html>");
    expect(HTML_TEMPLATE).toContain("<html");
    expect(HTML_TEMPLATE).toContain("</html>");
  });

  it("should contain import map placeholder", () => {
    expect(HTML_TEMPLATE).toContain("// IMPORTMAP");
  });

  it("should contain HTML content placeholder", () => {
    expect(HTML_TEMPLATE).toContain("<!-- HTML_CONTENT -->");
  });

  it("should contain CSS placeholder", () => {
    expect(HTML_TEMPLATE).toContain("/* criticalCss */");
  });

  it("should include tailwindcss browser script", () => {
    expect(HTML_TEMPLATE).toContain("@tailwindcss/browser");
  });
});

describe("IMPORT_MAP", () => {
  it("should have an imports object", () => {
    expect(IMPORT_MAP.imports).toBeDefined();
    expect(typeof IMPORT_MAP.imports).toBe("object");
  });

  it("should map react to esm.sh", () => {
    expect(IMPORT_MAP.imports.react).toContain("esm.sh/react@");
  });

  it("should map react-dom to esm.sh", () => {
    expect(IMPORT_MAP.imports["react-dom"]).toContain("esm.sh/react-dom@");
  });

  it("should map @/ to component URL", () => {
    expect(IMPORT_MAP.imports["@/"]).toBeDefined();
  });

  it("should include common libraries", () => {
    expect(IMPORT_MAP.imports["framer-motion"]).toContain("esm.sh");
    expect(IMPORT_MAP.imports["recharts"]).toContain("esm.sh");
    expect(IMPORT_MAP.imports["lucide-react"]).toContain("esm.sh");
  });
});

describe("buildEmbedHtml", () => {
  it("should produce valid HTML", () => {
    const html = buildEmbedHtml({
      transpiled: "const x = 1;\nexport { App as default };",
      html: "<div>Hello</div>",
      css: "body { margin: 0; }",
      codeSpace: "test-space",
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("should inject import map JSON", () => {
    const html = buildEmbedHtml({
      transpiled: "",
      html: "",
      css: "",
      codeSpace: "test",
    });
    expect(html).toContain('"react"');
    expect(html).not.toContain("// IMPORTMAP");
  });

  it("should inject HTML content", () => {
    const html = buildEmbedHtml({
      transpiled: "",
      html: "<p>Test content</p>",
      css: "",
      codeSpace: "test",
    });
    expect(html).toContain("<p>Test content</p>");
    expect(html).not.toContain("<!-- HTML_CONTENT -->");
  });

  it("should inject CSS", () => {
    const html = buildEmbedHtml({
      transpiled: "",
      html: "",
      css: ".red { color: red; }",
      codeSpace: "test",
    });
    expect(html).toContain(".red { color: red; }");
  });

  it("should replace default export with createRoot render", () => {
    const html = buildEmbedHtml({
      transpiled: "const App = () => null;\nexport { App as default };",
      html: "",
      css: "",
      codeSpace: "test",
    });
    expect(html).toContain("createRoot");
    expect(html).toContain('getElementById("embed")');
    expect(html).not.toContain("export { App as default }");
  });

  it("should sanitize script tags in HTML content", () => {
    const html = buildEmbedHtml({
      transpiled: "",
      html: '<script>alert("xss")</script>',
      css: "",
      codeSpace: "test",
    });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script");
  });

  it("should sanitize closing script tags in transpiled code", () => {
    const html = buildEmbedHtml({
      transpiled: 'const s = "</script>";',
      html: "",
      css: "",
      codeSpace: "test",
    });
    expect(html).not.toContain('</script>"');
  });

  it("should handle empty transpiled code", () => {
    const html = buildEmbedHtml({
      transpiled: "",
      html: "",
      css: "",
      codeSpace: "test",
    });
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("should rewrite bare CDN imports to absolute URLs", () => {
    const html = buildEmbedHtml({
      transpiled: 'import x from "/some-pkg?bundle=true";\nexport { App as default };',
      html: "",
      css: "",
      codeSpace: "test",
    });
    expect(html).toContain("https://esm.sh/some-pkg?bundle=true");
  });
});
