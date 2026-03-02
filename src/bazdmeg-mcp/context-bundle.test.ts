/**
 * Tests for context-bundle.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import { extractExportedSymbols, buildContextBundle, formatContextBundle } from "./context-bundle.js";
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
          "types.ts": "export interface Config {\n  name: string;\n}\n\nexport type Status = 'on' | 'off';\n",
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
        dependencies: { "@spike-land-ai/shared": "1.0.0", "zod": "4.0.0" },
        devDependencies: {},
      },
      exportedTypes: [{ file: "types.ts", symbols: ["Config", "Status"] }],
      dependencyContexts: [{ packageName: "@spike-land-ai/shared", summary: "# Shared\nUtils." }],
    });

    expect(text).toContain("# Context Bundle: my-pkg");
    expect(text).toContain("# My Package");
    expect(text).toContain("@spike-land-ai/my-pkg");
    expect(text).toContain("Config");
    expect(text).toContain("# Shared");
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
