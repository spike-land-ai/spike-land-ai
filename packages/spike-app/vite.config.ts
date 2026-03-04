import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
