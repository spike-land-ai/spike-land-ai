import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "state-machine",
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/cli.ts",
        "src/index.ts",
        "src/types.ts",
        "src/user-test.ts",
      ],
      thresholds: {
        lines: 96,
        functions: 96,
        branches: 96,
        statements: 96,
      },
    },
  },
});
