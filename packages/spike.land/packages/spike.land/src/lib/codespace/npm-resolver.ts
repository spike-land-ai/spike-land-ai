import type { Plugin } from "@spike-land-ai/esbuild-wasm";
import { tryCatch } from "@/lib/try-catch";

export interface NpmResolverOptions {
  mode?: "external" | "bundle";
  cache?: Map<string, string | Uint8Array>;
}

export function npmResolverPlugin(options: NpmResolverOptions = {}): Plugin {
  const { mode = "external", cache = new Map() } = options;
  return {
    name: "npm-resolver",
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (
          args.path.startsWith(".") || args.path.startsWith("/")
          || args.path.startsWith("https://")
        ) {
          return undefined;
        }

        // Bare import - use esm.sh
        if (mode === "external") {
          return { path: `https://esm.sh/${args.path}`, external: true };
        }

        return {
          path: `https://esm.sh/${args.path}?bundle=true`,
          namespace: "npm-url",
        };
      });

      // Handle esm.sh protocol for relative imports or further resolutions if mode=bundle
      build.onResolve({ filter: /^https:\/\/esm\.sh\/.*/ }, args => {
        return { path: args.path, namespace: "npm-url" };
      });

      // Relative inner imports from an npm module in bundle mode
      build.onResolve({ filter: /.*/, namespace: "npm-url" }, args => {
        if (args.path.startsWith(".")) {
          return {
            path: new URL(args.path, args.importer).href,
            namespace: "npm-url",
          };
        }
        return undefined;
      });

      build.onLoad({ filter: /.*/, namespace: "npm-url" }, async args => {
        if (cache.has(args.path)) {
          return { contents: cache.get(args.path), loader: "js" };
        }
        const { data: response, error } = await tryCatch(fetch(args.path));
        if (error || !response || !response.ok) {
          throw new Error(`Failed to fetch npm package: ${args.path}`);
        }
        const { data: contents, error: textError } = await tryCatch(
          response.text(),
        );
        if (textError || contents === null) {
          throw new Error(`Failed to read npm package text: ${args.path}`);
        }
        cache.set(args.path, contents);
        return { contents, loader: "js" };
      });
    },
  };
}
