import { defineConfig, mergeConfig } from "vitest/config";
import path from "node:path";
import baseConfig from "../../vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "src-code",
      environment: "jsdom",
      setupFiles: ["../../.tests/code/setupTests.ts"],
      include: ["../../.tests/code/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules", "dist", ".next"],
      alias: {
        "@": path.resolve(__dirname, "./@"),
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./@"),
      },
    },
  }),
);
