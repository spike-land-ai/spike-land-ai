import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { Project, SyntaxKind, StringLiteral, NoSubstitutionTemplateLiteral } from "ts-morph";
import type { MovePlan, AliasMap } from "./types.js";

/**
 * Resolve an @/ import to an absolute path using the alias map.
 */
function resolveAlias(spec: string, packageName: string, aliasMap: AliasMap): string | null {
  if (!spec.startsWith("@/")) return null;
  const entry = aliasMap.get(packageName);
  if (!entry) return null;
  return path.resolve(entry.baseDir, spec.slice(2));
}

export function rewriteSingleImport(
  p1: string,
  oldPath: string,
  newDir: string,
  pathMapping: Map<string, string>,
  aliasMap?: AliasMap,
  packageName?: string,
): string {
  if (p1.startsWith("http") || p1.includes("${")) {
    return p1;
  }

  // Handle @/ alias imports
  if (p1.startsWith("@/") && aliasMap && packageName) {
    const resolvedAbs = resolveAlias(p1, packageName, aliasMap);
    if (resolvedAbs) {
      const mapped = findMapped(resolvedAbs, pathMapping);
      if (mapped) {
        return computeRelative(mapped, newDir, p1);
      }
    }
    return p1;
  }

  // Skip non-relative, non-alias imports (bare specifiers like "react")
  if (!p1.startsWith(".") && !p1.startsWith("/")) {
    return p1;
  }

  const oldDir = path.dirname(oldPath);
  let resolvedAbs = path.resolve(oldDir, p1);

  const mapped = findMapped(resolvedAbs, pathMapping);

  if (mapped) {
    return computeRelative(mapped, newDir, p1);
  }

  return p1;
}

function findMapped(resolvedAbs: string, pathMapping: Map<string, string>): string | undefined {
  let mapped = pathMapping.get(resolvedAbs);
  if (!mapped) {
    if (pathMapping.has(resolvedAbs + ".ts")) mapped = pathMapping.get(resolvedAbs + ".ts");
    else if (pathMapping.has(resolvedAbs + ".tsx")) mapped = pathMapping.get(resolvedAbs + ".tsx");
    else if (pathMapping.has(resolvedAbs.replace(/\.js$/, ".ts")))
      mapped = pathMapping.get(resolvedAbs.replace(/\.js$/, ".ts"));
    else if (pathMapping.has(resolvedAbs.replace(/\.js$/, ".tsx")))
      mapped = pathMapping.get(resolvedAbs.replace(/\.js$/, ".tsx"));
    else if (pathMapping.has(resolvedAbs + "/index.ts"))
      mapped = pathMapping.get(resolvedAbs + "/index.ts");
    else if (pathMapping.has(resolvedAbs + "/index.tsx"))
      mapped = pathMapping.get(resolvedAbs + "/index.tsx");
    // Also try stripping .ts/.tsx extension (imports like "@/lib/utils.ts")
    else if (resolvedAbs.endsWith(".ts") && pathMapping.has(resolvedAbs))
      mapped = pathMapping.get(resolvedAbs);
    else if (resolvedAbs.endsWith(".tsx") && pathMapping.has(resolvedAbs))
      mapped = pathMapping.get(resolvedAbs);
  }
  return mapped;
}

function computeRelative(mapped: string, newDir: string, originalSpec: string): string {
  let newRel = path.relative(newDir, mapped);
  if (!newRel.startsWith(".")) newRel = "./" + newRel;

  if (originalSpec.endsWith(".js")) {
    newRel = newRel.replace(/\.tsx?$/, ".js");
  } else if (originalSpec.endsWith(".ts") || originalSpec.endsWith(".tsx")) {
    // Keep the extension as-is (some imports use explicit .ts extensions)
  } else {
    if (
      (mapped.endsWith("index.ts") || mapped.endsWith("index.tsx")) &&
      !originalSpec.endsWith("index.ts") &&
      !originalSpec.endsWith("index.tsx") &&
      !originalSpec.endsWith("index.js")
    ) {
      newRel = newRel.replace(/\/index\.tsx?$/, "");
      if (newRel === "") newRel = ".";
    } else {
      newRel = newRel.replace(/\.tsx?$/, "");
    }
  }
  return newRel;
}

export function rewriteImports(
  project: Project,
  oldPath: string,
  newPath: string,
  pathMapping: Map<string, string>,
  aliasMap?: AliasMap,
  packageName?: string,
): string {
  const sourceFile = project.getSourceFileOrThrow(oldPath);
  const newDir = path.dirname(newPath);

  const processSpecifier = (spec: string) => {
    return rewriteSingleImport(spec, oldPath, newDir, pathMapping, aliasMap, packageName);
  };

  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (spec) {
      const newSpec = processSpecifier(spec);
      if (newSpec !== spec) imp.setModuleSpecifier(newSpec);
    }
  }
  for (const exp of sourceFile.getExportDeclarations()) {
    if (exp.hasModuleSpecifier()) {
      const spec = exp.getModuleSpecifierValue();
      if (spec) {
        const newSpec = processSpecifier(spec);
        if (newSpec !== spec) exp.setModuleSpecifier(newSpec);
      }
    }
  }
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() === "import") {
      const arg = call.getArguments()[0];
      if (
        arg &&
        (arg.getKind() === SyntaxKind.StringLiteral ||
          arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)
      ) {
        const spec = (arg as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralText();
        const newSpec = processSpecifier(spec);
        if (newSpec !== spec) {
          call.removeArgument(0);
          call.insertArgument(0, `"${newSpec}"`);
        }
      }
    }
  }

  return sourceFile.getFullText();
}

/**
 * Copy non-TS assets (CSS, public/, SQL migrations, HTML, images, etc.)
 * from srcDir to outputDir, preserving package-relative paths.
 * Also rewrites CSS `@source` directives.
 */
export async function copyAssets(
  srcDir: string,
  outputDir: string,
  pathMapping: Map<string, string>,
) {
  const assetFiles = await glob("**/*", {
    cwd: srcDir,
    nodir: true,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.deploy-cache/**",
      "**/package.json",
      "**/tsconfig.json",
      "**/tsconfig.tsbuildinfo",
      "**/*.ts",
      "**/*.tsx",
      "**/*.js.map",
      "**/*.d.ts.map",
      "**/*.d.ts",
      "**/*.log",
    ],
  });

  // Build a map from old package-relative dirs to new dirs
  // by examining where TS files from each package ended up
  const pkgDirMap = new Map<string, string>(); // "spike-app" → "frontend/platform-frontend/..."
  for (const [oldAbs, newAbs] of pathMapping) {
    const oldRel = path.relative(srcDir, oldAbs);
    const pkgName = oldRel.split(path.sep)[0];
    if (!pkgDirMap.has(pkgName!)) {
      // Find the target directory for this package's files
      const newRel = path.relative(outputDir, newAbs);
      const parts = newRel.split(path.sep);
      // category/appName is the base
      if (parts.length >= 2) {
        pkgDirMap.set(pkgName!, path.join(parts[0]!, parts[1]!));
      }
    }
  }

  let copied = 0;
  for (const relFile of assetFiles) {
    const pkgName = relFile.split(path.sep)[0];
    const pkgBase = pkgDirMap.get(pkgName!);
    if (!pkgBase) continue; // package wasn't in the move plans

    // Preserve the path within the package
    const withinPkg = relFile.split(path.sep).slice(1).join(path.sep);
    const srcFile = path.join(srcDir, relFile);
    const destFile = path.join(outputDir, pkgBase, withinPkg);

    await fs.mkdir(path.dirname(destFile), { recursive: true });

    // For CSS files, rewrite @source directives
    if (relFile.endsWith(".css")) {
      let content = await fs.readFile(srcFile, "utf-8");
      content = rewriteCssSource(
        content,
        path.dirname(srcFile),
        path.dirname(destFile),
        srcDir,
        outputDir,
        pkgDirMap,
      );
      await fs.writeFile(destFile, content, "utf-8");
    } else {
      await fs.copyFile(srcFile, destFile);
    }
    copied++;
  }

  if (copied > 0) {
    console.log(`Copied ${copied} asset files`);
  }
}

/**
 * Rewrite CSS `@source` directives to point to the new locations.
 */
function rewriteCssSource(
  css: string,
  oldCssDir: string,
  newCssDir: string,
  srcDir: string,
  outputDir: string,
  pkgDirMap: Map<string, string>,
): string {
  return css.replace(/@source\s+"([^"]+)"/g, (_match, sourcePath: string) => {
    // Resolve the source path relative to the old CSS file location
    const absSource = path.resolve(oldCssDir, sourcePath);
    const relToSrc = path.relative(srcDir, absSource);

    // Find which package this source path refers to
    const sourcePkg = relToSrc.split(path.sep)[0];
    const targetBase = pkgDirMap.get(sourcePkg!);

    if (targetBase) {
      // Compute the glob suffix (e.g. "**/*.{ts,tsx}")
      const parts = sourcePath.replace(/^[./]*/, "").split("/");
      const globParts = parts.filter((p) => p.includes("*") || p.includes("{"));
      const globSuffix = globParts.join("/");

      // Compute the within-package prefix (non-glob path segments after the package name)
      const sourceWithinPkg = relToSrc.split(path.sep).slice(1);
      const nonGlobParts = sourceWithinPkg.filter((p) => !p.includes("*") && !p.includes("{"));

      const newAbsBase = path.join(outputDir, targetBase, ...nonGlobParts);
      let newRelPath = path.relative(newCssDir, newAbsBase);
      if (!newRelPath.startsWith(".")) newRelPath = "./" + newRelPath;
      // Normalize trailing slash
      newRelPath = newRelPath.replace(/\/+$/, "");

      if (globSuffix) {
        return `@source "${newRelPath}/${globSuffix}"`;
      }
      return `@source "${newRelPath}"`;
    }

    return _match;
  });
}

export async function updateTsConfigPaths(pathMapping: Map<string, string>, srcDir?: string) {
  const tsConfigPath = path.resolve(process.cwd(), "tsconfig.json");
  const content = await fs.readFile(tsConfigPath, "utf-8");
  const tsconfig = JSON.parse(content);

  if (!tsconfig.compilerOptions || !tsconfig.compilerOptions.paths) return;

  // Build a reverse lookup for efficient path matching
  const reverseLookup = new Map<string, string>();
  for (const [oldAbs, newAbs] of pathMapping) {
    reverseLookup.set(oldAbs, newAbs);
    // Also index without extension for flexible matching
    const noExt = oldAbs.replace(/\.(tsx?|jsx?)$/, "");
    if (!reverseLookup.has(noExt)) reverseLookup.set(noExt, newAbs);
  }

  function findMappedPath(absLoc: string): string | undefined {
    let mapped = reverseLookup.get(absLoc);
    if (!mapped) mapped = reverseLookup.get(absLoc + ".ts");
    if (!mapped) mapped = reverseLookup.get(absLoc + ".tsx");
    if (!mapped) mapped = reverseLookup.get(absLoc.replace(/\.js$/, ".ts"));
    if (!mapped) mapped = reverseLookup.get(absLoc + "/index.ts");
    if (!mapped) mapped = reverseLookup.get(absLoc + "/index.tsx");
    return mapped;
  }

  let changed = false;
  for (const [alias, locations] of Object.entries<string[]>(tsconfig.compilerOptions.paths)) {
    const newLocs = locations.map((loc) => {
      if (loc.endsWith("/*")) {
        const baseLoc = loc.slice(0, -2); // remove /*
        const absBase = path.resolve(process.cwd(), baseLoc);

        for (const [oldAbs, newAbs] of pathMapping.entries()) {
          if (oldAbs.startsWith(absBase + path.sep) || oldAbs.startsWith(absBase + "/")) {
            const oldRel = oldAbs.slice(absBase.length + 1);
            const newBase = newAbs.slice(0, newAbs.length - oldRel.length - 1);
            const relativeToRoot = path.relative(process.cwd(), newBase);
            return "./" + relativeToRoot + "/*";
          }
        }
        return loc;
      } else {
        const absLoc = path.resolve(process.cwd(), loc);
        const mapped = findMappedPath(absLoc);

        if (mapped) {
          const relativeToRoot = path.relative(process.cwd(), mapped);
          return "./" + relativeToRoot;
        }
      }
      return loc;
    });

    if (JSON.stringify(newLocs) !== JSON.stringify(locations)) {
      tsconfig.compilerOptions.paths[alias] = newLocs;
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(tsConfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
    console.log("Updated tsconfig.json paths");
  }
}

export async function updatePackagesConfigs(pathMapping: Map<string, string>, srcDir?: string) {
  const rootDir = process.cwd();
  const packagesDir = path.join(rootDir, "packages");
  const entries = await fs
    .readdir(packagesDir, { withFileTypes: true })
    .catch((): Dirent[] => []);

  // Build a secondary lookup: if srcDir is "src-old", also try matching
  // paths that reference "src/" (the output dir name) against the old paths.
  // e.g., packages/code references ../../src/code/modules.ts but pathMapping
  // has keys like <root>/src-old/code/modules.ts
  const srcDirAbs = srcDir ? path.resolve(rootDir, path.basename(srcDir)) : null;
  const outputDirName = "src"; // output is always "src"

  function findInMapping(absLoc: string): string | undefined {
    // Direct match
    const direct = tryMatch(absLoc);
    if (direct) return direct;

    // If the shim points to src/<pkg>/... but source is in src-old/<pkg>/...
    if (srcDirAbs && srcDir) {
      const srcBaseName = path.basename(srcDir);
      if (srcBaseName !== outputDirName) {
        // Replace /src/ with /src-old/ in the resolved path
        const outputBase = path.join(rootDir, outputDirName) + "/";
        if (absLoc.startsWith(outputBase)) {
          const altPath = path.join(rootDir, srcBaseName, absLoc.slice(outputBase.length));
          const alt = tryMatch(altPath);
          if (alt) return alt;
        }
      }
    }
    return undefined;
  }

  function tryMatch(absLoc: string): string | undefined {
    for (const [oldAbs, newAbs] of pathMapping.entries()) {
      if (
        absLoc === oldAbs ||
        absLoc === oldAbs.replace(/\.ts$/, ".js") ||
        absLoc.replace(/\.js$/, ".ts") === oldAbs ||
        absLoc === oldAbs.replace(/\.ts$/, ".d.ts") ||
        absLoc.replace(/\.tsx?$/, "") === oldAbs.replace(/\.tsx?$/, "")
      ) {
        return newAbs;
      }
    }
    return undefined;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(packagesDir, entry.name);

    // package.json
    const pkgJsonPath = path.join(pkgPath, "package.json");
    try {
      const content = await fs.readFile(pkgJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      let changed = false;

      const updatePath = (p: string) => {
        if (!p.includes("src/") && !p.includes("src-old/")) return p;
        const absLoc = path.resolve(pkgPath, p);
        const newAbs = findInMapping(absLoc);
        if (newAbs) {
          const rel = path.relative(pkgPath, newAbs);
          let newP = rel.startsWith(".") ? rel : "./" + rel;
          if (p.endsWith(".js") && newP.endsWith(".ts")) newP = newP.replace(/\.ts$/, ".js");
          if (p.endsWith(".d.ts") && newP.endsWith(".ts")) newP = newP.replace(/\.ts$/, ".d.ts");
          return newP;
        }
        return p;
      };

      if (pkg.main) {
        const n = updatePath(pkg.main);
        if (n !== pkg.main) {
          pkg.main = n;
          changed = true;
        }
      }
      if (pkg.types) {
        const n = updatePath(pkg.types);
        if (n !== pkg.types) {
          pkg.types = n;
          changed = true;
        }
      }
      if (pkg.exports) {
        const traverse = (obj: any) => {
          for (const key in obj) {
            if (typeof obj[key] === "string") {
              const n = updatePath(obj[key]);
              if (n !== obj[key]) {
                obj[key] = n;
                changed = true;
              }
            } else if (typeof obj[key] === "object") {
              traverse(obj[key]);
            }
          }
        };
        traverse(pkg.exports);
      }

      if (changed) {
        await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
        console.log(`Updated ${path.relative(rootDir, pkgJsonPath)}`);
      }
    } catch (e) {}

    // wrangler.toml
    const wranglerPath = path.join(pkgPath, "wrangler.toml");
    try {
      let content = await fs.readFile(wranglerPath, "utf-8");
      let changed = false;

      content = content.replace(/(?:main|entry)\s*=\s*["']([^"']+)["']/g, (match, p1) => {
        if (p1.includes("src/") || p1.includes("src-old/")) {
          const absLoc = path.resolve(pkgPath, p1);
          const newAbs = findInMapping(absLoc);
          if (newAbs) {
            const rel = path.relative(pkgPath, newAbs);
            changed = true;
            return match.replace(p1, rel.startsWith(".") ? rel : "./" + rel);
          }
        }
        return match;
      });
      if (changed) {
        await fs.writeFile(wranglerPath, content);
        console.log(`Updated ${path.relative(rootDir, wranglerPath)}`);
      }
    } catch (e) {}

    // TypeScript shim files (index.ts, main.ts, cli.ts, etc.)
    // These contain re-exports like: export * from "../../src/code/modules.ts"
    const shimFiles = ["index.ts", "main.ts", "cli.ts"];
    for (const shimName of shimFiles) {
      const shimPath = path.join(pkgPath, shimName);
      try {
        let content = await fs.readFile(shimPath, "utf-8");
        let changed = false;

        content = content.replace(
          /(from\s+["'])([^"']+)(["'])/g,
          (_match, pre, specifier, post) => {
            if (!specifier.includes("src/") && !specifier.includes("src-old/")) return _match;
            const absLoc = path.resolve(pkgPath, specifier);
            const newAbs = findInMapping(absLoc);
            if (newAbs) {
              let rel = path.relative(pkgPath, newAbs);
              if (!rel.startsWith(".")) rel = "./" + rel;
              // Preserve original extension convention
              if (specifier.endsWith(".ts") && !rel.endsWith(".ts") && !rel.endsWith(".tsx")) {
                rel = rel + ".ts";
              }
              changed = true;
              return `${pre}${rel}${post}`;
            }
            return _match;
          },
        );

        // Also handle: import "../../src/spike-app/main.tsx"
        content = content.replace(
          /(import\s+["'])([^"']+)(["'])/g,
          (_match, pre, specifier, post) => {
            if (!specifier.includes("src/") && !specifier.includes("src-old/")) return _match;
            const absLoc = path.resolve(pkgPath, specifier);
            const newAbs = findInMapping(absLoc);
            if (newAbs) {
              let rel = path.relative(pkgPath, newAbs);
              if (!rel.startsWith(".")) rel = "./" + rel;
              changed = true;
              return `${pre}${rel}${post}`;
            }
            return _match;
          },
        );

        if (changed) {
          await fs.writeFile(shimPath, content, "utf-8");
          console.log(`Updated ${path.relative(rootDir, shimPath)}`);
        }
      } catch (e) {}
    }

    // tsconfig.json — update paths and include patterns
    const pkgTsconfigPath = path.join(pkgPath, "tsconfig.json");
    try {
      const content = await fs.readFile(pkgTsconfigPath, "utf-8");
      const tsconfig = JSON.parse(content);
      let changed = false;

      // Update "include" patterns
      if (tsconfig.include && Array.isArray(tsconfig.include)) {
        const newInclude = tsconfig.include.map((pattern: string) => {
          if (!pattern.includes("src/") && !pattern.includes("src-old/")) return pattern;
          // Extract the package directory from the glob pattern
          // e.g., "../../src/spike-app/**/*.ts" → find where spike-app files went
          const basePattern = pattern
            .replace(/\*\*\/\*\.\{?[a-z,]+\}?$|\*\*\/\*\.\w+$|\*\*\/\*$/, "")
            .replace(/\/$/, "");
          if (!basePattern) return pattern;
          const absBase = path.resolve(pkgPath, basePattern);

          // Find any mapped file under this base and go up to category/appName level
          const tryResolve = (searchBase: string) => {
            for (const [oldAbs, newAbs] of pathMapping.entries()) {
              if (oldAbs.startsWith(searchBase + "/")) {
                // Get category/appName (first 2 parts of path relative to output)
                const outputDir = path.resolve(rootDir, "src");
                const newRel = path.relative(outputDir, newAbs);
                const parts = newRel.split(path.sep);
                if (parts.length >= 2) {
                  const appBase = path.join(outputDir, parts[0]!, parts[1]!);
                  let relBase = path.relative(pkgPath, appBase);
                  if (!relBase.startsWith(".")) relBase = "./" + relBase;
                  const suffix = pattern.slice(pattern.indexOf(basePattern) + basePattern.length);
                  return relBase + suffix;
                }
              }
            }
            return null;
          };

          const result = tryResolve(absBase);
          if (result && result !== pattern) {
            changed = true;
            return result;
          }

          // Also try with src-old → src mapping
          if (srcDir) {
            const srcBaseName = path.basename(srcDir);
            const altBase = absBase.replace(/\/src\//, `/${srcBaseName}/`);
            const altResult = tryResolve(altBase);
            if (altResult && altResult !== pattern) {
              changed = true;
              return altResult;
            }
          }
          return pattern;
        });
        if (changed) {
          tsconfig.include = newInclude;
        }
      }

      // Update "paths" entries
      if (tsconfig.compilerOptions?.paths) {
        for (const [alias, locations] of Object.entries<string[]>(tsconfig.compilerOptions.paths)) {
          const newLocs = locations.map((loc) => {
            if (!loc.includes("src/") && !loc.includes("src-old/")) return loc;
            if (loc.endsWith("/*")) {
              const baseLoc = loc.slice(0, -2);
              const absBase = path.resolve(pkgPath, baseLoc);

              const tryResolveWild = (searchBase: string) => {
                for (const [oldAbs, newAbs] of pathMapping.entries()) {
                  if (oldAbs.startsWith(searchBase + "/")) {
                    // For @/* aliases, go up to category/appName level
                    const outputDir = path.resolve(rootDir, "src");
                    const newRel = path.relative(outputDir, newAbs);
                    const parts = newRel.split(path.sep);
                    if (parts.length >= 2) {
                      const appBase = path.join(outputDir, parts[0]!, parts[1]!);
                      const rel = path.relative(pkgPath, appBase);
                      return (rel.startsWith(".") ? rel : "./" + rel) + "/*";
                    }
                  }
                }
                return null;
              };

              const result = tryResolveWild(absBase);
              if (result) return result;

              if (srcDir) {
                const srcBaseName = path.basename(srcDir);
                const altBase = absBase.replace(/\/src\//, `/${srcBaseName}/`);
                const altResult = tryResolveWild(altBase);
                if (altResult) return altResult;
              }
            } else {
              const absLoc = path.resolve(pkgPath, loc);
              const mapped = findInMapping(absLoc);
              if (mapped) {
                const rel = path.relative(pkgPath, mapped);
                return rel.startsWith(".") ? rel : "./" + rel;
              }
            }
            return loc;
          });
          if (JSON.stringify(newLocs) !== JSON.stringify(locations)) {
            tsconfig.compilerOptions.paths[alias] = newLocs;
            changed = true;
          }
        }
      }

      if (changed) {
        await fs.writeFile(pkgTsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
        console.log(`Updated ${path.relative(rootDir, pkgTsconfigPath)}`);
      }
    } catch (e) {}

    // vite.config.ts — update resolve.alias and publicDir paths
    const viteConfigPath = path.join(pkgPath, "vite.config.ts");
    try {
      let content = await fs.readFile(viteConfigPath, "utf-8");
      let changed = false;

      /**
       * Resolve a src/ path reference in vite config to its new location.
       * For file references, returns the new file path.
       * For directory references, finds the package's app-level dir and
       * preserves any sub-path beyond the package root.
       */
      const resolveViteRef = (absRef: string): string | null => {
        // Exact file match first
        const exact = findInMapping(absRef);
        if (exact) return exact;

        // Directory reference: find the old package root, compute new app root,
        // then append whatever sub-path remains
        const tryDirResolve = (searchBase: string) => {
          for (const [oldAbs, newAbs] of pathMapping.entries()) {
            if (oldAbs.startsWith(searchBase + "/")) {
              // Found a file under searchBase. Determine the package root
              // by finding the srcDir/<packageName> prefix
              const srcDirAbs = srcDir
                ? path.resolve(rootDir, path.basename(srcDir))
                : path.resolve(rootDir, "src");
              const relToSrc = path.relative(srcDirAbs, oldAbs);
              const pkgName = relToSrc.split(path.sep)[0];
              const pkgRoot = path.join(srcDirAbs, pkgName!);

              // The sub-path beyond the package root in the reference
              const subPath = path.relative(pkgRoot, searchBase);

              // New app root (category/appName)
              const outputDir = path.resolve(rootDir, "src");
              const newRel = path.relative(outputDir, newAbs);
              const parts = newRel.split(path.sep);
              if (parts.length >= 2) {
                const appRoot = path.join(outputDir, parts[0]!, parts[1]!);
                // Append the sub-path (e.g., "public", "src/ui")
                if (subPath && subPath !== ".") {
                  return path.join(appRoot, subPath);
                }
                return appRoot;
              }
            }
          }
          return null;
        };

        const result = tryDirResolve(absRef);
        if (result) return result;

        if (srcDir) {
          const srcBaseName = path.basename(srcDir);
          const altRef = absRef.replace(/\/src\//, `/${srcBaseName}/`);
          const altExact = findInMapping(altRef);
          if (altExact) return altExact;
          const altResult = tryDirResolve(altRef);
          if (altResult) return altResult;
        }
        return null;
      };

      // Update path references like resolve(import.meta.dirname, "../../src/spike-app/...")
      content = content.replace(
        /(resolve\([^,]+,\s*["'])([^"']*(?:src\/|src-old\/)[^"']*)(["'])/g,
        (_match, pre, refPath, post) => {
          const absRef = path.resolve(pkgPath, refPath);
          const resolved = resolveViteRef(absRef);
          if (resolved) {
            let rel = path.relative(pkgPath, resolved);
            if (!rel.startsWith(".")) rel = "./" + rel;
            changed = true;
            return `${pre}${rel}${post}`;
          }
          return _match;
        },
      );

      if (changed) {
        await fs.writeFile(viteConfigPath, content, "utf-8");
        console.log(`Updated ${path.relative(rootDir, viteConfigPath)}`);
      }
    } catch (e) {}
  }
}

export async function updatePackageJsonWorkspaces(outputDir: string) {
  try {
    const pkgJsonPath = path.resolve(process.cwd(), "package.json");
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
    if (pkgJson.workspaces) {
      const outRel = path.basename(outputDir);
      const newGlob = `${outRel}/*/*/*`;
      if (!pkgJson.workspaces.includes(newGlob)) {
        pkgJson.workspaces.push(newGlob);
        await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
        console.log(`Updated package.json workspaces with ${newGlob}`);
      }
    }
  } catch (e) {
    console.error("Failed to update package.json workspaces", e);
  }
}

export async function generateManifests(plans: MovePlan[], outputDir: string) {
  const appMap = new Map<string, { files: string[]; deps: Set<string> }>();

  for (const p of plans) {
    const parts = p.targetDir.split(path.sep);
    const appFolder = parts.slice(0, 2).join(path.sep);

    if (!appMap.has(appFolder)) {
      appMap.set(appFolder, { files: [], deps: new Set() });
    }
    const appData = appMap.get(appFolder)!;
    appData.files.push(path.relative(appFolder, p.targetRelPath));
    for (const d of p.fileNode.externalDeps) {
      appData.deps.add(d);
    }
  }

  for (const [appFolder, data] of appMap.entries()) {
    const manifestPath = path.resolve(outputDir, appFolder, "manifest.json");
    const manifest = {
      name: path.basename(appFolder),
      category: path.dirname(appFolder),
      dependencies: Array.from(data.deps).sort(),
      files: data.files.sort(),
    };
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  }
}

export async function generateBarrels(outputDir: string, plans: MovePlan[]) {
  const dirSet = new Set<string>();
  for (const p of plans) {
    let d = path.dirname(p.targetRelPath);
    while (d !== "." && d !== "/") {
      dirSet.add(d);
      d = path.dirname(d);
    }
  }

  const BARREL_THRESHOLD = 3;
  const sortedDirs = Array.from(dirSet).sort((a, b) => b.length - a.length);
  const barrelProject = new Project({ useInMemoryFileSystem: true });

  for (const d of sortedDirs) {
    if (d.includes("__tests__") || d.endsWith(".test") || path.basename(d) === "__tests__")
      continue;

    const base = path.basename(d);
    if (base === "lazy-imports" || base === "core-logic" || base === "node-sys") continue;

    const absD = path.resolve(outputDir, d);
    const entries = await fs.readdir(absD, { withFileTypes: true });

    const exportableCount = entries.filter((e) => {
      if (e.name === "index.ts" || e.name === "index.tsx") return false;
      if (e.name.startsWith("_")) return false;
      if (e.name.endsWith(".test.ts") || e.name.endsWith(".test.tsx") || e.name.includes(".spec."))
        return false;
      if (e.isDirectory()) return true;
      return e.name.endsWith(".ts") || e.name.endsWith(".tsx");
    }).length;

    if (exportableCount < BARREL_THRESHOLD) continue;

    let barrelContent = "";
    for (const entry of entries) {
      if (entry.name === "index.ts" || entry.name === "index.tsx") continue;
      if (entry.name.startsWith("_")) continue;
      if (entry.name === "utils.ts" || entry.name === "utils.tsx") continue;
      if (
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".test.tsx") ||
        entry.name.includes(".spec.")
      )
        continue;

      const filePath = path.join(absD, entry.name);

      if (entry.isDirectory()) {
        const children = await fs.readdir(filePath).catch((): string[] => []);
        if (children.some((f) => f === "index.ts" || f === "index.tsx")) {
          barrelContent += `export * from "./${entry.name}";\n`;
        }
      } else {
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
        const fileContent = await fs.readFile(filePath, "utf-8");
        const sf = barrelProject.createSourceFile(filePath, fileContent, { overwrite: true });
        const exports = sf.getExportDeclarations();
        const exportedDecs = sf.getExportedDeclarations();
        if (exports.length > 0 || exportedDecs.size > 0) {
          const baseName = path.basename(entry.name, path.extname(entry.name));
          barrelContent += `export * from "./${baseName}";\n`;
        }
      }
    }
    if (barrelContent) {
      await fs.writeFile(path.join(absD, "index.ts"), barrelContent, "utf-8");
    }
  }
}
