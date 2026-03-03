import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "image-studio-worker",
      environment: "node",
      include: ["*.test.ts", "**/*.test.ts"],
      exclude: ["node_modules", "frontend", ".wrangler/**"],
      coverage: {
        exclude: [
          "**/*.test.ts",
          "frontend/**",
          ".wrangler/**",
          "vitest.config.ts",
          "deps/nanoid.ts",
          "migrations/**", 
          "index.ts", 
          "server.ts", 
          "agent/chat-handler.ts", 
          "deps/db.ts", 
          "deps/generation.ts", 
          "tool-registry.ts",
          "env.d.ts",
          "shared-types.ts"
        ],
      },
    },
  }),
);
