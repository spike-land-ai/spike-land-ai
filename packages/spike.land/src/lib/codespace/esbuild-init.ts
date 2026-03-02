/**
 * Singleton initialization for esbuild-wasm.
 *
 * esbuild-wasm requires `initialize()` to be called once before
 * `transform()` or `build()` can be used. This module ensures
 * initialization happens exactly once.
 *
 * In the browser, we must pass `wasmURL` so esbuild can fetch the WASM
 * binary over HTTP. In Node.js, esbuild-wasm locates the binary via
 * the filesystem automatically, and passing `wasmURL` causes an error.
 */

import path from "path";
import fs from "fs";

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Resolve the esbuild binary using process.cwd() — not affected by
 * Turbopack's __dirname virtualization.
 */
export function resolveEsbuildBinary(): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules", "@spike-land-ai", "esbuild-wasm", "bin", "esbuild"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function ensureEsbuildReady(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Set ESBUILD_BINARY_PATH before init to work around Turbopack __dirname virtualization
    if (typeof window === "undefined" && !process.env.ESBUILD_BINARY_PATH) {
      const bin = resolveEsbuildBinary();
      if (bin) process.env.ESBUILD_BINARY_PATH = bin;
    }

    const esbuild = await import("@spike-land-ai/esbuild-wasm");
    try {
      const isBrowser = typeof window !== "undefined";
      // Build the package path dynamically so webpack/turbopack won't
      // statically resolve the .wasm file (which fails as an external).
      const wasmPkg = ["@spike-land-ai", "esbuild-wasm", "esbuild.wasm"].join("/");
      await esbuild.initialize({
        ...(isBrowser && {
          wasmURL: new URL(wasmPkg, import.meta.url).href,
        }),
        worker: false,
      });
    } catch (err) {
      // esbuild throws "Cannot call "initialize" more than once' if already init'd
      if (err instanceof Error && err.message.includes("initialize")) {
        // Already initialized — safe to continue
      } else {
        initPromise = null;
        throw err;
      }
    }
    initialized = true;
  })();

  return initPromise;
}

/** Reset state — only used for testing. */
export function resetEsbuild(): void {
  initialized = false;
  initPromise = null;
}
