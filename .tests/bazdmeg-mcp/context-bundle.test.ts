/**
 * Tests for context-bundle.ts
 */

import { afterEach, describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildContextBundle,
  extractExportedSymbols,
  formatContextBundle,
} from "../../src/mcp-tools/bazdmeg/node-sys/context-bundle.js";
import { createFakeMonorepo } from "./__test-utils__/fixtures.js";

describe("extractExportedSymbols", () => {
  it("extracts exported interfaces", () => {
    const source = `export interface Foo {\n  bar: string;\n}`;
    expect(extractExportedSymbols(source)).toContain("Foo");
  });

  it("extracts exported types", () => {
    const source = `export type Status = "active" | "inactive";`;
    expect(extractExportedSymbols(source)).toContain("Status");
  });

  it("extracts exported functions", () => {
    const source = `export function doSomething(x: number): void {}`;
    expect(extractExportedSymbols(source)).toContain("doSomething");
  });

  it("extracts exported async functions", () => {
    const source = `export async function fetchData(): Promise<void> {}`;
    expect(extractExportedSymbols(source)).toContain("fetchData");
  });

  it("extracts exported classes", () => {
    const source = `export class MyService {}`;
    expect(extractExportedSymbols(source)).toContain("MyService");
  });

  it("extracts exported consts", () => {
    const source = `export const MAX_SIZE = 100;`;
    expect(extractExportedSymbols(source)).toContain("MAX_SIZE");
  });

  it("extracts exported enums", () => {
    const source = `export enum Direction { Up, Down }`;
    expect(extractExportedSymbols(source)).toContain("Direction");
  });

  it("extracts exported let and var", () => {
    const source = `export let x = 1;\nexport var y = 2;`;
    const symbols = extractExportedSymbols(source);
    expect(symbols).toContain("x");
    expect(symbols).toContain("y");
  });

  it("ignores non-exported symbols", () => {
    const source = `interface Internal {}\nfunction helper() {}`;
    expect(extractExportedSymbols(source)).toEqual([]);
  });

  it("handles multiple exports", () => {
    const source = [
      "export interface Foo {}",
      "export type Bar = string;",
      "export function baz() {}",
    ].join("\n");
    const symbols = extractExportedSymbols(source);
    expect(symbols).toContain("Foo");
    expect(symbols).toContain("Bar");
    expect(symbols).toContain("baz");
  });
});

describe("buildContextBundle", () => {
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  it("builds a bundle with CLAUDE.md and types", async () => {
    const result = await createFakeMonorepo([
      {
        name: "test-pkg",
        claudeMd: "# Test Package\nA test package.\n",
        dependencies: { "@spike-land-ai/shared": "1.0.0" },
        srcFiles: {
          "types.ts":
            "export interface Config {\n  name: string;\n}\n\nexport type Status = 'on' | 'off';\n",
        },
      },
      {
        name: "shared",
        claudeMd: "# Shared\nShared utilities.\nLine 3.\n",
      },
    ]);
    cleanup = result.cleanup;

    const bundle = await buildContextBundle(result.root, "test-pkg", ["@spike-land-ai/shared"]);

    expect(bundle.packageName).toBe("test-pkg");
    expect(bundle.claudeMd).toContain("# Test Package");
    expect(bundle.packageJson).toBeDefined();
    expect(bundle.packageJson!.name).toBe("@spike-land-ai/test-pkg");
    expect(bundle.exportedTypes).toHaveLength(1);
    expect(bundle.exportedTypes[0].symbols).toContain("Config");
    expect(bundle.exportedTypes[0].symbols).toContain("Status");
    expect(bundle.dependencyContexts).toHaveLength(1);
    expect(bundle.dependencyContexts[0].packageName).toBe("@spike-land-ai/shared");
  });

  it("handles package without CLAUDE.md", async () => {
    const result = await createFakeMonorepo([{ name: "no-docs" }]);
    cleanup = result.cleanup;

    const bundle = await buildContextBundle(result.root, "no-docs", []);
    expect(bundle.claudeMd).toBeNull();
    expect(bundle.exportedTypes).toEqual([]);
  });

  it("handles missing CLAUDE.md in internal dependencies", async () => {
    const result = await createFakeMonorepo([
      { name: "pkg-a" },
      { name: "dep-no-claude", claudeMd: "" }, // Not actually providing it should result in null reading
    ]);
    // The fixture creates a default CLAUDE.md if not provided? No, it only writes if pkg.claudeMd is truthy.
    cleanup = result.cleanup;

    const bundle = await buildContextBundle(result.root, "pkg-a", ["@spike-land-ai/dep-no-claude"]);
    expect(bundle.dependencyContexts).toHaveLength(0);
  });

  it("truncates dependency summaries to 20 lines", async () => {
    const longClaudeMd = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const result = await createFakeMonorepo([
      { name: "pkg-a" },
      { name: "dep-long", claudeMd: longClaudeMd },
    ]);
    cleanup = result.cleanup;

    const bundle = await buildContextBundle(result.root, "pkg-a", ["@spike-land-ai/dep-long"]);
    expect(bundle.dependencyContexts).toHaveLength(1);
    const summary = bundle.dependencyContexts[0].summary;
    expect(summary.split("\n")).toHaveLength(20);
    expect(summary).not.toContain("Line 21");
  });

  it("ignores files with no exports and non-TS files", async () => {
    const result = await createFakeMonorepo([
      {
        name: "test-pkg",
        srcFiles: {
          "empty.ts": "// just comments",
          "styles.css": "body { color: red; }",
        },
      },
    ]);
    cleanup = result.cleanup;

    const bundle = await buildContextBundle(result.root, "test-pkg", []);
    expect(bundle.exportedTypes).toHaveLength(0);
  });

  it("handles invalid package.json and missing fields", async () => {
    const result = await createFakeMonorepo([{ name: "bad-pkg" }]);
    cleanup = result.cleanup;

    // Overwrite package.json with invalid JSON
    const pkgJsonPath = join(result.root, "packages", "bad-pkg", "package.json");
    await writeFile(pkgJsonPath, "{ invalid: json }");

    let bundle = await buildContextBundle(result.root, "bad-pkg", []);
    expect(bundle.packageJson).toBeNull();

    // Overwrite with completely empty package.json (missing ALL fields)
    await writeFile(pkgJsonPath, "{}");
    bundle = await buildContextBundle(result.root, "bad-pkg", []);
    expect(bundle.packageJson).not.toBeNull();
    expect(bundle.packageJson!.name).toBe("unknown"); // default
    expect(bundle.packageJson!.version).toBe("0.0.0"); // default
    expect(bundle.packageJson!.scripts).toEqual({}); // default

    // Test missing package.json file entirely
    const fs = await import("node:fs/promises");
    await fs.unlink(pkgJsonPath);
    bundle = await buildContextBundle(result.root, "bad-pkg", []);
    expect(bundle.packageJson).toBeNull();
  });
});

describe("formatContextBundle", () => {
  it("formats a complete bundle", () => {
    const text = formatContextBundle({
      packageName: "my-pkg",
      claudeMd: "# My Package\nDoes things.\n",
      packageJson: {
        name: "@spike-land-ai/my-pkg",
        version: "1.0.0",
        scripts: { build: "tsc", test: "vitest" },
        dependencies: { "@spike-land-ai/shared": "1.0.0", zod: "4.0.0" },
        devDependencies: {},
      },
      exportedTypes: [{ file: "types.ts", symbols: ["Config", "Status"] }],
      dependencyContexts: [
        {
          packageName: "@spike-land-ai/shared",
          summary: "# Shared\nUtils.",
        },
      ],
    });

    expect(text).toContain("# Context Bundle: my-pkg");
    expect(text).toContain("# My Package");
    expect(text).toContain("@spike-land-ai/my-pkg");
    expect(text).toContain("Config");
    expect(text).toContain("# Shared");
  });

  it("handles package.json without scripts or internal deps", () => {
    const text = formatContextBundle({
      packageName: "minimal",
      claudeMd: null,
      packageJson: {
        name: "@spike-land-ai/minimal",
        version: "1.0.0",
        scripts: {},
        dependencies: { lodash: "1.0.0" },
        devDependencies: {},
      },
      exportedTypes: [],
      dependencyContexts: [],
    });
    expect(text).not.toContain("Scripts");
    expect(text).not.toContain("Internal deps");
  });

  it("handles empty bundle", () => {
    const text = formatContextBundle({
      packageName: "empty",
      claudeMd: null,
      packageJson: null,
      exportedTypes: [],
      dependencyContexts: [],
    });
    expect(text).toContain("# Context Bundle: empty");
  });
});
