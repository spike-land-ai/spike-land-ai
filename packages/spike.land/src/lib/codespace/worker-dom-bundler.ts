/**
 * Worker-DOM bundler — produces two IIFE bundles:
 *
 * 1. **workerJs**: User code + react-ts-worker runtime, to run inside a Web Worker.
 *    The default export is replaced with a bootstrap that creates a WorkerDocument,
 *    renders via the custom React reconciler, and listens for events from the main thread.
 *
 * 2. **applierJs**: MainThreadApplier from react-ts-worker, exposed as
 *    `window.__WorkerDOMApplier` for the host page to consume.
 */

import type { Loader, Plugin } from "@spike-land-ai/esbuild-wasm";
import path from "node:path";
import { BROWSER_DEFINE, serverFetchPlugin } from "./bundler";

/**
 * Resolve the react-ts-worker dist directory.
 * Uses process.cwd() to avoid require.resolve on an ESM package, which
 * triggers a webpack static-analysis error during Next.js build.
 */
function reactTsWorkerDistDir(): string {
  return path.resolve(process.cwd(), "node_modules/@spike-land-ai/react-ts-worker/dist");
}

/**
 * esbuild plugin that intercepts `react-ts-worker/*` bare specifiers and resolves
 * them to local filesystem files instead of fetching from a CDN.
 *
 * All other specifiers are delegated to `serverFetchPlugin`.
 */
function workerDomPlugin(cache: Map<string, string>): Plugin {
  const distDir = reactTsWorkerDistDir();
  const delegatePlugin = serverFetchPlugin(cache);

  return {
    name: "worker-dom-resolve",
    setup(build) {
      // Intercept react-ts-worker/* bare imports and resolve to local dist
      build.onResolve({ filter: /^react-ts-worker\// }, (args) => {
        // e.g. "react-ts-worker/react" -> "react/index.js"
        const subpath = args.path.replace(/^react-ts-worker\//, "");
        const resolved = path.join(distDir, subpath);

        return { path: resolved, namespace: "file" };
      });

      // Delegate everything else to the server-fetch plugin
      // We need to replicate its setup since esbuild only calls one plugin per specifier
      delegatePlugin.setup(build);
    },
  };
}

/**
 * Worker-side bootstrap code that replaces `export { X as default }`.
 *
 * - Creates a WorkerDocumentImpl + container element (nodeId 0)
 * - Renders the user component via react-ts-worker's createRoot
 * - Sets up `self.onmessage` to forward events from the main thread
 */
function workerBootstrap(componentName: string): string {
  return `
import { WorkerDocumentImpl, createContainerNode } from "react-ts-worker/react-worker-dom/bridge/worker-document";
import { createRoot } from "react-ts-worker/react-worker-dom";

const doc = new WorkerDocumentImpl();
const rootEl = createContainerNode();
const root = createRoot(doc, rootEl);
root.render(jsx(${componentName}, {}));

self.onmessage = function(ev) {
  const msg = ev.data;
  if (msg && msg.kind === "event") {
    // Event forwarding from main thread — handled by the bridge event system
  }
};
`;
}

export async function bundleWorkerDom(session: {
  transpiled: string;
  codeSpace: string;
}): Promise<{ workerJs: string; applierJs: string }> {
  const cache = new Map<string, string>();

  // --- Worker bundle ---
  let workerCode = session.transpiled || "";

  // Extract the default-exported component name and replace with bootstrap
  const exportMatch = workerCode.match(/export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/);
  if (exportMatch) {
    const componentName = exportMatch[1]!;
    workerCode = workerCode.replace(
      /export\s*\{\s*\w+\s+as\s+default\s*\}\s*;?\s*$/,
      workerBootstrap(componentName),
    );
  }

  const { ensureEsbuildReady } = await import("./esbuild-init");
  await ensureEsbuildReady();
  const esbuild = await import("@spike-land-ai/esbuild-wasm");

  let workerJs: string;
  try {
    const workerResult = await esbuild.build({
      stdin: {
        contents: workerCode,
        loader: "js" as Loader,
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
      plugins: [workerDomPlugin(cache)],
      logLevel: "silent",
    });

    workerJs = "";
    for (const file of workerResult.outputFiles ?? []) {
      if (!file.path.endsWith(".css")) {
        workerJs += file.text;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Worker-DOM worker bundle failed for ${session.codeSpace}: ${message}`);
  }

  // --- Applier bundle ---
  const applierSource = `
import { MainThreadApplier } from "react-ts-worker/react-worker-dom/main";
globalThis.__WorkerDOMApplier = MainThreadApplier;
`;

  let applierJs: string;
  try {
    const applierCache = new Map<string, string>();
    const applierResult = await esbuild.build({
      stdin: {
        contents: applierSource,
        loader: "js" as Loader,
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
      plugins: [workerDomPlugin(applierCache)],
      logLevel: "silent",
    });

    applierJs = "";
    for (const file of applierResult.outputFiles ?? []) {
      if (!file.path.endsWith(".css")) {
        applierJs += file.text;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Worker-DOM applier bundle failed for ${session.codeSpace}: ${message}`);
  }

  return { workerJs, applierJs };
}
