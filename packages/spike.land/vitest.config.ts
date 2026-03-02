import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  ssr: {
    noExternal: ["next-auth"],
  },
  test: {
    name: "root",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    env: {
      DATABASE_URL: "postgresql://mock:5432/mock",
    },
    include: [
      "src/lib/**/*.{test,spec}.{ts,tsx}",
      "src/hooks/**/*.{test,spec}.{ts,tsx}",
      "src/app/**/*.{test,spec}.{ts,tsx}",
      "src/components/**/*.{test,spec}.{ts,tsx}",
      "src/middleware.{test,spec}.{ts,tsx}",
      "apps/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/mcp-explorer.spec.ts"],
    // Use forks pool for better memory isolation in CI
    // Each test file runs in separate process with fresh memory
    pool: "forks",
    // Enable file parallelism for faster execution
    fileParallelism: true,
    // Suppress console output for a cleaner test run
    silent: true,
    // Use reporter optimized for CI
    // When VITEST_COVERAGE is set, also use the coverage mapper for intelligent caching
    reporters: process.env.CI
      ? [
          "github-actions",
          ...(process.env.VITEST_COVERAGE ? ["./scripts/vitest-coverage-mapper-reporter.ts"] : []),
        ]
      : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      // Coverage: all src/lib business logic
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/lib/mcp/server/__test-utils__/**",
        "node_modules/**",
      ],
      thresholds: {
        lines: 96,
        functions: 96,
        branches: 96,
        statements: 96,
      },
    },
  },
  resolve: {
    alias: [
      // Map @store-apps/* sub-path imports to packages/store-apps/*
      {
        find: /^@store-apps\/(.+)$/,
        replacement: path.resolve(__dirname, "./packages/store-apps/$1"),
      },
      { find: "@/components", replacement: path.resolve(__dirname, "./src/components") },
      { find: "@/ui", replacement: path.resolve(__dirname, "./src/components/ui") },
      { find: "@/lib", replacement: path.resolve(__dirname, "./src/lib") },
      { find: "@/utils", replacement: path.resolve(__dirname, "./src/lib/utils") },
      { find: "@/hooks", replacement: path.resolve(__dirname, "./src/hooks") },
      { find: "@/auth", replacement: path.resolve(__dirname, "./src/auth.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@apps", replacement: path.resolve(__dirname, "./apps") },
      { find: "@vercel/kv", replacement: path.resolve(__dirname, "./vitest.mock-vercel-kv.ts") },
      // Mock next-view-transitions to avoid ESM import issues
      {
        find: "next-view-transitions",
        replacement: path.resolve(__dirname, "./vitest.mock-next-view-transitions.tsx"),
      },
      // Fix ESM module resolution for next-auth imports
      // Using require.resolve for Yarn PnP compatibility
      { find: "next/link", replacement: require.resolve("next/link") },
      { find: "next/image", replacement: require.resolve("next/image") },
      { find: "next/server", replacement: require.resolve("next/server") },
      // Map @prisma/client to the generated Prisma client location
      { find: "@prisma/client", replacement: path.resolve(__dirname, "./src/generated/prisma") },
      // Fix: spike-cli exports field references index.mjs but only index.js exists in dist
      {
        find: "@spike-land-ai/spike-cli",
        replacement: path.resolve(__dirname, "../../packages/spike-cli/dist/index.js"),
      },
    ],
  },
});
