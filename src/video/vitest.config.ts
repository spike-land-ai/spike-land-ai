import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "video",
      environment: "jsdom",
      pool: "forks",
      fileParallelism: true,
      silent: true,
      include: ["**/*.test.ts", "**/*.test.tsx"],
      coverage: {
        include: ["**/*.ts", "**/*.tsx"],
        exclude: ["**/*.test.ts", "**/*.test.tsx", "__test-utils__/**", "index.ts"],
      },
    },
  }),
);
