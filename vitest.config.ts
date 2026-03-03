import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/spike.land",
      "packages/code",
      "packages/spike-app",
      "src/code",
      "src/spike-app",
      "src/spike-edge",
    ],
  },
});
