import type { Loader, Plugin } from "@spike-land-ai/esbuild-wasm";
import { tryCatch } from "@/lib/try-catch";
import { IMPORT_MAP } from "./html-template";
import { ESM_CDN, ESM_DEPS_PARAM } from "./constants";

const COMPONENT_URL = process.env.SPIKE_LAND_COMPONENT_URL ?? "https://testing.spike.land";

export const BROWSER_DEFINE: Record<string, string> = {
  "process.env['NODE_ENV']": JSON.stringify("production"),
  "process.env['NODE_DEBUG']": JSON.stringify(false),
  "process.platform": JSON.stringify("browser"),
  "process.browser": JSON.stringify(true),
  "process.env['BABEL_TYPES_8_BREAKING']": JSON.stringify(false),
  "process.env['DEBUG']": JSON.stringify(false),
  "process.versions.node": JSON.stringify("v20.3.1"),
  "process.versions.pnp": JSON.stringify(false),
  "process.version.node": JSON.stringify("v20.3.1"),
  "process.env.isBrowser": JSON.stringify(true),
  "process.env['LANG']": JSON.stringify("en_US.UTF-8"),
  "process.env.isWebworker": JSON.stringify(true),
  "process.env['VI_TEST']": JSON.stringify(false),
  isBrowser: JSON.stringify(true),
  isJest: JSON.stringify(false),
  "process.env.version": JSON.stringify("1.1.1"),
  global: "globalThis",
  WORKER_DOM_DEBUG: JSON.stringify(false),
  "process.env['DUMP_SESSION_KEYS']": JSON.stringify(false),
  version: JSON.stringify("v20.3.1"),
  nodeVersion: JSON.stringify("v20.3.1"),
  env: JSON.stringify({
    NODE_ENV: "production",
    BABEL_TYPES_8_BREAKING: JSON.stringify(false),
    version: "v20.3.1",
    browser: JSON.stringify(true),
    isWebworker: JSON.stringify(true),
    NODE_DEBUG: JSON.stringify(true),
    DEBUG: JSON.stringify(false),
    isBrowser: JSON.stringify(true),
  }),
  browser: JSON.stringify(true),
};

/**
 * Recursively process CSS to inline @import statements and resolve url() references.
 */
async function processCSS(
  css: string,
  baseURL: string,
  cache: Map<string, string>,
  depth = 0,
): Promise<string> {
  if (depth > 5) return css;

  // Handle @import statements
  const importRegex = /@import\s+(?:url\(['"]?(.+?)['"]?\)|['"](.+?)['"])/g;
  let match;
  let processedCss = css;

  while ((match = importRegex.exec(css)) !== null) {
    const importUrlPath = match[1] || match[2]!;
    const absoluteUrl = new URL(importUrlPath, baseURL).toString();

    if (cache.has(absoluteUrl)) {
      processedCss = processedCss.replace(match[0], cache.get(absoluteUrl)!);
      continue;
    }

    const { data: response, error: fetchErr } = await tryCatch(fetch(absoluteUrl));
    if (fetchErr || !response || !response.ok) {
      processedCss = processedCss.replace(match[0], `/* Failed to load: ${absoluteUrl} */`);
      continue;
    }
    const { data: importedCSS, error: textErr } = await tryCatch(response.text());
    if (textErr || importedCSS === null) {
      processedCss = processedCss.replace(match[0], `/* Failed to read: ${absoluteUrl} */`);
      continue;
    }
    const processed = await processCSS(importedCSS, absoluteUrl, cache, depth + 1);
    cache.set(absoluteUrl, processed);
    processedCss = processedCss.replace(match[0], processed);
  }
  css = processedCss;

  // Handle url() references
  const urlRegex = /url\(['"]?(.+?)['"]?\)/g;
  const urlMatches = Array.from(css.matchAll(urlRegex));

  for (const urlMatch of urlMatches) {
    const fullMatch = urlMatch[0];
    const urlPath = urlMatch[1];

    if (urlPath && !urlPath.startsWith("data:")) {
      const absoluteUrl = new URL(urlPath, baseURL).toString();

      if (cache.has(absoluteUrl)) {
        css = css.replace(fullMatch, cache.get(absoluteUrl)!);
        continue;
      }

      const { data: response, error: fetchErr } = await tryCatch(fetch(absoluteUrl));
      if (fetchErr || !response || !response.ok) {
        css = css.replace(fullMatch, `url("/* Failed: ${absoluteUrl} */")`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      let newUrlValue: string;

      if (contentType.includes("font/")) {
        const { data: buffer, error: bufErr } = await tryCatch(response.arrayBuffer());
        if (bufErr || !buffer) {
          css = css.replace(fullMatch, `url("/* Failed font: ${absoluteUrl} */")`);
          continue;
        }
        const fontType = contentType.split("/").pop();
        const base64 = Buffer.from(buffer).toString("base64");
        newUrlValue = `url("data:font/${fontType};base64,${base64}")`;
      } else {
        newUrlValue = `url("${absoluteUrl}")`;
      }

      cache.set(absoluteUrl, newUrlValue);
      css = css.replace(fullMatch, newUrlValue);
    }
  }

  return css;
}

export function serverFetchPlugin(cache: Map<string, string>): Plugin {
  const imports = IMPORT_MAP.imports as Record<string, string>;

  return {
    name: "server-fetch",
    setup(build) {
      // Resolve bare specifiers using import map
      build.onResolve({ filter: /.*/ }, (args) => {
        // Already an HTTP URL — keep in http-url namespace
        if (/^https?:\/\//.test(args.path)) {
          return { path: args.path, namespace: "http-url" };
        }

        // Check import map for exact match
        if (imports[args.path]) {
          return { path: imports[args.path]!, namespace: "http-url" };
        }

        // Relative import inside an http-url module
        if (args.namespace === "http-url") {
          return {
            path: new URL(args.path, args.importer).toString(),
            namespace: "http-url",
          };
        }

        // Absolute paths from the old transpiler (e.g. "/lucide-react?bundle=true&...",
        // "/@/components/ui/button.mjs") — resolve via CDN or testing.spike.land
        if (args.path.startsWith("/")) {
          if (args.path.startsWith("/@/")) {
            // Local component paths served by the component worker
            const workerUrl = `${COMPONENT_URL}${args.path}`;
            return { path: workerUrl, namespace: "http-url" };
          }
          // CDN-relative paths (e.g. /lucide-react?bundle=true&...)
          const cdnUrl = `${ESM_CDN}${args.path}`;
          return { path: cdnUrl, namespace: "http-url" };
        }

        // Local @/ component paths (bare specifiers from transpilation)
        if (args.path.startsWith("@/")) {
          const stripped = args.path.replace(/\.(tsx?|jsx?)$/, "");
          const ext = stripped.match(/\.\w+$/) ? "" : ".mjs";
          const workerUrl = `${COMPONENT_URL}/${stripped}${ext}`;
          return { path: workerUrl, namespace: "http-url" };
        }

        // Unknown bare specifier — resolve via esm.sh CDN with bundle
        if (!args.path.startsWith(".")) {
          const cdnUrl = `${ESM_CDN}/${args.path}?bundle=true&external=react,react-dom,react-is&${ESM_DEPS_PARAM}`;
          return { path: cdnUrl, namespace: "http-url" };
        }

        return undefined;
      });

      // Load HTTP URLs by fetching them
      build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
        if (cache.has(args.path)) {
          const cached = cache.get(args.path)!;
          const loader = guessLoader(args.path, "");
          return { contents: cached, loader };
        }

        const { data: response, error: fetchErr } = await tryCatch(fetch(args.path));
        if (fetchErr || !response) {
          return {
            contents: `/* Fetch error for ${args.path}: ${fetchErr} */`,
            loader: "js" as Loader,
          };
        }
        if (!response.ok) {
          return {
            contents: `/* Failed to fetch ${args.path}: ${response.status} */`,
            loader: "js" as Loader,
          };
        }

        const { data: contents, error: textErr } = await tryCatch(response.text());
        if (textErr || contents === null) {
          return {
            contents: `/* Failed to read ${args.path}: ${textErr} */`,
            loader: "js" as Loader,
          };
        }

        const contentType = response.headers.get("content-type") || "";
        const loader = guessLoader(args.path, contentType);

        if (loader === "css") {
          const processed = await processCSS(contents, args.path, cache);
          cache.set(args.path, processed);
          return { contents: processed, loader };
        }

        cache.set(args.path, contents);
        return { contents, loader };
      });
    },
  };
}

function guessLoader(path: string, contentType: string): Loader {
  if (contentType.includes("text/css") || path.endsWith(".css")) return "css";
  if (
    contentType.includes("application/javascript") ||
    path.endsWith(".js") ||
    path.endsWith(".mjs")
  ) {
    return "js";
  }
  if (contentType.includes("application/json") || path.endsWith(".json")) {
    return "json";
  }
  if (contentType.includes("font/")) return "binary";
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  return "js";
}

export async function bundleCodespace(session: {
  transpiled: string;
  code?: string;
  html?: string;
  css?: string;
  codeSpace: string;
}): Promise<{ js: string; css: string }> {
  // Rewrite `export { X as default }` to a render bootstrap using synchronous import
  // (IIFE bundles cannot use top-level await, and react-dom/client will be inlined by the plugin)
  let code = session.transpiled || "";
  code = code.replace(
    /export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/,
    `import {createRoot} from "react-dom/client";\ncreateRoot(document.getElementById("embed")).render(jsx($1, {}));`,
  );

  const cache = new Map<string, string>();

  try {
    const { ensureEsbuildReady } = await import("./esbuild-init");
    await ensureEsbuildReady();
    const esbuild = await import("@spike-land-ai/esbuild-wasm");
    const result = await esbuild.build({
      stdin: {
        contents: code,
        loader: "js",
        resolveDir: "/",
      },
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
      treeShaking: true,
      write: false,
      minify: true,
      define: BROWSER_DEFINE,
      plugins: [serverFetchPlugin(cache)],
      logLevel: "silent",
    });

    let js = "";
    let css = "";

    for (const file of result.outputFiles ?? []) {
      if (file.path.endsWith(".css")) {
        css += file.text;
      } else {
        js += file.text;
      }
    }

    return { js, css };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Bundle failed for ${session.codeSpace}: ${message}`);
  }
}
