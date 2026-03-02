import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "qa-studio",
    globals: true,
    pool: "forks",
    fileParallelism: true,
    silent: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        lines: 96,
        functions: 96,
        branches: 96,
        statements: 96,
      },
    },
  },
});
