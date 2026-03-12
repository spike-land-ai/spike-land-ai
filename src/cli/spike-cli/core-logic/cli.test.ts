import packageJson from "../../../../packages/spike-cli/package.json";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("spike-cli packaging invariants", () => {
  it("keeps the CLI version aligned with the published package version", async () => {
    const source = readFileSync(
      join(process.cwd(), "src/cli/spike-cli/core-logic/cli.ts"),
      "utf-8",
    );

    expect(source).toContain(
      'import packageJson from "../../../../packages/spike-cli/package.json"',
    );
    expect(source).toContain("const VERSION = packageJson.version;");
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("keeps the package bin shim executable by source contract", () => {
    const shim = readFileSync(join(process.cwd(), "packages/spike-cli/cli.ts"), "utf-8");
    const packageConfig = readFileSync(
      join(process.cwd(), "packages/spike-cli/package.json"),
      "utf-8",
    );

    expect(shim.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(packageConfig).toContain("chmod +x dist/cli.js dist/cli.cjs");
    expect(packageConfig).toContain("node ./scripts/verify-bin.mjs");
  });
});
