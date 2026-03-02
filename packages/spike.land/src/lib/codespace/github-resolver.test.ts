import { describe, expect, it, vi } from "vitest";
import { githubResolverPlugin, parseGithubUrl } from "./github-resolver";
import type { OnLoadArgs, OnResolveArgs, PluginBuild } from "@spike-land-ai/esbuild-wasm";

describe("parseGithubUrl", () => {
  it("parses standard github url", () => {
    const parsed = parseGithubUrl("https://github.com/vitejs/vite");
    expect(parsed).toEqual({
      owner: "vitejs",
      repo: "vite",
      ref: "main",
      basePath: "",
      rawBaseUrl: "https://raw.githubusercontent.com/vitejs/vite/main/",
    });
  });

  it("parses github url with branch and path", () => {
    const parsed = parseGithubUrl("https://github.com/vitejs/vite/tree/main/playground/react");
    expect(parsed).toEqual({
      owner: "vitejs",
      repo: "vite",
      ref: "main",
      basePath: "playground/react",
      rawBaseUrl: "https://raw.githubusercontent.com/vitejs/vite/main/playground/react/",
    });
  });

  it("parses github url with a specific commit", () => {
    const parsed = parseGithubUrl("https://github.com/vitejs/vite/tree/abcd123/playground/react");
    expect(parsed).toEqual({
      owner: "vitejs",
      repo: "vite",
      ref: "abcd123",
      basePath: "playground/react",
      rawBaseUrl: "https://raw.githubusercontent.com/vitejs/vite/abcd123/playground/react/",
    });
  });

  it("returns null for non-github URL", () => {
    expect(parseGithubUrl("https://gitlab.com/user/repo")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGithubUrl("")).toBeNull();
  });

  it("uses custom defaultRef", () => {
    const parsed = parseGithubUrl("https://github.com/user/repo", "develop");
    expect(parsed!.ref).toBe("develop");
    expect(parsed!.rawBaseUrl).toContain("develop");
  });

  it("parses URL without trailing path", () => {
    const parsed = parseGithubUrl("https://github.com/user/repo/tree/v2.0");
    expect(parsed!.ref).toBe("v2.0");
    expect(parsed!.basePath).toBe("");
  });
});

describe("githubResolverPlugin", () => {
  function setupPlugin(repoUrl: string, branchOrCommit?: string) {
    const plugin = githubResolverPlugin({
      repoUrl,
      ...(branchOrCommit !== undefined ? { branchOrCommit } : {}),
    });
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

  it("registers correctly and resolves entry point", async () => {
    const { resolveCbs, build } = setupPlugin("https://github.com/foo/bar");

    expect(build.onResolve).toHaveBeenCalled();
    expect(build.onLoad).toHaveBeenCalled();

    const resolved = await resolve(resolveCbs, {
      path: "index.ts",
      kind: "entry-point",
    });

    expect(resolved).toEqual({
      path: "https://raw.githubusercontent.com/foo/bar/main/index.ts",
      namespace: "github-url",
    });
  });

  it("resolves relative imports inside github-url namespace", async () => {
    const { resolveCbs } = setupPlugin("https://github.com/foo/bar");

    const resolved = await resolve(resolveCbs, {
      path: "./utils.ts",
      namespace: "github-url",
      importer: "https://raw.githubusercontent.com/foo/bar/main/src/index.ts",
    });

    expect(resolved).toEqual({
      path: "https://raw.githubusercontent.com/foo/bar/main/src/utils.ts",
      namespace: "github-url",
    });
  });

  it("resolves absolute paths in github-url namespace", async () => {
    const { resolveCbs } = setupPlugin("https://github.com/foo/bar");

    const resolved = await resolve(resolveCbs, {
      path: "/lib/helper.ts",
      namespace: "github-url",
      importer: "https://raw.githubusercontent.com/foo/bar/main/src/index.ts",
    });

    expect(resolved).toBeDefined();
    expect((resolved as { namespace: string }).namespace).toBe("github-url");
  });

  it("resolves https:// URLs in github-url namespace", async () => {
    const { resolveCbs } = setupPlugin("https://github.com/foo/bar");

    const resolved = await resolve(resolveCbs, {
      path: "https://esm.sh/react",
      namespace: "github-url",
    });

    expect(resolved).toEqual({
      path: "https://esm.sh/react",
      namespace: "github-url",
    });
  });

  it("returns undefined for bare specifiers (npm packages)", async () => {
    const { resolveCbs } = setupPlugin("https://github.com/foo/bar");

    const resolved = await resolve(resolveCbs, {
      path: "lodash",
      kind: "import-statement",
      namespace: "file",
    });

    expect(resolved).toBeUndefined();
  });

  it("returns undefined when parsed is null (invalid URL)", async () => {
    const { resolveCbs } = setupPlugin("not-a-github-url");

    const resolved = await resolve(resolveCbs, {
      path: "index.ts",
      kind: "entry-point",
    });

    expect(resolved).toBeUndefined();
  });

  it("loads and caches content from github", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("export const x = 1;"),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/utils.ts",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { contents: string }).contents).toBe("export const x = 1;");
    expect((result as { loader: string }).loader).toBe("ts");

    vi.restoreAllMocks();
  });

  it("returns cached content on subsequent load", async () => {
    const cache = new Map<string, string | Uint8Array>();
    cache.set("https://raw.githubusercontent.com/foo/bar/main/cached.ts", "cached content");
    const plugin = githubResolverPlugin({
      repoUrl: "https://github.com/foo/bar",
      cache,
    });

    const loadCbs: Array<(args: OnLoadArgs) => unknown> = [];
    const build = {
      onResolve: vi.fn(),
      onLoad: vi.fn().mockImplementation((_opts: unknown, cb: (args: OnLoadArgs) => unknown) => {
        loadCbs.push(cb);
      }),
    } as unknown as PluginBuild;

    plugin.setup(build);

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/cached.ts",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { contents: string }).contents).toBe("cached content");
  });

  it("tries extensions when initial fetch fails", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: false } as Response) // no ext
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("found with .ts ext"),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response); // .ts ext

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/module",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { contents: string }).contents).toBe("found with .ts ext");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("throws when no extension resolves", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve({ ok: false } as Response),
    );

    await expect(
      loadCbs[0]!({
        path: "https://raw.githubusercontent.com/foo/bar/main/nonexistent",
        namespace: "github-url",
        suffix: "",
        pluginData: undefined,
        with: {},
      } as OnLoadArgs),
    ).rejects.toThrow("Failed to resolve");

    vi.restoreAllMocks();
  });

  it("handles binary files correctly", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");
    const buffer = new ArrayBuffer(4);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(buffer),
    } as unknown as Response);

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/font.woff2",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { loader: string }).loader).toBe("binary");

    vi.restoreAllMocks();
  });

  it("detects CSS loader from path", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("body { margin: 0; }"),
    } as unknown as Response);

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/style.css",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { loader: string }).loader).toBe("css");

    vi.restoreAllMocks();
  });

  it("detects JSON loader from path", async () => {
    const { loadCbs } = setupPlugin("https://github.com/foo/bar");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('{"key":"value"}'),
    } as unknown as Response);

    const result = await loadCbs[0]!({
      path: "https://raw.githubusercontent.com/foo/bar/main/data.json",
      namespace: "github-url",
      suffix: "",
      pluginData: undefined,
      with: {},
    } as OnLoadArgs);

    expect(result).toBeDefined();
    expect((result as { loader: string }).loader).toBe("json");

    vi.restoreAllMocks();
  });
});
