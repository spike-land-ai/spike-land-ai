import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // New src/ packages (consolidated monorepo)
  "src/*/vitest.config.ts",

  // Legacy packages/ that haven't migrated yet (including spike.land)
  "packages/shared",
  "packages/esbuild-wasm-mcp",
  "packages/hackernews-mcp",
  "packages/openclaw-mcp",
  "packages/spike-review",
  "packages/spike-cli",
  "packages/vibe-dev",
  "packages/react-ts-worker",
  "packages/code",
  "packages/transpile",
  "packages/spike-land-backend",
  "packages/spike.land",
  "packages/video",
  "packages/bazdmeg-mcp",
  "packages/chess-engine",
  "packages/mcp-auth",
  "packages/mcp-image-studio",
  "packages/mcp-server-base",
  "packages/spacetimedb-mcp",
  "packages/spacetimedb-platform",
  "packages/spike-app",
  "packages/spike-db",
  "packages/spike-edge",
  "packages/spike-land-mcp",
  "packages/state-machine",
  "packages/qa-studio",

  // Fallback: any src/ package without vitest config
  {
    test: {
      name: "monorepo-src",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "packages/**",
        "src/esbuild-wasm/**",
      ],
    },
  },
]);
