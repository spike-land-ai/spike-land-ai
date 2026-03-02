/**
 * Tests for workspace-resolver.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  extractInternalDeps,
  packageNameToPath,
  isPathAllowed,
  getAlwaysAllowedPaths,
  resolveWorkspacePaths,
} from "./workspace-resolver.js";
import { createFakeMonorepo } from "./__test-utils__/fixtures.js";

describe("extractInternalDeps", () => {
  it("extracts @spike-land-ai deps from dependencies", () => {
    const pkg = {
      dependencies: {
        "@spike-land-ai/shared": "1.0.0",
        "@spike-land-ai/mcp-server-base": "*",
        "zod": "4.0.0",
      },
    };
    const result = extractInternalDeps(pkg);
    expect(result).toEqual(["@spike-land-ai/shared", "@spike-land-ai/mcp-server-base"]);
  });

  it("extracts from peerDependencies", () => {
    const pkg = {
      peerDependencies: {
        "@spike-land-ai/tsconfig": "*",
      },
    };
    const result = extractInternalDeps(pkg);
    expect(result).toEqual(["@spike-land-ai/tsconfig"]);
  });

  it("deduplicates across dependencies and peerDependencies", () => {
    const pkg = {
      dependencies: { "@spike-land-ai/shared": "1.0.0" },
      peerDependencies: { "@spike-land-ai/shared": ">=1.0.0" },
    };
    const result = extractInternalDeps(pkg);
    expect(result).toEqual(["@spike-land-ai/shared"]);
  });

  it("returns empty for no internal deps", () => {
    const pkg = { dependencies: { "zod": "4.0.0", "lodash": "4.17.21" } };
    expect(extractInternalDeps(pkg)).toEqual([]);
  });

  it("handles missing fields", () => {
    expect(extractInternalDeps({})).toEqual([]);
  });
});

describe("packageNameToPath", () => {
  it("converts scoped name to packages/ path", () => {
    expect(packageNameToPath("@spike-land-ai/chess-engine")).toBe("packages/chess-engine/");
  });

  it("handles hyphenated names", () => {
    expect(packageNameToPath("@spike-land-ai/mcp-server-base")).toBe("packages/mcp-server-base/");
  });
});

describe("isPathAllowed", () => {
  const allowed = ["packages/chess-engine/", "packages/shared/", "CLAUDE.md"];

  it("allows paths within workspace", () => {
    expect(isPathAllowed("packages/chess-engine/src/index.ts", allowed)).toBe(true);
  });

  it("allows exact matches", () => {
    expect(isPathAllowed("CLAUDE.md", allowed)).toBe(true);
  });

  it("blocks paths outside workspace", () => {
    expect(isPathAllowed("packages/spike-review/src/types.ts", allowed)).toBe(false);
  });

  it("handles leading ./", () => {
    expect(isPathAllowed("./packages/chess-engine/src/elo.ts", allowed)).toBe(true);
  });

  it("handles leading /", () => {
    expect(isPathAllowed("/packages/chess-engine/src/elo.ts", allowed)).toBe(true);
  });

  it("allows everything when allowedPaths is empty", () => {
    expect(isPathAllowed("anywhere/anything.ts", [])).toBe(true);
  });
});

describe("getAlwaysAllowedPaths", () => {
  it("includes root CLAUDE.md", () => {
    expect(getAlwaysAllowedPaths()).toContain("CLAUDE.md");
  });

  it("includes root package.json", () => {
    expect(getAlwaysAllowedPaths()).toContain("package.json");
  });

  it("includes shared config dirs", () => {
    const paths = getAlwaysAllowedPaths();
    expect(paths).toContain("packages/tsconfig/");
    expect(paths).toContain("packages/eslint-config/");
  });
});

describe("resolveWorkspacePaths", () => {
  let cleanup: () => Promise<void>;
  let root: string;

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  it("resolves paths for a package with internal deps", async () => {
    const result = await createFakeMonorepo([
      {
        name: "chess-engine",
        dependencies: {
          "@spike-land-ai/shared": "1.0.0",
        },
      },
      { name: "shared" },
    ]);
    root = result.root;
    cleanup = result.cleanup;

    const resolved = await resolveWorkspacePaths(root, "chess-engine");
    expect(resolved.direct).toEqual(["@spike-land-ai/shared"]);
    expect(resolved.paths).toContain("packages/chess-engine/");
    expect(resolved.paths).toContain("packages/shared/");
    expect(resolved.paths).toContain("CLAUDE.md");
  });

  it("resolves paths for a package with no internal deps", async () => {
    const result = await createFakeMonorepo([{ name: "leaf-pkg" }]);
    root = result.root;
    cleanup = result.cleanup;

    const resolved = await resolveWorkspacePaths(root, "leaf-pkg");
    expect(resolved.direct).toEqual([]);
    expect(resolved.paths).toContain("packages/leaf-pkg/");
    expect(resolved.paths).toContain("CLAUDE.md");
  });
});
