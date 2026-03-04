import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "incremental-test-mcp",
      include: ["../../.tests/incremental-test-mcp/**/*.test.ts"],
    },
  }),
);
