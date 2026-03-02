import { describe, expect, it, vi } from "vitest";
import type { OnLoadArgs, OnResolveArgs, PluginBuild } from "@spike-land-ai/esbuild-wasm";
import { BROWSER_DEFINE, serverFetchPlugin } from "./bundler";

describe("bundler", () => {
  describe("BROWSER_DEFINE", () => {
    it("should set NODE_ENV to production", () => {
      expect(BROWSER_DEFINE["process.env['NODE_ENV']"]).toBe(JSON.stringify("production"));
    });

    it("should set platform to browser", () => {
      expect(BROWSER_DEFINE["process.platform"]).toBe(JSON.stringify("browser"));
    });

    it("should set process.browser to true", () => {
      expect(BROWSER_DEFINE["process.browser"]).toBe(JSON.stringify(true));
    });

    it("should set global to globalThis", () => {
      expect(BROWSER_DEFINE.global).toBe("globalThis");
    });

    it("should set isBrowser to true", () => {
      expect(BROWSER_DEFINE.isBrowser).toBe(JSON.stringify(true));
    });

    it("should set isJest to false", () => {
      expect(BROWSER_DEFINE.isJest).toBe(JSON.stringify(false));
    });

    it("should include a version string", () => {
      expect(BROWSER_DEFINE.version).toBe(JSON.stringify("v20.3.1"));
    });

    it("should disable WORKER_DOM_DEBUG", () => {
      expect(BROWSER_DEFINE.WORKER_DOM_DEBUG).toBe(JSON.stringify(false));
    });

    it("should have all expected keys", () => {
      const keys = Object.keys(BROWSER_DEFINE);
      expect(keys.length).toBeGreaterThan(10);
      expect(keys).toContain("global");
      expect(keys).toContain("isBrowser");
      expect(keys).toContain("browser");
    });
  });

  describe("serverFetchPlugin", () => {
    function setupPlugin(cache?: Map<string, string>) {
      const plugin = serverFetchPlugin(cache ?? new Map());
      const resolveCbs: Array<(args: OnResolveArgs) => unknown> = [];
      const loadCbs: Array<(args: OnLoadArgs) => unknown> = [];

      const build = {
        onResolve: vi
          .fn()
          .mockImplementation((_opts: unknown, cb: (args: OnResolveArgs) => unknown) => {
            resolveCbs.push(cb);
          }),
        onLoad: vi.fn().mockImplementation((_opts: unknown, cb: (args: OnLoadArgs) => unknown) => {
          loadCbs.push(cb);
        }),
      } as unknown as PluginBuild;

      plugin.setup(build);
      return { resolveCbs, loadCbs, build };
    }

    async function resolve(
      cbs: Array<(args: OnResolveArgs) => unknown>,
      args: Partial<OnResolveArgs>,
    ) {
      for (const cb of cbs) {
        const result = await cb({
          path: "",
          kind: "import-statement",
          namespace: "file",
          importer: "",
          ...args,
        } as OnResolveArgs);
        if (result) return result;
      }
      return undefined;
    }

    it("should return plugin with name 'server-fetch'", () => {
      const plugin = serverFetchPlugin(new Map());
      expect(plugin.name).toBe("server-fetch");
    });

    it("should resolve HTTP URLs to http-url namespace", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "https://esm.sh/react",
      });
      expect(result).toEqual({ path: "https://esm.sh/react", namespace: "http-url" });
    });

    it("should resolve import map entries", async () => {
      const { resolveCbs } = setupPlugin();
      // Import map has entries like "react" -> CDN url
      // The plugin checks IMPORT_MAP.imports for exact match
      const result = await resolve(resolveCbs, { path: "react" });
      // If "react" is in the import map, it gets resolved; otherwise falls through
      // to the bare specifier handler
      expect(result).toBeDefined();
    });

    it("should resolve relative imports inside http-url namespace", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "./utils.js",
        namespace: "http-url",
        importer: "https://esm.sh/some-package/index.js",
      });
      expect(result).toEqual({
        path: "https://esm.sh/some-package/utils.js",
        namespace: "http-url",
      });
    });

    it("should resolve absolute paths starting with / via CDN", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "/lucide-react?bundle=true",
      });
      expect(result).toBeDefined();
      expect((result as { path: string }).path).toContain("lucide-react");
      expect((result as { namespace: string }).namespace).toBe("http-url");
    });

    it("should resolve /@/ paths via component worker URL", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "/@/components/ui/button.mjs",
      });
      expect(result).toBeDefined();
      expect((result as { path: string }).path).toContain("/@/components/ui/button.mjs");
      expect((result as { namespace: string }).namespace).toBe("http-url");
    });

    it("should resolve @/ bare specifiers via component worker URL", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "@/components/ui/card",
      });
      expect(result).toBeDefined();
      expect((result as { path: string }).path).toContain("@/components/ui/card");
      expect((result as { namespace: string }).namespace).toBe("http-url");
    });

    it("should resolve unknown bare specifiers via esm.sh CDN", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolve(resolveCbs, {
        path: "some-unknown-package",
      });
      expect(result).toBeDefined();
      expect((result as { path: string }).path).toContain("esm.sh/some-unknown-package");
      expect((result as { namespace: string }).namespace).toBe("http-url");
    });

    it("should return cached content on load", async () => {
      const cache = new Map<string, string>();
      cache.set("https://esm.sh/react", "export default React;");
      const { loadCbs } = setupPlugin(cache);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/react",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toBe("export default React;");
    });

    it("should fetch and cache content on cache miss", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve("console.log('hello');"),
        headers: new Headers({ "content-type": "application/javascript" }),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse as Response);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/test-pkg",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toBe("console.log('hello');");
      expect((result as { loader: string }).loader).toBe("js");
      expect(cache.has("https://esm.sh/test-pkg")).toBe(true);

      vi.restoreAllMocks();
    });

    it("should return error comment on fetch failure", async () => {
      const { loadCbs } = setupPlugin();

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network error"));

      const result = await loadCbs[0]!({
        path: "https://esm.sh/broken",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toContain("Fetch error");
      expect((result as { loader: string }).loader).toBe("js");

      vi.restoreAllMocks();
    });

    it("should return error comment on non-ok response", async () => {
      const { loadCbs } = setupPlugin();

      const mockResponse = {
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
        headers: new Headers(),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse as Response);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/missing",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toContain("Failed to fetch");
      expect((result as { contents: string }).contents).toContain("404");

      vi.restoreAllMocks();
    });

    it("should detect CSS loader from content-type", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve("body { margin: 0; }"),
        headers: new Headers({ "content-type": "text/css" }),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse as Response);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/style.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("css");

      vi.restoreAllMocks();
    });

    it("should detect JSON loader from path extension", async () => {
      const cache = new Map<string, string>();
      cache.set("https://example.com/data.json", '{"key":"value"}');
      const { loadCbs } = setupPlugin(cache);

      const result = await loadCbs[0]!({
        path: "https://example.com/data.json",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("json");
    });

    it("should detect tsx loader from path extension", async () => {
      const cache = new Map<string, string>();
      cache.set("https://example.com/App.tsx", "export default function App() {}");
      const { loadCbs } = setupPlugin(cache);

      const result = await loadCbs[0]!({
        path: "https://example.com/App.tsx",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("tsx");
    });

    it("should detect ts loader from path extension", async () => {
      const cache = new Map<string, string>();
      cache.set("https://example.com/utils.ts", "export const x = 1;");
      const { loadCbs } = setupPlugin(cache);

      const result = await loadCbs[0]!({
        path: "https://example.com/utils.ts",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("ts");
    });

    it("should detect binary loader for font content-type", async () => {
      const cache = new Map<string, string>();
      cache.set("https://example.com/font.woff2", "binary-data");
      const { loadCbs } = setupPlugin(cache);

      const result = await loadCbs[0]!({
        path: "https://example.com/font.woff2",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
    });

    it("should handle text read failure gracefully", async () => {
      const { loadCbs } = setupPlugin();

      const mockResponse = {
        ok: true,
        text: () => Promise.reject(new Error("read error")),
        headers: new Headers({ "content-type": "application/javascript" }),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/read-fail",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toContain("Failed to read");

      vi.restoreAllMocks();
    });

    it("should process CSS content with @import inlining", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      // CSS file with an @import statement
      const cssWithImport = '@import url("reset.css");\nbody { color: red; }';
      const importedCss = "* { margin: 0; }";

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssWithImport),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(importedCss),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://example.com/style.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("css");
      // The processed CSS should inline the import
      expect((result as { contents: string }).contents).toContain("margin: 0");

      vi.restoreAllMocks();
    });

    it("should handle failed @import fetch", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const cssWithImport = '@import "broken.css";\nbody { color: blue; }';

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssWithImport),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

      const result = await loadCbs[0]!({
        path: "https://example.com/main.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string }).contents).toContain("Failed to load");

      vi.restoreAllMocks();
    });

    it("should resolve url() references in CSS", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const cssWithUrl = 'body { background: url("bg.png"); }';

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssWithUrl),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-type": "image/png" }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        } as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://example.com/styles/main.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { loader: string }).loader).toBe("css");

      vi.restoreAllMocks();
    });

    it("should inline font url() as base64 data URI", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const cssWithFont = '@font-face { src: url("font.woff2"); }';
      const fontBuffer = new ArrayBuffer(4);
      new Uint8Array(fontBuffer).set([0, 1, 2, 3]);

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssWithFont),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-type": "font/woff2" }),
          arrayBuffer: () => Promise.resolve(fontBuffer),
        } as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://example.com/fonts/style.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      const contents = (result as { contents: string }).contents;
      expect(contents).toContain("data:font/woff2;base64,");

      vi.restoreAllMocks();
    });

    it("should skip data: URLs in CSS", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const cssWithDataUrl = 'body { background: url("data:image/png;base64,abc"); }';

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(cssWithDataUrl),
        headers: new Headers({ "content-type": "text/css" }),
      } as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://example.com/inline.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      // data: URL should be preserved as-is
      const contents = (result as { contents: string }).contents;
      expect(contents).toContain("data:image/png;base64,abc");

      vi.restoreAllMocks();
    });

    it("should handle failed url() resource fetch", async () => {
      const cache = new Map<string, string>();
      const { loadCbs } = setupPlugin(cache);

      const cssWithUrl = 'body { background: url("missing.png"); }';

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(cssWithUrl),
          headers: new Headers({ "content-type": "text/css" }),
        } as unknown as Response)
        .mockRejectedValueOnce(new Error("network error"));

      const result = await loadCbs[0]!({
        path: "https://example.com/broken.css",
        namespace: "http-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      const contents = (result as { contents: string }).contents;
      expect(contents).toContain("Failed");

      vi.restoreAllMocks();
    });
  });
});
