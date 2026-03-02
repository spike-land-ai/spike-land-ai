/**
 * Workspace Resolver
 *
 * Pure path resolution from package.json dependencies.
 * Determines which paths an agent is allowed to access based on
 * the workspace package's declared dependencies.
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ResolvedDependencies } from "./types.js";

const SPIKE_SCOPE = "@spike-land-ai/";

/** Paths always allowed regardless of workspace */
const ALWAYS_ALLOWED = [
  "CLAUDE.md",
  "package.json",
  ".claude/settings.json",
  ".mcp.json",
  "packages/tsconfig/",
  "packages/eslint-config/",
];

/**
 * Resolve the monorepo root by walking up from a given path looking for
 * the root package.json with workspaces config.
 */
export function findMonorepoRoot(startPath: string): string {
  // For now, use the working directory or a known root
  return resolve(startPath);
}

/**
 * Extract @spike-land-ai/* dependency names from a package.json object.
 */
export function extractInternalDeps(packageJson: Record<string, unknown>): string[] {
  const deps = new Set<string>();

  for (const field of ["dependencies", "peerDependencies"]) {
    const fieldValue = packageJson[field];
    if (fieldValue && typeof fieldValue === "object" && fieldValue !== null) {
      for (const depName of Object.keys(fieldValue as Record<string, unknown>)) {
        if (depName.startsWith(SPIKE_SCOPE)) {
          deps.add(depName);
        }
      }
    }
  }

  return [...deps];
}

/**
 * Convert a scoped package name to its directory under packages/.
 * e.g. "@spike-land-ai/chess-engine" -> "packages/chess-engine/"
 */
export function packageNameToPath(name: string): string {
  const shortName = name.replace(SPIKE_SCOPE, "");
  return `packages/${shortName}/`;
}

/**
 * Read and parse a package.json file.
 */
export async function readPackageJson(packagePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(join(packagePath, "package.json"), "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Resolve all allowed paths for a workspace package.
 *
 * 1. Read the package's package.json
 * 2. Extract @spike-land-ai/* deps from dependencies + peerDependencies
 * 3. Map each to packages/<shortname>/
 * 4. Include always-allowed paths
 * 5. Include the package's own directory
 */
export async function resolveWorkspacePaths(
  monorepoRoot: string,
  packageName: string,
): Promise<ResolvedDependencies> {
  const packageDir = `packages/${packageName}/`;
  const packagePath = join(monorepoRoot, packageDir);

  const packageJson = await readPackageJson(packagePath);
  const internalDeps = extractInternalDeps(packageJson);
  const depPaths = internalDeps.map(packageNameToPath);

  // Build the full allowed paths list
  const paths = [
    packageDir,
    ...depPaths,
    ...ALWAYS_ALLOWED,
  ];

  return {
    direct: internalDeps,
    paths,
  };
}

/**
 * Check if a file path is within the allowed paths.
 * Uses prefix matching.
 */
export function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) return true; // No restrictions

  // Normalize the file path (remove leading ./ or /)
  const normalized = filePath.replace(/^\.\//, "").replace(/^\//, "");

  return allowedPaths.some((allowed) => normalized.startsWith(allowed));
}

/**
 * Get the always-allowed paths (for tests and external use).
 */
export function getAlwaysAllowedPaths(): string[] {
  return [...ALWAYS_ALLOWED];
}
