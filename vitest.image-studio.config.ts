import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "packages/image-studio-worker/frontend/src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["packages/image-studio-worker/frontend/src/setupTests.ts"],
  },
});
