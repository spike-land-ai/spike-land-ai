import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { existsSync, statSync, rmSync, mkdirSync, writeFileSync } from "fs";

/**
 * Invalidate Vite's dep pre-bundle cache when workspace dependency build
 * artifacts change (e.g. block-website regenerates blog content).
 */
function invalidateDepCache(): import("vite").Plugin {
  return {
    name: "invalidate-dep-cache",
    config() {
      const depCacheDir = resolve(import.meta.dirname, "node_modules/.vite");
      // block-website's compiled blog content
      const contentFile = resolve(
        import.meta.dirname,
        "../block-website/dist/core/generated-posts.js",
      );
      const cacheStamp = resolve(depCacheDir, ".content-stamp");

      if (!existsSync(contentFile) || !existsSync(depCacheDir)) return;

      const contentMtime = statSync(contentFile).mtimeMs;
      let stampMtime = 0;
      if (existsSync(cacheStamp)) {
        stampMtime = statSync(cacheStamp).mtimeMs;
      }

      if (contentMtime > stampMtime) {
        // Content changed since last cache — nuke the pre-bundle cache
        rmSync(depCacheDir, { recursive: true, force: true });
      }
    },
    buildEnd() {
      // Write a stamp so we know what content the cache was built against
      const depCacheDir = resolve(import.meta.dirname, "node_modules/.vite");
      const cacheStamp = resolve(depCacheDir, ".content-stamp");
      try {
        mkdirSync(depCacheDir, { recursive: true });
        writeFileSync(cacheStamp, Date.now().toString());
      } catch {
        // Non-critical
      }
    },
  };
}

export default defineConfig({
  plugins: [invalidateDepCache(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "../../src/spike-app"),
      "@spike-land-ai/block-website/ui": resolve(import.meta.dirname, "../../src/block-website/src/ui/index.ts"),
      "@spike-land-ai/block-website/core": resolve(import.meta.dirname, "../../src/block-website/src/core/index.ts"),
      "@spike-land-ai/block-website/mcp": resolve(import.meta.dirname, "../../src/block-website/src/mcp/index.ts"),
      "@spike-land-ai/block-website": resolve(import.meta.dirname, "../../src/block-website/src/index.ts"),
      "@spike-land-ai/shared": resolve(import.meta.dirname, "../../src/shared/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/mcp": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "scheduler"],
          "vendor-tanstack": ["@tanstack/react-router", "@tanstack/react-store", "@tanstack/history"],
          "vendor-framer": ["framer-motion"],
          "vendor-markdown": ["react-markdown", "rehype-raw"],
        },
      },
    },
  },
});
