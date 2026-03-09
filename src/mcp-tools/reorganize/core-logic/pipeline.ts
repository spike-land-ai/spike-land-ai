import path from "node:path";
import { glob } from "glob";
import { execSync } from "node:child_process";
import { Project } from "ts-morph";

import { excludeGlobs } from "../../../../scripts/reorganize-config.js";
import { readPackagesYaml } from "../../../../scripts/reorganize/utils.js";
import { discoverFiles } from "../../../../scripts/reorganize/discovery.js";
import { propagateDeps, computePackageCategories } from "../../../../scripts/reorganize/grouping.js";
import { computeMovePlans } from "../../../../scripts/reorganize/planning.js";
import type { FileNode, MovePlan, AliasMap, ManifestPkg } from "../../../../scripts/reorganize/types.js";

export interface PipelineResult {
  project: Project;
  nodes: FileNode[];
  aliasMap: AliasMap;
  packageCategories: Map<string, string>;
  plans: MovePlan[];
  packagesYaml: Record<string, ManifestPkg>;
  srcDir: string;
}

export async function runPipeline(
  srcDir?: string,
  incremental = false,
): Promise<PipelineResult> {
  const resolvedSrcDir = srcDir
    ? path.resolve(process.cwd(), srcDir)
    : path.resolve(process.cwd(), "src");

  const packagesYaml = await readPackagesYaml();

  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  let filesToProcess: string[] = [];
  if (incremental) {
    try {
      const stdout = execSync("git diff --name-only HEAD", { encoding: "utf-8" });
      const srcRel = path.relative(process.cwd(), resolvedSrcDir);
      filesToProcess = stdout
        .split("\n")
        .filter((f) => f.startsWith(srcRel + "/") && (f.endsWith(".ts") || f.endsWith(".tsx")))
        .map((f) => path.resolve(process.cwd(), f));
    } catch {
      // git not available or no changes
    }
  }

  const allFiles = await glob("**/*.{ts,tsx}", {
    cwd: resolvedSrcDir,
    ignore: excludeGlobs,
    absolute: true,
  });

  project.addSourceFilesAtPaths(allFiles);

  const { nodes, aliasMap } = await discoverFiles(project, resolvedSrcDir);
  propagateDeps(nodes);

  const packageCategories = computePackageCategories(nodes, packagesYaml);
  const plans = computeMovePlans(nodes, packageCategories);

  return {
    project,
    nodes,
    aliasMap,
    packageCategories,
    plans,
    packagesYaml,
    srcDir: resolvedSrcDir,
  };
}
