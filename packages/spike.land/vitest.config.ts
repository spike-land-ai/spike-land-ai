import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

const aliases = [
  // Map @store-apps/* sub-path imports to packages/store-apps/*
  {
    find: /^@store-apps\/(.+)$/,
    replacement: path.resolve(root, "./packages/store-apps/$1"),
  },
  { find: "@/components", replacement: path.resolve(root, "./src/components") },
  { find: "@/ui", replacement: path.resolve(root, "./src/components/ui") },
  { find: "@/lib", replacement: path.resolve(root, "./src/lib") },
  { find: "@/utils", replacement: path.resolve(root, "./src/lib/utils") },
  { find: "@/hooks", replacement: path.resolve(root, "./src/hooks") },
  { find: "@/auth", replacement: path.resolve(root, "./src/auth.ts") },
  { find: "@", replacement: path.resolve(root, "./src") },
  { find: "@apps", replacement: path.resolve(root, "./apps") },
  { find: "@vercel/kv", replacement: path.resolve(root, "./vitest.mock-vercel-kv.ts") },
  // Mock next-view-transitions to avoid ESM import issues
  {
    find: "next-view-transitions",
    replacement: path.resolve(root, "./vitest.mock-next-view-transitions.tsx"),
  },
  // next/* module resolution — hoisted to monorepo root node_modules
  { find: "next/link", replacement: path.resolve(root, "../../node_modules/next/link.js") },
  { find: "next/image", replacement: path.resolve(root, "../../node_modules/next/image.js") },
  { find: "next/server", replacement: path.resolve(root, "../../node_modules/next/server.js") },
  // Map @prisma/client to the generated Prisma client location
  { find: "@prisma/client", replacement: path.resolve(root, "./src/generated/prisma") },
  // Fix: spike-cli exports field references index.mjs but only index.js exists in dist
  {
    find: "@spike-land-ai/spike-cli",
    replacement: path.resolve(root, "../../dist/spike-cli/index.js"),
  },
];

export default defineConfig({
  plugins: [react()],
  ssr: {
    noExternal: ["next-auth"],
  },
  test: {
    name: "spike.land",
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
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.next/**", "**/mcp-explorer.spec.ts"],
    // Use forks pool for better memory isolation in CI
    // Each test file runs in separate process with fresh memory
    pool: "forks",
    // Enable file parallelism for faster execution
    fileParallelism: true,
    // Suppress console output for a cleaner test run
    silent: true,
    // Minimal one-line reporter locally, github-actions in CI
    // When VITEST_COVERAGE is set, also use the coverage mapper for intelligent caching
    reporters: process.env.CI
      ? [
          "github-actions",
          ...(process.env.VITEST_COVERAGE ? ["./scripts/vitest-coverage-mapper-reporter.ts"] : []),
        ]
      : ["../../vitest-minimal-reporter.ts"],
    alias: aliases,
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
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
    alias: aliases,
  },
});
