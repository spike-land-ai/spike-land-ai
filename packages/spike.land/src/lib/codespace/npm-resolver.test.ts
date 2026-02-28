import { afterEach, describe, expect, it, vi } from "vitest";
import { npmResolverPlugin } from "./npm-resolver";
import type { OnLoadArgs, OnResolveArgs, PluginBuild } from "@spike-land-ai/esbuild-wasm";

function setupPlugin(mode?: "external" | "bundle", cache?: Map<string, string | Uint8Array>) {
  const plugin = npmResolverPlugin({ ...(mode !== undefined ? { mode } : {}), ...(cache !== undefined ? { cache } : {}) });
  const resolveCbs: Array<{ filter: RegExp; ns?: string; cb: (args: OnResolveArgs) => unknown; }> =
    [];
  const loadCbs: Array<(args: OnLoadArgs) => unknown> = [];

  const build = {
    onResolve: vi.fn().mockImplementation(
      (opts: { filter: RegExp; namespace?: string; }, cb: (args: OnResolveArgs) => unknown) => {
        resolveCbs.push({ filter: opts.filter, ...(opts.namespace !== undefined ? { ns: opts.namespace } : {}), cb });
      },
    ),
    onLoad: vi.fn().mockImplementation(
      (_opts: unknown, cb: (args: OnLoadArgs) => unknown) => {
        loadCbs.push(cb);
      },
    ),
  } as unknown as PluginBuild;

  plugin.setup(build);
  return { resolveCbs, loadCbs, build };
}

async function resolveAll(
  cbs: Array<{ filter: RegExp; ns?: string; cb: (args: OnResolveArgs) => unknown; }>,
  args: Partial<OnResolveArgs>,
) {
  for (const { filter, ns, cb } of cbs) {
    const fullArgs = {
      path: "",
      kind: "import-statement" as const,
      namespace: "file",
      importer: "",
      ...args,
    } as OnResolveArgs;

    // Check namespace filter
    if (ns && fullArgs.namespace !== ns) continue;
    // Check path filter
    if (!filter.test(fullArgs.path)) continue;

    const result = await cb(fullArgs);
    if (result) return result;
  }
  return undefined;
}

describe("npmResolverPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns plugin with correct name", () => {
    const plugin = npmResolverPlugin();
    expect(plugin.name).toBe("npm-resolver");
  });

  describe("external mode", () => {
    it("resolves bare imports as external esm.sh URLs", async () => {
      const { resolveCbs } = setupPlugin("external");
      const result = await resolveAll(resolveCbs, { path: "react" });
      expect(result).toEqual({
        path: "https://esm.sh/react",
        external: true,
      });
    });

    it("returns undefined for relative imports", async () => {
      const { resolveCbs } = setupPlugin("external");
      const result = await resolveAll(resolveCbs, { path: "./utils" });
      expect(result).toBeUndefined();
    });

    it("returns undefined for absolute path imports", async () => {
      const { resolveCbs } = setupPlugin("external");
      const result = await resolveAll(resolveCbs, { path: "/absolute/path" });
      expect(result).toBeUndefined();
    });

    it("returns undefined for https:// imports in first handler", async () => {
      const { resolveCbs } = setupPlugin("external");
      // The first handler skips https:// URLs
      const result = await resolveAll(resolveCbs, {
        path: "https://esm.sh/react",
      });
      // The second handler (esm.sh filter) should match
      expect(result).toBeDefined();
    });
  });

  describe("bundle mode", () => {
    it("resolves bare imports as npm-url namespace", async () => {
      const { resolveCbs } = setupPlugin("bundle");
      const result = await resolveAll(resolveCbs, { path: "react" });
      expect(result).toEqual({
        path: "https://esm.sh/react?bundle=true",
        namespace: "npm-url",
      });
    });

    it("resolves esm.sh URLs to npm-url namespace", async () => {
      const { resolveCbs } = setupPlugin("bundle");
      const result = await resolveAll(resolveCbs, {
        path: "https://esm.sh/lodash",
      });
      expect(result).toEqual({
        path: "https://esm.sh/lodash",
        namespace: "npm-url",
      });
    });

    it("resolves relative imports inside npm-url namespace", async () => {
      const { resolveCbs } = setupPlugin("bundle");
      const result = await resolveAll(resolveCbs, {
        path: "./internal.js",
        namespace: "npm-url",
        importer: "https://esm.sh/react/index.js",
      });
      expect(result).toEqual({
        path: "https://esm.sh/react/internal.js",
        namespace: "npm-url",
      });
    });
  });

  describe("default mode", () => {
    it("defaults to external mode", async () => {
      const { resolveCbs } = setupPlugin();
      const result = await resolveAll(resolveCbs, { path: "date-fns" });
      expect(result).toEqual({
        path: "https://esm.sh/date-fns",
        external: true,
      });
    });
  });

  describe("onLoad (bundle mode)", () => {
    it("fetches and caches module content", async () => {
      const cache = new Map<string, string | Uint8Array>();
      const { loadCbs } = setupPlugin("bundle", cache);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("export default 42;"),
      } as unknown as Response);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/test-pkg",
        namespace: "npm-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string; }).contents).toBe("export default 42;");
      expect((result as { loader: string; }).loader).toBe("js");
      expect(cache.has("https://esm.sh/test-pkg")).toBe(true);
    });

    it("returns cached content on cache hit", async () => {
      const cache = new Map<string, string | Uint8Array>();
      cache.set("https://esm.sh/cached-pkg", "cached export;");
      const { loadCbs } = setupPlugin("bundle", cache);

      const result = await loadCbs[0]!({
        path: "https://esm.sh/cached-pkg",
        namespace: "npm-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs);

      expect(result).toBeDefined();
      expect((result as { contents: string; }).contents).toBe("cached export;");
    });

    it("throws on fetch failure", async () => {
      const { loadCbs } = setupPlugin("bundle");

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("network failure"),
      );

      await expect(
        loadCbs[0]!({
          path: "https://esm.sh/broken-pkg",
          namespace: "npm-url",
          suffix: "",
          pluginData: undefined,
          with: {},
        } as OnLoadArgs),
      ).rejects.toThrow("Failed to fetch npm package");
    });

    it("throws on non-ok response", async () => {
      const { loadCbs } = setupPlugin("bundle");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(
        loadCbs[0]!({
          path: "https://esm.sh/missing-pkg",
          namespace: "npm-url",
          suffix: "",
          pluginData: undefined,
          with: {},
        } as OnLoadArgs),
      ).rejects.toThrow("Failed to fetch npm package");
    });

    it("throws on text read failure", async () => {
      const { loadCbs } = setupPlugin("bundle");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () => Promise.reject(new Error("read error")),
      } as unknown as Response);

      await expect(
        loadCbs[0]!({
          path: "https://esm.sh/read-fail",
          namespace: "npm-url",
          suffix: "",
          pluginData: undefined,
          with: {},
        } as OnLoadArgs),
      ).rejects.toThrow("Failed to read npm package text");
    });
  });
});
