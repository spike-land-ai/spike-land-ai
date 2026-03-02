/**
 * Test Fixtures
 *
 * Fake monorepo builder for testing workspace resolution and context bundles.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface FakePackage {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  claudeMd?: string;
  srcFiles?: Record<string, string>;
}

/**
 * Create a fake monorepo in a temp directory for testing.
 * Returns the root path. Call cleanup() when done.
 */
export async function createFakeMonorepo(
  packages: FakePackage[],
): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "bazdmeg-test-"));

  // Create root package.json
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "spike-land-ai",
      workspaces: ["packages/*"],
    }),
  );

  // Create root CLAUDE.md
  await writeFile(join(root, "CLAUDE.md"), "# Root CLAUDE.md\nMonorepo root.\n");

  // Create packages directory
  await mkdir(join(root, "packages"), { recursive: true });

  // Create each package
  for (const pkg of packages) {
    const pkgDir = join(root, "packages", pkg.name);
    await mkdir(pkgDir, { recursive: true });

    // package.json
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: `@spike-land-ai/${pkg.name}`,
        version: "1.0.0",
        dependencies: pkg.dependencies ?? {},
        peerDependencies: pkg.peerDependencies ?? {},
        scripts: { build: "tsc", test: "vitest run" },
      }),
    );

    // CLAUDE.md
    if (pkg.claudeMd) {
      await writeFile(join(pkgDir, "CLAUDE.md"), pkg.claudeMd);
    }

    // Source files
    if (pkg.srcFiles) {
      await mkdir(join(pkgDir, "src"), { recursive: true });
      for (const [filename, content] of Object.entries(pkg.srcFiles)) {
        await writeFile(join(pkgDir, "src", filename), content);
      }
    }
  }

  // Create shared config dirs
  for (const dir of ["tsconfig", "eslint-config"]) {
    await mkdir(join(root, "packages", dir), { recursive: true });
    await writeFile(
      join(root, "packages", dir, "package.json"),
      JSON.stringify({ name: `@spike-land-ai/${dir}`, version: "1.0.0" }),
    );
  }

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/**
 * Build a simple unified diff for testing gates.
 */
export function buildDiff(files: Array<{ path: string; added: string[]; removed?: string[] }>): string {
  const parts: string[] = [];
  for (const file of files) {
    parts.push(`diff --git a/${file.path} b/${file.path}`);
    parts.push(`--- a/${file.path}`);
    parts.push(`+++ b/${file.path}`);
    parts.push(`@@ -1,${file.removed?.length ?? 0} +1,${file.added.length} @@`);
    if (file.removed) {
      for (const line of file.removed) {
        parts.push(`-${line}`);
      }
    }
    for (const line of file.added) {
      parts.push(`+${line}`);
    }
  }
  return parts.join("\n");
}
