import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

const certDir = resolve(import.meta.dirname, "../../.dev-certs");
const certFile = resolve(certDir, "local.spike.land.pem");
const keyFile = resolve(certDir, "local.spike.land-key.pem");
const hasLocalCerts = existsSync(certFile) && existsSync(keyFile);

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
    fs: {
      allow: [resolve(import.meta.dirname, "../..")],
    },
    ...(hasLocalCerts
      ? {
          host: "local.spike.land",
          https: {
            key: readFileSync(keyFile),
            cert: readFileSync(certFile),
          },
        }
      : {}),
    proxy: {
      "/api": {
        target: "https://api.spike.land",
        changeOrigin: true,
        secure: true,
      },
      "/mcp": {
        target: "https://spike.land",
        changeOrigin: true,
        secure: true,
      },
      "/oauth": {
        target: "https://spike.land",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
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
