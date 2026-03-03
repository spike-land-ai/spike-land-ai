import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "mcp-image-studio",
      pool: "forks",
      fileParallelism: true,
      silent: true,
      coverage: {
        exclude: ["src/**/*.test.ts", "**/*.test.ts", "__test-utils__/**", "index.ts", "generated/**", "cli-server.ts", "db-spacetime.ts"],
      },
    },
  }),
);
