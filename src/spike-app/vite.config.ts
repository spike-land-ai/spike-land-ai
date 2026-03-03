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
      const depCacheDir = resolve(__dirname, "node_modules/.vite");
      // block-website's compiled blog content
      const contentFile = resolve(
        __dirname,
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
      const depCacheDir = resolve(__dirname, "node_modules/.vite");
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
    alias: { "@": resolve(__dirname, ".") },
  },
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
