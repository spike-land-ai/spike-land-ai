import fs from "node:fs/promises";
import path from "node:path";
import { Project, SyntaxKind, StringLiteral, NoSubstitutionTemplateLiteral } from "ts-morph";
import type { FileNode, AliasMap } from "./types.js";
import { extractRootPackage } from "./utils.js";
import { excludedDeps } from "../reorganize-config.js";

/**
 * Build a per-package alias map for `@/*` paths.
 * Reads each package's tsconfig.json for `paths["@/*"]`, or falls back to
 * a heuristic based on directory structure.
 */
async function buildAliasMap(srcDir: string): Promise<AliasMap> {
  const aliasMap: AliasMap = new Map();
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgName = entry.name;
    const pkgDir = path.join(srcDir, pkgName);

    // Try reading tsconfig.json for paths
    const tsconfigPath = path.join(pkgDir, "tsconfig.json");
    try {
      const content = await fs.readFile(tsconfigPath, "utf-8");
      const tsconfig = JSON.parse(content);
      const paths = tsconfig?.compilerOptions?.paths;
      if (paths && paths["@/*"]) {
        const aliasTarget = paths["@/*"][0]; // e.g. "./*" or "./@/*"
        const resolved = path.resolve(pkgDir, aliasTarget.replace("/*", ""));
        aliasMap.set(pkgName, { prefix: "@/", baseDir: resolved });
        continue;
      }
    } catch {
      // no tsconfig or can't parse — fall through to heuristics
    }

    // Heuristic: if the package has a `@/` directory, @/ maps to <pkg>/@/
    const atDir = path.join(pkgDir, "@");
    try {
      const stat = await fs.stat(atDir);
      if (stat.isDirectory()) {
        aliasMap.set(pkgName, { prefix: "@/", baseDir: atDir });
        continue;
      }
    } catch {
      // no @ directory
    }

    // Default: @/ maps to package root (same as `"@/*": ["./*"]`)
    // Only set if the package actually uses @/ imports (we'll be conservative
    // and set it — unused entries don't cause harm)
    aliasMap.set(pkgName, { prefix: "@/", baseDir: pkgDir });
  }

  return aliasMap;
}

/**
 * Resolve an `@/` import to an absolute file path.
 * Returns null if the alias can't be resolved.
 */
function resolveAliasImport(
  importPath: string,
  packageName: string,
  aliasMap: AliasMap,
): string | null {
  if (!importPath.startsWith("@/")) return null;

  const entry = aliasMap.get(packageName);
  if (!entry) return null;

  const subPath = importPath.slice(2); // strip "@/"
  return path.resolve(entry.baseDir, subPath);
}

export async function discoverFiles(
  project: Project,
  srcDir?: string,
): Promise<{ nodes: FileNode[]; aliasMap: AliasMap }> {
  const root = srcDir || path.resolve(process.cwd(), "src");
  const aliasMap = await buildAliasMap(root);
  const nodes: FileNode[] = [];

  const rootWithSep = root.endsWith("/") ? root : root + "/";

  for (const sourceFile of project.getSourceFiles()) {
    const absPath = sourceFile.getFilePath();
    if (!absPath.startsWith(rootWithSep)) continue;

    const relPath = path.relative(root, absPath);
    const packageName = relPath.split(path.sep)[0];

    const externalDeps = new Set<string>();
    const relativeImports = new Set<string>();

    const imports = sourceFile.getImportDeclarations();
    const exports = sourceFile.getExportDeclarations();
    const dynamicImports = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((c) => c.getExpression().getText() === "import");

    const specs = [
      ...imports.map((i) => i.getModuleSpecifierValue()).filter(Boolean),
      ...exports.map((e) => e.getModuleSpecifierValue()).filter(Boolean),
      ...dynamicImports
        .map((d) => {
          const arg = d.getArguments()[0];
          if (
            arg &&
            (arg.getKind() === SyntaxKind.StringLiteral ||
              arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)
          ) {
            return (arg as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralText();
          }
          return null;
        })
        .filter(Boolean),
    ] as string[];

    for (const importPath of specs) {
      if (
        importPath.startsWith("http") ||
        importPath.endsWith(".css") ||
        importPath.endsWith(".json") ||
        importPath.includes("${")
      )
        continue;

      if (importPath.startsWith(".") || importPath.startsWith("/")) {
        const dir = path.dirname(absPath);
        const resolved = path.resolve(dir, importPath);
        relativeImports.add(resolved);
      } else if (importPath.startsWith("@/")) {
        // Resolve @/ alias to absolute path and track as relative import
        const resolved = resolveAliasImport(importPath, packageName!, aliasMap);
        if (resolved) {
          relativeImports.add(resolved);
        }
      } else {
        const rootPkg = extractRootPackage(importPath);
        if (rootPkg && !excludedDeps.has(rootPkg)) {
          externalDeps.add(rootPkg);
        }
      }
    }

    nodes.push({ absPath, relPath, packageName: packageName!, externalDeps, relativeImports });
  }
  return { nodes, aliasMap };
}
