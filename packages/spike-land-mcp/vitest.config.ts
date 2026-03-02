import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      // Include only infra modules; tool definitions are data-only registrations
      // that require integration tests against the real MCP transport
      include: [
        "src/auth/**",
        "src/db/**",
        "src/kv/**",
        "src/mcp/**",
        "src/procedures/**",
        "src/routes/**",
        "src/tools/tool-helpers.ts",
        "src/tools/tool-factory.ts",
        "src/tools/types.ts",
        "src/__test-utils__/**",
        "src/app.ts",
        "src/env.ts",
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
