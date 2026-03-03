import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  build: vi.fn(),
  version: "0.24.2",
}));

vi.mock("@/lib/codespace/esbuild-init", () => ({
  ensureEsbuildReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    toolInvocation: { create: vi.fn() },
  },
}));

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      dependencies: { "react": "18.0.0" },
    }),
    text: async () => "{}",
  }),
);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBuildFromGithubTools } from "./build-from-github";
import * as esbuild from "@spike-land-ai/esbuild-wasm";

describe("build_from_github tool", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBuildFromGithubTools(registry, userId);
  });

  it("should register the build_from_github tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
  });

  it("should fail on invalid url", async () => {
    const handler = registry.handlers.get("build_from_github")!;
    const result = await handler({
      repoUrl: "invalid-url",
      minify: true,
      npmMode: "external",
    });
    expect(getText(result)).toContain("Invalid GitHub URL format");
  });

  it("should execute build successfully", async () => {
    vi.mocked(esbuild.build).mockResolvedValue({
      outputFiles: [{
        text: "console.log('built');",
        path: "out.js",
        hash: new Uint8Array(),
      }],
      errors: [],
      warnings: [],
    } as any);

    const handler = registry.handlers.get("build_from_github")!;
    const result = await handler({
      repoUrl: "https://github.com/foo/bar",
      minify: true,
      npmMode: "bundle",
    });

    expect(getText(result)).toContain("Successfully built");
    expect(getText(result)).toContain("console.log('built');");
  });
});
