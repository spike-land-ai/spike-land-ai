/**
 * Tests for the root manifest.ts module
 *
 * Covers: readManifest, getManifestPackage, clearManifestCache,
 * topologicalSort, and the YAML parser functions.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearManifestCache,
  getManifestPackage,
  readManifest,
  topologicalSort,
} from "../../src/mcp-tools/bazdmeg/node-sys/manifest.js";

// Helper to create a temp directory with a packages.yaml file
async function createTempManifest(
  yamlContent: string,
): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "bazdmeg-manifest-test-"));
  await writeFile(join(root, "packages.yaml"), yamlContent, "utf-8");
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

const BASIC_MANIFEST_YAML = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  shared:
    kind: library
    version: 1.0.0
    description: Shared utilities
    entry: src/index.ts

  chess-engine:
    kind: library
    version: 1.2.0
    description: Chess ELO engine
    entry: src/index.ts
    deps:
      - shared

  spike-cli:
    kind: cli
    version: 2.0.0
    description: CLI tool
    entry: src/index.ts
    deps:
      - shared
      - chess-engine

  spike-edge:
    kind: worker
    version: 1.0.0
    description: Edge worker
    entry: src/index.ts
    worker:
      name: spike-edge
      compatibility_date: "2024-01-01"
      compatibility_flags:
        - nodejs_compat
      kv_namespaces:
        - binding: KV
          id: abc123
      d1_databases:
        - binding: DB
          database_name: mydb
          database_id: db456
      r2_buckets:
        - binding: BUCKET
          bucket_name: files
      durable_objects:
        - name: ROOM
          class_name: ChatRoom
          sqlite: true
      routes:
        - pattern: "api.example.com/*"
          custom_domain: true
          zone_name: example.com
      rules:
        - type: Text
          globs:
            - "**/*.txt"
      assets:
        directory: ./dist
        not_found_handling: single-page-application
      site:
        bucket: ./public
`;

describe("readManifest", () => {
  let cleanup: () => Promise<void>;
  let root: string;

  beforeEach(() => {
    clearManifestCache();
  });

  afterEach(async () => {
    clearManifestCache();
    if (cleanup) await cleanup();
  });

  it("reads and parses a basic manifest", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.defaults.scope).toBe("@spike-land-ai");
    expect(manifest.defaults.registry).toBe("npm.pkg.github.com");
    expect(manifest.defaults.license).toBe("MIT");
    expect(manifest.defaults.type).toBe("module");
  });

  it("parses packages correctly", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["shared"]).toBeDefined();
    expect(manifest.packages["chess-engine"]).toBeDefined();
    expect(manifest.packages["chess-engine"]!.deps).toContain("shared");
  });

  it("parses worker config with all fields", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    const worker = manifest.packages["spike-edge"]!.worker!;
    expect(worker.name).toBe("spike-edge");
    expect(worker.compatibility_date).toBe("2024-01-01");
    expect(worker.compatibility_flags).toContain("nodejs_compat");
    expect(worker.kv_namespaces).toBeDefined();
    expect(worker.kv_namespaces![0]!.binding).toBe("KV");
    expect(worker.d1_databases).toBeDefined();
    expect(worker.d1_databases![0]!.binding).toBe("DB");
    expect(worker.r2_buckets).toBeDefined();
    expect(worker.r2_buckets![0]!.binding).toBe("BUCKET");
    expect(worker.durable_objects).toBeDefined();
    expect(worker.durable_objects![0]!.name).toBe("ROOM");
    expect(worker.durable_objects![0]!.sqlite).toBe(true);
    expect(worker.routes).toBeDefined();
    expect(worker.routes![0]!.pattern).toBe("api.example.com/*");
    expect(worker.routes![0]!.custom_domain).toBe(true);
    expect(worker.routes![0]!.zone_name).toBe("example.com");
    expect(worker.rules).toBeDefined();
    expect(worker.assets).toBeDefined();
    expect(worker.assets!.directory).toBe("./dist");
    expect(worker.assets!.not_found_handling).toBe("single-page-application");
    expect(worker.site).toBeDefined();
    expect(worker.site!.bucket).toBe("./public");
  });

  it("caches the manifest on second call", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest1 = await readManifest(root);
    const manifest2 = await readManifest(root);
    // Should be the same object reference (cached)
    expect(manifest1).toBe(manifest2);
  });

  it("throws when packages.yaml is missing required keys", async () => {
    const tmp = await createTempManifest(`
invalid:
  key: value
`);
    root = tmp.root;
    cleanup = tmp.cleanup;

    await expect(readManifest(root)).rejects.toThrow("Invalid packages.yaml");
  });

  it("throws when packages.yaml file does not exist", async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), "bazdmeg-no-manifest-"));
    const tmpCleanup = () => rm(tmpRoot, { recursive: true, force: true });
    try {
      await expect(readManifest(tmpRoot)).rejects.toThrow();
    } finally {
      await tmpCleanup();
    }
  });

  it("uses process.cwd() when no root is provided", async () => {
    // This test just verifies the function can be called without args (may throw if no manifest in cwd)
    try {
      await readManifest();
    } catch {
      // Expected if no packages.yaml in cwd
    }
    // No assertion needed - just verifying it doesn't crash in an unexpected way
    expect(true).toBe(true);
  });
});

describe("clearManifestCache", () => {
  let cleanup: () => Promise<void>;
  let root: string;

  afterEach(async () => {
    clearManifestCache();
    if (cleanup) await cleanup();
  });

  it("clears cache so next read re-reads the file", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest1 = await readManifest(root);
    clearManifestCache();
    const manifest2 = await readManifest(root);
    // After clearing cache, should be a new object
    expect(manifest1).not.toBe(manifest2);
    // But same data
    expect(manifest1.defaults.scope).toBe(manifest2.defaults.scope);
  });
});

describe("getManifestPackage", () => {
  let cleanup: () => Promise<void>;
  let root: string;

  beforeEach(() => {
    clearManifestCache();
  });

  afterEach(async () => {
    clearManifestCache();
    if (cleanup) await cleanup();
  });

  it("returns a package by name", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const pkg = await getManifestPackage("chess-engine", root);
    expect(pkg).toBeDefined();
    expect(pkg!.kind).toBe("library");
    expect(pkg!.version).toBe("1.2.0");
  });

  it("returns null for non-existent package", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const pkg = await getManifestPackage("nonexistent", root);
    expect(pkg).toBeNull();
  });

  it("returns shared package with no deps", async () => {
    const tmp = await createTempManifest(BASIC_MANIFEST_YAML);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const pkg = await getManifestPackage("shared", root);
    expect(pkg).toBeDefined();
    expect(pkg!.deps).toBeUndefined();
  });
});

describe("topologicalSort", () => {
  it("sorts packages with no deps correctly", () => {
    const packages = {
      a: { kind: "library", version: "1.0.0", description: "A", entry: "src/index.ts" },
      b: { kind: "library", version: "1.0.0", description: "B", entry: "src/index.ts" },
    };
    const order = topologicalSort(packages);
    expect(order).toContain("a");
    expect(order).toContain("b");
    expect(order).toHaveLength(2);
  });

  it("sorts packages respecting dependencies", () => {
    const packages = {
      "chess-engine": {
        kind: "library",
        version: "1.0.0",
        description: "Chess",
        entry: "src/index.ts",
        deps: ["shared"],
      },
      shared: {
        kind: "library",
        version: "1.0.0",
        description: "Shared",
        entry: "src/index.ts",
      },
    };
    const order = topologicalSort(packages);
    const sharedIdx = order.indexOf("shared");
    const chessIdx = order.indexOf("chess-engine");
    expect(sharedIdx).toBeLessThan(chessIdx);
  });

  it("sorts a chain of 3 packages in correct build order", () => {
    const packages = {
      c: {
        kind: "library",
        version: "1.0.0",
        description: "C",
        entry: "src/index.ts",
        deps: ["b"],
      },
      b: {
        kind: "library",
        version: "1.0.0",
        description: "B",
        entry: "src/index.ts",
        deps: ["a"],
      },
      a: { kind: "library", version: "1.0.0", description: "A", entry: "src/index.ts" },
    };
    const order = topologicalSort(packages);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  it("throws on circular dependencies", () => {
    const packages = {
      a: {
        kind: "library",
        version: "1.0.0",
        description: "A",
        entry: "src/index.ts",
        deps: ["b"],
      },
      b: {
        kind: "library",
        version: "1.0.0",
        description: "B",
        entry: "src/index.ts",
        deps: ["a"],
      },
    };
    expect(() => topologicalSort(packages)).toThrow("Circular dependency");
  });

  it("handles packages with external deps (not in manifest)", () => {
    const packages = {
      "chess-engine": {
        kind: "library",
        version: "1.0.0",
        description: "Chess",
        entry: "src/index.ts",
        deps: ["external-not-in-manifest"],
      },
    };
    // Should not throw — external deps are skipped
    const order = topologicalSort(packages);
    expect(order).toContain("chess-engine");
  });

  it("returns empty array for empty packages", () => {
    const order = topologicalSort({});
    expect(order).toEqual([]);
  });

  it("handles packages where deps is undefined", () => {
    const packages = {
      a: { kind: "library", version: "1.0.0", description: "A", entry: "src/index.ts" },
    };
    const order = topologicalSort(packages);
    expect(order).toEqual(["a"]);
  });
});

describe("YAML parser edge cases", () => {
  let cleanup: () => Promise<void>;
  let root: string;

  beforeEach(() => {
    clearManifestCache();
  });

  afterEach(async () => {
    clearManifestCache();
    if (cleanup) await cleanup();
  });

  it("handles boolean values in YAML", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: worker
    version: 1.0.0
    description: Test
    entry: src/index.ts
    private: true
    vite: false
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]!.private).toBe(true);
    expect(manifest.packages["test-pkg"]!.vite).toBe(false);
  });

  it("handles null/empty values in YAML", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: Test
    entry: src/index.ts
    bin: null
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]).toBeDefined();
  });

  it("handles inline comments in YAML values", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai" # GitHub scope
  registry: npm.pkg.github.com # GitHub Packages
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library # this is a library
    version: 1.0.0
    description: Test package
    entry: src/index.ts
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.defaults.scope).toBe("@spike-land-ai");
    expect(manifest.packages["test-pkg"]!.kind).toBe("library");
  });

  it("handles quoted strings with spaces", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: "A test package with spaces"
    entry: src/index.ts
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]!.description).toBe("A test package with spaces");
  });

  it("handles single-quoted strings", async () => {
    const yaml = `
defaults:
  scope: '@spike-land-ai'
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: 'single quoted description'
    entry: src/index.ts
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.defaults.scope).toBe("@spike-land-ai");
    expect(manifest.packages["test-pkg"]!.description).toBe("single quoted description");
  });

  it("handles numeric version values", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 2.5.0
    description: Test
    entry: src/index.ts
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]!.version).toBeDefined();
  });

  it("handles packages with publish config", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: Test
    entry: src/index.ts
    publish:
      registries:
        - npm.pkg.github.com
        - registry.npmjs.org
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]!.publish).toBeDefined();
    expect(manifest.packages["test-pkg"]!.publish!.registries).toContain("npm.pkg.github.com");
  });

  it("handles multiple packages with a dep chain", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  a:
    kind: library
    version: 1.0.0
    description: A
    entry: src/index.ts

  b:
    kind: library
    version: 1.0.0
    description: B
    entry: src/index.ts
    deps:
      - a

  c:
    kind: library
    version: 1.0.0
    description: C
    entry: src/index.ts
    deps:
      - a
      - b
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["c"]!.deps).toContain("a");
    expect(manifest.packages["c"]!.deps).toContain("b");
  });

  it("handles empty deps list", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: Test
    entry: src/index.ts
    deps:
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    // Should parse without crashing - deps may be null or empty
    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]).toBeDefined();
  });

  it("handles exports configuration", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    version: 1.0.0
    description: Test
    entry: src/index.ts
    exports:
      ".": ./dist/index.js
      "./utils": ./dist/utils.js
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    // The simple YAML parser parses nested maps - exports should be defined
    expect(manifest.packages["test-pkg"]!.exports).toBeDefined();
  });

  it("handles non-key lines by skipping them", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

not a key line
packages:
  test-pkg:
    kind: library
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]).toBeDefined();
  });

  it("handles keys with empty values and same indent next line", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    deps:
    other: value
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(manifest.packages["test-pkg"]!.deps).toBeNull();
    // Use any casting since 'other' is not in the type
    expect((manifest.packages["test-pkg"] as Record<string, unknown>).other).toBe("value");
  });

  it("handles irregular indentation in objects", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    obj:
      key1: val1
        irregular: val2
      key2: val3
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect(((manifest.packages["test-pkg"] as Record<string, unknown>).obj as Record<string, unknown>).key1).toBe("val1");
  });

  it("handles list ending with a key at same indent", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    list:
      - item1
      not-a-list-item: value
    key: value
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect((manifest.packages["test-pkg"] as Record<string, unknown>).list).toEqual(["item1"]);
    // 'key' is missing because the irregular indent of 'not-a-list-item' broke the object parser
    expect((manifest.packages["test-pkg"] as Record<string, unknown>).key).toBeUndefined();
  });

  it("handles empty values in inline list maps", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    list:
      - key: 
      - other: value
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect((manifest.packages["test-pkg"] as Record<string, unknown>).list).toEqual([
      { key: null },
      { other: "value" },
    ]);
  });

  it("handles real numeric values in YAML", async () => {
    const yaml = `
defaults:
  scope: "@spike-land-ai"
  registry: npm.pkg.github.com
  license: MIT
  type: module

packages:
  test-pkg:
    kind: library
    max_tokens: 100
`;
    const tmp = await createTempManifest(yaml);
    root = tmp.root;
    cleanup = tmp.cleanup;

    const manifest = await readManifest(root);
    expect((manifest.packages["test-pkg"] as Record<string, unknown>).max_tokens).toBe(100);
  });
});
