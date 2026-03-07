import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/postcss";
import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";

// Resolve packages through PnP so CSS @import "tailwindcss" and @plugin work
const pnpRequire = createRequire(import.meta.url);
const pnpResolveDir = (pkg: string) => dirname(pnpRequire.resolve(`${pkg}/package.json`));

const certDir = resolve(import.meta.dirname, "../../.dev-certs");
const certFile = resolve(certDir, "local.spike.land.pem");
const keyFile = resolve(certDir, "local.spike.land-key.pem");
const hasLocalCerts = existsSync(certFile) && existsSync(keyFile);

/**
 * Vite plugin that rewrites CSS @plugin directives to PnP-resolved paths.
 * Tailwind CSS resolves @plugin from the CSS file's directory, which fails
 * under Yarn PnP when the CSS file is outside the workspace package.
 */
function tailwindPnpPlugin(): Plugin {
  const typographyDir = pnpResolveDir("@tailwindcss/typography");
  return {
    name: "tailwind-pnp-resolve",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".css")) return null;
      if (!code.includes('@plugin "@tailwindcss/typography"')) return null;
      return code.replace('@plugin "@tailwindcss/typography"', `@plugin "${typographyDir}"`);
    },
  };
}

export default defineConfig(() => ({
  publicDir: resolve(import.meta.dirname, "../../src/frontend/platform-frontend/public"),
  plugins: [tailwindPnpPlugin(), react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "../../src/frontend/platform-frontend"),
      "@spike-land-ai/block-website/ui": resolve(
        import.meta.dirname,
        "../../src/core/block-website/core-logic/ui-index.ts",
      ),
      "@spike-land-ai/block-website/core": resolve(
        import.meta.dirname,
        "../../src/core/block-website/core-logic/core-index.ts",
      ),
      "@spike-land-ai/block-website/mcp": resolve(
        import.meta.dirname,
        "../../src/core/block-website/mcp/mcp-index.ts",
      ),
      "@spike-land-ai/block-website": resolve(
        import.meta.dirname,
        "../../src/core/block-website/index.ts",
      ),
      "@spike-land-ai/shared/constants": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/constants-index.ts",
      ),
      "@spike-land-ai/shared/types": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/types-index.ts",
      ),
      "@spike-land-ai/shared/validations": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/validations-index.ts",
      ),
      "@spike-land-ai/shared/utils": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/index.ts",
      ),
      "@spike-land-ai/shared/tool-builder": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/tool-builder-index.ts",
      ),
      "@spike-land-ai/shared": resolve(
        import.meta.dirname,
        "../../src/core/shared-utils/core-logic/index.ts",
      ),
      "monaco-editor": resolve(import.meta.dirname, "../../src/monaco-editor/src/index.ts"),
      // PnP resolve aliases for CSS @import "tailwindcss" and @plugin "@tailwindcss/typography"
      tailwindcss: pnpResolveDir("tailwindcss"),
      "@tailwindcss/typography": pnpResolveDir("@tailwindcss/typography"),
    },
  },
  server: {
    fs: {
      allow: [resolve(import.meta.dirname, "../..")],
    },
    ...(hasLocalCerts
      ? {
          host: "0.0.0.0",
          port: 5173,
          hmr: {
            host: "local.spike.land",
            protocol: "wss",
          },
          https: {
            key: readFileSync(keyFile),
            cert: readFileSync(certFile),
          },
        }
      : {}),
    proxy: {
      "/api": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "/errors": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "/analytics": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "/mcp": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "/oauth": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "/transpile": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
      "^/blog/.+/.+\\.(png|jpe?g|gif|webp|svg|avif)$": {
        target: "https://local.spike.land:8787",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    "process.env": "{}",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@tanstack/")) return "vendor-tanstack";
          if (id.includes("/framer-motion/")) return "vendor-framer-motion";
          if (id.includes("/@xterm/")) return "vendor-xterm";
          if (id.includes("/typescript/") || id.includes("/@typescript/ata/"))
            return "vendor-typescript";
          if (
            id.includes("/lucide-react/") ||
            id.includes("/clsx/") ||
            id.includes("/class-variance-authority/") ||
            id.includes("/tailwind-merge/") ||
            id.includes("/@radix-ui/")
          )
            return "vendor-ui";
          return "vendor-misc";
        },
      },
    },
  },
}));
