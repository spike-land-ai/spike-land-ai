import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "../../src/"),
    },
  },
  test: {
    root: __dirname,
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/**/*.ts", "*/tools.ts", "*/index.ts"],
      exclude: ["**/*.test.ts", "**/*.config.ts", "**/node_modules/**"],
      thresholds: {
        lines: 96,
        functions: 96,
        branches: 96,
        statements: 96,
      },
    },
  },
});
