import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "src-spike-review",
      include: ["../../.tests/spike-review/**/*.test.ts"],
      exclude: ["node_modules", "dist"],
      coverage: {
        include: ["src/spike-review/**/*.ts"],
        exclude: [
          "src/spike-review/dist/**",
          "src/spike-review/vitest.config.ts",
          // cli.ts is the process entrypoint — not exercised in unit tests
          "src/spike-review/cli.ts",
        ],
      },
    },
  }),
);
