/**
 * Context Bundle
 *
 * Context engineering: proactively serve what agents need.
 * Extracts CLAUDE.md, exported types, public API surface, and
 * dependency summaries for the current workspace.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  ContextBundle,
  DependencyContext,
  ExportedSymbol,
  PackageJsonSummary,
} from "./types.js";

/**
 * Regex patterns for extracting exported symbols from TypeScript files.
 * Captures: export interface, export type, export function, export class, export const, export enum
 */
const EXPORT_PATTERNS = [
  /^export\s+(?:interface|type)\s+(\w+)/gm,
  /^export\s+(?:function|async\s+function)\s+(\w+)/gm,
  /^export\s+(?:class)\s+(\w+)/gm,
  /^export\s+(?:const|let|var)\s+(\w+)/gm,
  /^export\s+(?:enum)\s+(\w+)/gm,
];

/**
 * Extract exported symbol names from TypeScript source code.
 */
export function extractExportedSymbols(source: string): string[] {
  const symbols = new Set<string>();

  for (const pattern of EXPORT_PATTERNS) {
    // Reset lastIndex for each call since we're using global patterns
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      if (match[1]) symbols.add(match[1]);
    }
  }

  return [...symbols];
}

/**
 * Read a file safely, returning null if it doesn't exist.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Scan a directory for .ts files (non-recursive, src/ only).
 */
async function scanTsFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Extract exported types from all .ts files in a package's src/ directory.
 */
async function extractPackageTypes(packagePath: string): Promise<ExportedSymbol[]> {
  const srcDir = join(packagePath, "src");
  const tsFiles = await scanTsFiles(srcDir);
  const results: ExportedSymbol[] = [];

  for (const file of tsFiles) {
    const content = await safeReadFile(join(srcDir, file));
    if (content) {
      const symbols = extractExportedSymbols(content);
      if (symbols.length > 0) {
        results.push({ file, symbols });
      }
    }
  }

  return results;
}

/**
 * Parse package.json into a summary.
 */
function summarizePackageJson(raw: string): PackageJsonSummary | null {
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: (pkg.name as string) ?? "unknown",
      version: (pkg.version as string) ?? "0.0.0",
      scripts: (pkg.scripts as Record<string, string>) ?? {},
      dependencies: (pkg.dependencies as Record<string, string>) ?? {},
      devDependencies: (pkg.devDependencies as Record<string, string>) ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Get the first N lines of a file as a summary.
 */
function getFirstLines(content: string, n: number): string {
  return content.split("\n").slice(0, n).join("\n");
}

/**
 * Build a context bundle for a workspace package.
 */
export async function buildContextBundle(
  monorepoRoot: string,
  packageName: string,
  internalDeps: string[],
): Promise<ContextBundle> {
  const packagePath = join(monorepoRoot, "packages", packageName);

  // Read CLAUDE.md
  const claudeMd = await safeReadFile(join(packagePath, "CLAUDE.md"));

  // Read and summarize package.json
  const packageJsonRaw = await safeReadFile(join(packagePath, "package.json"));
  const packageJson = packageJsonRaw ? summarizePackageJson(packageJsonRaw) : null;

  // Extract exported types
  const exportedTypes = await extractPackageTypes(packagePath);

  // Get dependency context summaries (first 20 lines of each CLAUDE.md)
  const dependencyContexts: DependencyContext[] = [];
  for (const dep of internalDeps) {
    const depShortName = dep.replace("@spike-land-ai/", "");
    const depClaudeMd = await safeReadFile(
      join(monorepoRoot, "packages", depShortName, "CLAUDE.md"),
    );
    if (depClaudeMd) {
      dependencyContexts.push({
        packageName: dep,
        summary: getFirstLines(depClaudeMd, 20),
      });
    }
  }

  return {
    packageName,
    claudeMd,
    packageJson,
    exportedTypes,
    dependencyContexts,
  };
}

/**
 * Format a context bundle as a readable text document for an LLM agent.
 */
export function formatContextBundle(bundle: ContextBundle): string {
  const sections: string[] = [];

  sections.push(`# Context Bundle: ${bundle.packageName}\n`);

  if (bundle.claudeMd) {
    sections.push(`## CLAUDE.md\n\n${bundle.claudeMd}\n`);
  }

  if (bundle.packageJson) {
    const pkg = bundle.packageJson;
    sections.push(`## Package Info\n`);
    sections.push(`- **Name**: ${pkg.name}`);
    sections.push(`- **Version**: ${pkg.version}`);
    if (Object.keys(pkg.scripts).length > 0) {
      sections.push(`- **Scripts**: ${Object.keys(pkg.scripts).join(", ")}`);
    }
    const internalDeps = Object.keys(pkg.dependencies).filter((d) =>
      d.startsWith("@spike-land-ai/"),
    );
    if (internalDeps.length > 0) {
      sections.push(`- **Internal deps**: ${internalDeps.join(", ")}`);
    }
    sections.push("");
  }

  if (bundle.exportedTypes.length > 0) {
    sections.push(`## Exported Symbols\n`);
    for (const { file, symbols } of bundle.exportedTypes) {
      sections.push(`### ${file}\n${symbols.map((s) => `- \`${s}\``).join("\n")}\n`);
    }
  }

  if (bundle.dependencyContexts.length > 0) {
    sections.push(`## Dependency Summaries\n`);
    for (const dep of bundle.dependencyContexts) {
      sections.push(`### ${dep.packageName}\n${dep.summary}\n`);
    }
  }

  return sections.join("\n");
}
