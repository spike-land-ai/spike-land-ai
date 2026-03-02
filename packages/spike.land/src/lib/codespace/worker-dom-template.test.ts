import { describe, expect, it } from "vitest";
import { buildWorkerDomHtml } from "./worker-dom-template";

const BASE_OPTS = {
  workerJs: "console.log('worker');",
  applierJs: "window.__WorkerDOMApplier = function(){};",
  css: "body { margin: 0; }",
  html: "<div>Hello</div>",
  codeSpace: "test-app",
};

describe("buildWorkerDomHtml", () => {
  it("produces valid HTML with embed div", () => {
    const html = buildWorkerDomHtml(BASE_OPTS);
    expect(html).toContain('<div id="embed">');
    expect(html).toContain("<div>Hello</div>");
  });

  it("uses a 15s render timeout (not 5s)", () => {
    const html = buildWorkerDomHtml(BASE_OPTS);
    // Should NOT contain the old 5s timeout message
    expect(html).not.toContain("after 5s");
    expect(html).not.toMatch(/},\s*5000\)/);
    // Should contain the new 15s timeout
    expect(html).toContain("after 15s");
    expect(html).toMatch(/},\s*15000\)/);
  });

  it("includes MutationObserver to cancel timeout early", () => {
    const html = buildWorkerDomHtml(BASE_OPTS);
    expect(html).toContain("MutationObserver");
    expect(html).toContain("clearTimeout(timer)");
    expect(html).toContain("obs.disconnect()");
  });

  it("includes error reporting via postMessage", () => {
    const html = buildWorkerDomHtml(BASE_OPTS);
    expect(html).toContain('type: "iframe-error"');
    expect(html).toContain('source: "spike-land-worker-dom"');
    expect(html).toContain("parent.postMessage");
  });

  it("embeds the codeSpace in error reports", () => {
    const html = buildWorkerDomHtml({ ...BASE_OPTS, codeSpace: "my-space" });
    expect(html).toContain('"my-space"');
  });

  it("inlines the worker and applier JS", () => {
    const html = buildWorkerDomHtml(BASE_OPTS);
    expect(html).toContain("console.log('worker');");
    expect(html).toContain("window.__WorkerDOMApplier = function(){};");
  });
});
