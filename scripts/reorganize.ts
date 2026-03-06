#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import * as yaml from "yaml";
import { Project, SyntaxKind, StringLiteral, NoSubstitutionTemplateLiteral } from "ts-morph";
import {
  excludedDeps,
  categoryRules,
  fallbackCategory,
  nameOverrides,
  excludeGlobs,
  getDependencyGroupName,
  kindToCategory,
  deduplicateDepGroup,
} from "./reorganize-config.js";

export interface FileNode {
  absPath: string;
  relPath: string; // relative to src/
  packageName: string;
  externalDeps: Set<string>;
  relativeImports: Set<string>; // abs paths
  resolvedDeps?: Set<string>; // inherited
}

export interface MovePlan {
  fileNode: FileNode;
  targetDir: string;
  targetFileName: string;
  targetRelPath: string; // new path relative to src/
}

interface ManifestPkg {
  kind?: string;
}

// ─── UTILS ─────────────────────────────────────────────────────────────

function extractRootPackage(importPath: string): string | null {
  if (importPath.startsWith(".") || importPath.startsWith("/") || importPath.startsWith("http")) {
    return null;
  }
  if (importPath.startsWith("@/")) {
    return null; // path alias
  }
  const parts = importPath.split("/");
  if (importPath.startsWith("@") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

async function readPackagesYaml(): Promise<Record<string, ManifestPkg>> {
  try {
    const content = await fs.readFile("packages.yaml", "utf-8");
    const parsed = yaml.parse(content);
    return parsed.packages || {};
  } catch (e) {
    return {};
  }
}

// ─── PHASE 2: DISCOVERY ───────────────────────────────────────────────

async function discoverFiles(project: Project): Promise<FileNode[]> {
  const root = path.resolve(process.cwd(), "src");
  const nodes: FileNode[] = [];
  
  for (const sourceFile of project.getSourceFiles()) {
    const absPath = sourceFile.getFilePath();
    if (!absPath.includes("/src/")) continue;
    
    const relPath = path.relative(root, absPath);
    const packageName = relPath.split(path.sep)[0];
    
    const externalDeps = new Set<string>();
    const relativeImports = new Set<string>();
    
    const imports = sourceFile.getImportDeclarations();
    const exports = sourceFile.getExportDeclarations();
    const dynamicImports = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(c => c.getExpression().getText() === "import");

    const specs = [
        ...imports.map(i => i.getModuleSpecifierValue()).filter(Boolean),
        ...exports.map(e => e.getModuleSpecifierValue()).filter(Boolean),
        ...dynamicImports.map(d => {
            const arg = d.getArguments()[0];
            if (arg && (arg.getKind() === SyntaxKind.StringLiteral || arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)) {
                return (arg as StringLiteral | NoSubstitutionTemplateLiteral).getLiteralText();
            }
            return null;
        }).filter(Boolean)
    ] as string[];
    
    for (const importPath of specs) {
      if (importPath.startsWith("http") || importPath.endsWith(".css") || importPath.endsWith(".json") || importPath.includes("${")) continue;
      
      if (importPath.startsWith(".") || importPath.startsWith("/")) {
        const dir = path.dirname(absPath);
        const resolved = path.resolve(dir, importPath);
        relativeImports.add(resolved);
      } else if (importPath.startsWith("@/")) {
        // Alias, treat as internal
      } else {
        const rootPkg = extractRootPackage(importPath);
        if (rootPkg && !excludedDeps.has(rootPkg)) {
          externalDeps.add(rootPkg);
        }
      }
    }
    
    nodes.push({ absPath, relPath, packageName, externalDeps, relativeImports });
  }
  return nodes;
}

// ─── PHASE 3: GROUPING ────────────────────────────────────────────────

// Build a lookup map from absolute path (with/without extension) to FileNode
export function buildNodeLookup(nodes: FileNode[]): Map<string, FileNode> {
  const lookup = new Map<string, FileNode>();
  for (const n of nodes) {
    lookup.set(n.absPath, n);
    const noExt = n.absPath.replace(/\.(tsx|ts|js|jsx)$/, "");
    lookup.set(noExt, n);
    if (noExt.endsWith("/index")) {
      lookup.set(noExt.slice(0, -6), n);
    }
  }
  return lookup;
}

function resolveImportTarget(
  importPath: string,
  lookup: Map<string, FileNode>,
): FileNode | undefined {
  const noExt = importPath.replace(/\.(tsx|ts|js|jsx)$/, "");
  return lookup.get(importPath) || lookup.get(noExt) || lookup.get(noExt + "/index");
}

// FIXED: Propagate deps from importees to importers (forward direction).
// If A imports B, then A transitively depends on B's deps.
// Previously this was inverted — importers' deps were pushed to importees.
export function propagateDeps(nodes: FileNode[]) {
  const lookup = buildNodeLookup(nodes);

  for (const n of nodes) {
    n.resolvedDeps = new Set(n.externalDeps);
  }

  let changed = true;
  let rounds = 0;
  while (changed && rounds < 10) {
    changed = false;
    rounds++;
    for (const n of nodes) {
      const sizeBefore = n.resolvedDeps!.size;
      for (const importPath of n.relativeImports) {
        const target = resolveImportTarget(importPath, lookup);
        if (target?.resolvedDeps) {
          for (const dep of target.resolvedDeps) {
            n.resolvedDeps!.add(dep);
          }
        }
      }
      if (n.resolvedDeps!.size > sizeBefore) changed = true;
    }
  }
}

// Compute a single category per package (not per file).
// Priority: packages.yaml kind → dominant file-level category → fallback
export function computePackageCategories(
  nodes: FileNode[],
  packagesYaml: Record<string, { kind?: string }>,
): Map<string, string> {
  const result = new Map<string, string>();

  const byPackage = new Map<string, FileNode[]>();
  for (const n of nodes) {
    let arr = byPackage.get(n.packageName);
    if (!arr) {
      arr = [];
      byPackage.set(n.packageName, arr);
    }
    arr.push(n);
  }

  for (const [pkgName, pkgNodes] of byPackage) {
    const pkgKind = packagesYaml[pkgName]?.kind;

    // 1. Try packages.yaml kind → category mapping
    if (pkgKind && kindToCategory[pkgKind]) {
      result.set(pkgName, kindToCategory[pkgKind]);
      continue;
    }

    // 2. Compute dominant category from file-level rules
    const categoryCounts = new Map<string, number>();
    for (const n of pkgNodes) {
      let fileCategory = fallbackCategory;
      for (const rule of categoryRules) {
        if (rule.predicate(n.resolvedDeps!, n.externalDeps, pkgKind)) {
          fileCategory = rule.category;
          break;
        }
      }
      categoryCounts.set(fileCategory, (categoryCounts.get(fileCategory) || 0) + 1);
    }

    // Pick most common non-fallback category
    let bestCategory = fallbackCategory;
    let bestCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (cat !== fallbackCategory && count > bestCount) {
        bestCategory = cat;
        bestCount = count;
      }
    }

    result.set(pkgName, bestCategory);
  }

  return result;
}

export function resolveAppName(packageName: string): string {
  if (nameOverrides[packageName]) return nameOverrides[packageName];
  let name = packageName;
  if (name.endsWith("-mcp")) name = name.replace("-mcp", "");
  if (name.startsWith("mcp-")) name = name.replace("mcp-", "");
  return name;
}

// ─── PHASE 4: FLATTEN ─────────────────────────────────────────────────

function flattenFilename(relPath: string, packageName: string): string {
  const parts = relPath.split(path.sep);
  const fileName = parts.pop()!;
  
  if (fileName === "index.ts" || fileName === "index.tsx") {
    if (parts.length > 1) {
      const parent = parts[parts.length - 1];
      return `${parent}-${fileName}`;
    }
  }
  return fileName;
}

// ─── EXECUTION ────────────────────────────────────────────────────────

function rewriteSingleImport(p1: string, oldPath: string, newDir: string, pathMapping: Map<string, string>): string {
  if (p1.startsWith("http") || (!p1.startsWith(".") && !p1.startsWith("/") && !p1.startsWith("@/")) || p1.includes("${")) {
    return p1;
  }
  
  if (p1.startsWith("@/")) {
    return p1;
  }

  const oldDir = path.dirname(oldPath);
  let resolvedAbs = path.resolve(oldDir, p1);
  
  let mapped = pathMapping.get(resolvedAbs);
  if (!mapped) {
    if (pathMapping.has(resolvedAbs + ".ts")) mapped = pathMapping.get(resolvedAbs + ".ts");
    else if (pathMapping.has(resolvedAbs + ".tsx")) mapped = pathMapping.get(resolvedAbs + ".tsx");
    else if (pathMapping.has(resolvedAbs.replace(/\.js$/, ".ts"))) mapped = pathMapping.get(resolvedAbs.replace(/\.js$/, ".ts"));
    else if (pathMapping.has(resolvedAbs.replace(/\.js$/, ".tsx"))) mapped = pathMapping.get(resolvedAbs.replace(/\.js$/, ".tsx"));
    else if (pathMapping.has(resolvedAbs + "/index.ts")) mapped = pathMapping.get(resolvedAbs + "/index.ts");
    else if (pathMapping.has(resolvedAbs + "/index.tsx")) mapped = pathMapping.get(resolvedAbs + "/index.tsx");
  }

  if (mapped) {
    let newRel = path.relative(newDir, mapped);
    if (!newRel.startsWith(".")) newRel = "./" + newRel;
    
    if (p1.endsWith(".js")) {
      newRel = newRel.replace(/\.tsx?$/, ".js");
    } else {
       if ((mapped.endsWith("index.ts") || mapped.endsWith("index.tsx")) && !p1.endsWith("index.ts") && !p1.endsWith("index.tsx") && !p1.endsWith("index.js")) {
          newRel = newRel.replace(/\/index\.tsx?$/, "");
          if (newRel === "") newRel = ".";
       } else {
          newRel = newRel.replace(/\.tsx?$/, "");
       }
    }
    return newRel;
  }
  
  return p1;
}

function rewriteImports(project: Project, oldPath: string, newPath: string, pathMapping: Map<string, string>): string {
  const sourceFile = project.getSourceFileOrThrow(oldPath);
  const newDir = path.dirname(newPath);
  
  const processSpecifier = (spec: string) => {
    return rewriteSingleImport(spec, oldPath, newDir, pathMapping);
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
      if (arg && (arg.getKind() === SyntaxKind.StringLiteral || arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)) {
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

async function updateTsConfigPaths(pathMapping: Map<string, string>) {
  const tsConfigPath = path.resolve(process.cwd(), "tsconfig.json");
  const content = await fs.readFile(tsConfigPath, "utf-8");
  const tsconfig = JSON.parse(content);
  
  if (!tsconfig.compilerOptions || !tsconfig.compilerOptions.paths) return;
  
  let changed = false;
  for (const [alias, locations] of Object.entries<string[]>(tsconfig.compilerOptions.paths)) {
    const newLocs = locations.map(loc => {
      if (loc.endsWith("/*")) {
         const baseLoc = loc.slice(0, -2); // remove /*
         const absBase = path.resolve(process.cwd(), baseLoc);
         
         for (const [oldAbs, newAbs] of pathMapping.entries()) {
             if (oldAbs.startsWith(absBase + path.sep) || oldAbs.startsWith(absBase + "/")) {
                 const oldRel = oldAbs.slice(absBase.length + 1);
                 const newBase = newAbs.slice(0, newAbs.length - oldRel.length - 1);
                 const relativeToRoot = path.relative(process.cwd(), newBase);
                 return "./" + relativeToRoot.replace("src-reorganized", "src") + "/*";
             }
         }
         return loc;
      } else {
         const absLoc = path.resolve(process.cwd(), loc);
         let mapped = pathMapping.get(absLoc);
         if (!mapped) mapped = pathMapping.get(absLoc + ".ts");
         if (!mapped) mapped = pathMapping.get(absLoc + ".tsx");
         if (!mapped) mapped = pathMapping.get(absLoc.replace(/\.js$/, ".ts"));
         if (!mapped) mapped = pathMapping.get(absLoc + "/index.ts");
         
         if (mapped) {
             const relativeToRoot = path.relative(process.cwd(), mapped);
             return "./" + relativeToRoot.replace("src-reorganized", "src");
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

async function updatePackagesConfigs(pathMapping: Map<string, string>) {
  const rootDir = process.cwd();
  const packagesDir = path.join(rootDir, "packages");
  const entries = await fs.readdir(packagesDir, { withFileTypes: true }).catch(() => []);
  
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
         if (!p.includes("src/")) return p;
         const absLoc = path.resolve(pkgPath, p);
         for (const [oldAbs, newAbs] of pathMapping.entries()) {
             if (absLoc === oldAbs || absLoc === oldAbs.replace(/\.ts$/, ".js") || absLoc.replace(/\.js$/, ".ts") === oldAbs || absLoc === oldAbs.replace(/\.ts$/, ".d.ts")) {
                 const rel = path.relative(pkgPath, newAbs).replace("src-reorganized", "src");
                 let newP = rel.startsWith(".") ? rel : "./" + rel;
                 if (p.endsWith(".js") && newP.endsWith(".ts")) newP = newP.replace(/\.ts$/, ".js");
                 if (p.endsWith(".d.ts") && newP.endsWith(".ts")) newP = newP.replace(/\.ts$/, ".d.ts");
                 return newP;
             }
         }
         return p;
      };
      
      if (pkg.main) { const n = updatePath(pkg.main); if (n !== pkg.main) { pkg.main = n; changed = true; } }
      if (pkg.types) { const n = updatePath(pkg.types); if (n !== pkg.types) { pkg.types = n; changed = true; } }
      if (pkg.exports) {
         const traverse = (obj: any) => {
            for (const key in obj) {
               if (typeof obj[key] === "string") {
                  const n = updatePath(obj[key]);
                  if (n !== obj[key]) { obj[key] = n; changed = true; }
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
          if (p1.includes("src/")) {
             const absLoc = path.resolve(pkgPath, p1);
             for (const [oldAbs, newAbs] of pathMapping.entries()) {
                 if (absLoc === oldAbs || absLoc === oldAbs.replace(/\.ts$/, ".js") || absLoc.replace(/\.js$/, ".ts") === oldAbs) {
                     const rel = path.relative(pkgPath, newAbs).replace("src-reorganized", "src");
                     changed = true;
                     return match.replace(p1, rel.startsWith(".") ? rel : "./" + rel);
                 }
             }
          }
          return match;
      });
      if (changed) {
         await fs.writeFile(wranglerPath, content);
         console.log(`Updated ${path.relative(rootDir, wranglerPath)}`);
      }
    } catch (e) {}
  }
}

async function updatePackageJsonWorkspaces(outputDir: string) {
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

async function generateManifests(plans: MovePlan[], outputDir: string) {
  const appMap = new Map<string, { files: string[], deps: Set<string> }>();
  
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
       files: data.files.sort()
    };
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean" },
      verify: { type: "boolean" },
      output: { type: "string", default: "src-reorganized" },
    },
  });

  const outputDir = path.resolve(process.cwd(), values.output as string);
  const srcDir = path.resolve(process.cwd(), "src");

  if (values.apply) {
    try {
      execSync("git diff --quiet", { stdio: "ignore" });
    } catch {
      console.error("Git working directory not clean. Commit or stash before --apply");
      process.exit(1);
    }
  }

  const packagesYaml = await readPackagesYaml();
  
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
  const files = await glob("**/*.{ts,tsx}", {
    cwd: srcDir,
    ignore: excludeGlobs,
    absolute: true,
  });
  project.addSourceFilesAtPaths(files);

  const nodes = await discoverFiles(project);
  resolveZeroImportFiles(nodes);

  const plans: MovePlan[] = [];
  const targetCounts = new Map<string, number>();

  for (const n of nodes) {
    const depGroupName = getDependencyGroupName(n.resolvedDeps!);
    let category = fallbackCategory;
    
    for (const rule of categoryRules) {
      if (rule.predicate(n.resolvedDeps!, n.externalDeps, packagesYaml[n.packageName]?.kind)) {
        category = rule.category;
        break;
      }
    }

    const appName = resolveAppName(n.packageName);
    const targetDir = path.join(category, appName, depGroupName);
    
    // Colocate tests, do not use __tests__ directory
    const finalDir = targetDir;
    
    let fileName = flattenFilename(n.relPath, n.packageName);
    
    const fullTargetDir = path.join(outputDir, finalDir);
    const targetPath = path.join(fullTargetDir, fileName);
    let disambigName = fileName;
    let count = targetCounts.get(targetPath) || 0;
    if (count > 0) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      disambigName = `${base}-${n.packageName}${ext}`;
    }
    targetCounts.set(targetPath, count + 1);

    plans.push({
      fileNode: n,
      targetDir: finalDir,
      targetFileName: disambigName,
      targetRelPath: path.join(finalDir, disambigName),
    });
  }

  console.log(`Discovered ${nodes.length} files. Grouping...`);

  if (!values.apply) {
    const stats = new Map<string, number>();
    for (const p of plans) {
      stats.set(p.targetDir, (stats.get(p.targetDir) || 0) + 1);
    }
    console.log(`\nDry run summary (Top 15 dirs):`);
    const sorted = [...stats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [dir, count] of sorted) {
      console.log(`  ${dir}: ${count} files`);
    }
    console.log(`\nRun with --apply to execute.`);
    return;
  }

  console.log(`\nApplying changes to ${values.output}...`);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const pathMapping = new Map<string, string>();
  for (const p of plans) {
    const absNewPath = path.resolve(outputDir, p.targetRelPath);
    pathMapping.set(p.fileNode.absPath, absNewPath);
  }

  for (const p of plans) {
    const absNewPath = path.resolve(outputDir, p.targetRelPath);
    await fs.mkdir(path.dirname(absNewPath), { recursive: true });
    
    const newContent = rewriteImports(project, p.fileNode.absPath, absNewPath, pathMapping);
    await fs.writeFile(absNewPath, newContent, "utf-8");
  }

  const dirSet = new Set<string>();
  for (const p of plans) {
    let d = path.dirname(p.targetRelPath);
    while (d !== "." && d !== "/") {
      dirSet.add(d);
      d = path.dirname(d);
    }
  }
  
  const sortedDirs = Array.from(dirSet).sort((a, b) => b.length - a.length);
  const barrelProject = new Project({ useInMemoryFileSystem: true });
  
  for (const d of sortedDirs) {
    if (d.includes("__tests__") || d.endsWith(".test") || path.basename(d) === "__tests__") continue;
    
    const absD = path.resolve(outputDir, d);
    const entries = await fs.readdir(absD, { withFileTypes: true });
    let barrelContent = "";
    
    for (const entry of entries) {
      if (entry.name === "index.ts" || entry.name === "index.tsx") continue;
      if (entry.name.startsWith("_")) continue;
      if (entry.name === "utils.ts" || entry.name === "utils.tsx") continue;
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx") || entry.name.includes(".spec.")) continue;
      
      const filePath = path.join(absD, entry.name);
      
      if (entry.isDirectory()) {
         const children = await fs.readdir(filePath).catch(() => []);
         if (children.some(f => f === "index.ts" || f === "index.tsx")) {
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

  await updateTsConfigPaths(pathMapping);
  await updatePackagesConfigs(pathMapping);
  await updatePackageJsonWorkspaces(outputDir);
  await generateManifests(plans, outputDir);

  if (values.verify) {
    console.log("\nVerifying...");
    try {
      console.log("Running TSC...");
      execSync("npx tsc --noEmit", { stdio: "inherit" });
      console.log("Running ESLint...");
      execSync("npx eslint " + values.output, { stdio: "inherit" });
      console.log("Running Vitest...");
      execSync("npx vitest run " + values.output, { stdio: "inherit" });
      console.log("Verification passed!");
    } catch (e) {
      console.error("Verification failed:", e);
    }
  }
}

main().catch(console.error);
