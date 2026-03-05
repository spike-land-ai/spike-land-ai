import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname ?? __dirname);

/**
 * Shared Vitest base configuration for all @spike-land-ai packages.
 *
 * Usage in src/<pkg>/vitest.config.ts:
 *
 *   import { defineConfig, mergeConfig } from "vitest/config";
 *   import baseConfig from "../../vitest.base";
 *   export default mergeConfig(baseConfig, defineConfig({ test: { name: "my-pkg" } }));
 */
export default defineConfig({
  resolve: {
    alias: {
      "@spike-land-ai/shared/tool-builder": path.join(root, "src/shared/tool-builder/index.ts"),
      "@spike-land-ai/shared": path.join(root, "src/shared/index.ts"),
      "@spike-land-ai/block-sdk/storage": path.join(root, "src/block-sdk/storage/index.ts"),
      "@spike-land-ai/block-sdk/adapters/d1": path.join(root, "src/block-sdk/adapters/d1.ts"),
      "@spike-land-ai/block-sdk/adapters/idb": path.join(root, "src/block-sdk/adapters/idb.ts"),
      "@spike-land-ai/block-sdk/react": path.join(root, "src/block-sdk/react/index.ts"),
      "@spike-land-ai/block-sdk/mcp": path.join(root, "src/block-sdk/mcp/index.ts"),
      "@spike-land-ai/block-sdk": path.join(root, "src/block-sdk/index.ts"),
      "@spike-land-ai/block-tasks": path.join(root, "src/block-tasks/index.ts"),
      "@spike-land-ai/mcp-server-base": path.join(root, "src/mcp-server-base/index.ts"),
    },
  },
  test: {
    reporters: ["../../vitest-minimal-reporter.ts"],
    globals: true,
    environment: "node",
    include: [],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "**/*.ts"],
      exclude: ["../../.tests/**", "vitest.config.ts"],
      thresholds: {
        lines: 96,
        functions: 96,
        branches: 96,
        statements: 96,
      },
    },
  },
});
