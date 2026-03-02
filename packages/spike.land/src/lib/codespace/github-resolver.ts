import type { Loader, Plugin } from "@spike-land-ai/esbuild-wasm";
import { tryCatch } from "@/lib/try-catch";

export interface GithubResolverOptions {
  repoUrl: string;
  branchOrCommit?: string;
  cache?: Map<string, string | Uint8Array>;
}

export function parseGithubUrl(url: string, defaultRef = "main") {
  // Support URLs like:
  // - https://github.com/vitejs/vite
  // - https://github.com/vitejs/vite/tree/main/playground/react
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/?(.*))?/);
  if (!match) return null;

  const [, owner, repo, ref, path] = match;
  return {
    owner,
    repo,
    ref: ref || defaultRef,
    basePath: path || "",
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref || defaultRef}/${
      path ? path + "/" : ""
    }`,
  };
}

function guessLoader(path: string): Loader {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (/\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/i.test(path)) return "binary";
  return "js";
}

export function githubResolverPlugin(options: GithubResolverOptions): Plugin {
  const parsed = parseGithubUrl(options.repoUrl, options.branchOrCommit);
  const cache = options.cache || new Map<string, string | Uint8Array>();

  return {
    name: "github-resolver",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!parsed) return;

        if (args.kind === "entry-point") {
          const normalizedPath = args.path.replace(/^\.\//, "").replace(/^\//, "");
          const url = new URL(normalizedPath, parsed.rawBaseUrl).href;
          return { path: url, namespace: "github-url" };
        }

        if (
          !args.path.startsWith(".") &&
          !args.path.startsWith("/") &&
          !args.path.startsWith("https://")
        ) {
          return undefined;
        }

        if (args.path.startsWith("https://")) {
          return { path: args.path, namespace: "github-url" };
        }

        if (args.namespace === "github-url") {
          if (args.path.startsWith("/")) {
            const url = new URL(args.path.replace(/^\//, ""), parsed.rawBaseUrl).href;
            return { path: url, namespace: "github-url" };
          }
          const url = new URL(args.path, args.importer).href;
          return { path: url, namespace: "github-url" };
        }

        return undefined;
      });

      build.onLoad({ filter: /.*/, namespace: "github-url" }, async (args) => {
        if (cache.has(args.path)) {
          return {
            contents: cache.get(args.path)!,
            loader: guessLoader(args.path),
          };
        }

        const fetchPath = args.path;
        let response: Response | null = null;
        let finalUrl = fetchPath;

        // Try extensions
        const extensions = [
          "",
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          "/index.ts",
          "/index.tsx",
          "/index.js",
          "/index.jsx",
          ".css",
          ".json",
        ];

        for (const ext of extensions) {
          const tryUrl = fetchPath + ext;
          if (cache.has(tryUrl)) {
            return { contents: cache.get(tryUrl)!, loader: guessLoader(tryUrl) };
          }
          const { data, error } = await tryCatch(fetch(tryUrl));
          if (!error && data && data.ok) {
            response = data;
            finalUrl = tryUrl;
            break;
          }
        }

        if (!response) {
          throw new Error(`Failed to resolve ${fetchPath}`);
        }

        const loader = guessLoader(finalUrl);
        if (loader === "binary") {
          const { data: buffer } = await tryCatch(response.arrayBuffer());
          if (buffer) {
            const uint8Array = new Uint8Array(buffer);
            cache.set(finalUrl, uint8Array);
            return { contents: uint8Array, loader };
          }
          throw new Error(`Failed to read binary ${finalUrl}`);
        }

        const { data: contents } = await tryCatch(response.text());
        if (contents === null) {
          throw new Error(`Failed to read ${finalUrl}`);
        }

        cache.set(finalUrl, contents);

        return { contents, loader };
      });
    },
  };
}
