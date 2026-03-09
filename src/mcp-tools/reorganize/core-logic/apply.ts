import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult, textResult } from "@spike-land-ai/mcp-server-base";
import { runPipeline } from "./pipeline.js";
import {
  rewriteImports,
  updateTsConfigPaths,
  updatePackagesConfigs,
  updatePackageJsonWorkspaces,
  generateManifests,
  generateBarrels,
  copyAssets,
} from "../../../../scripts/reorganize/execution.js";

export function registerApplyTool(server: McpServer): void {
  createZodTool(server, {
    name: "reorganize_apply",
    description:
      "DESTRUCTIVE: Execute the full file reorganization — moves files, rewrites imports, " +
      "updates configs. Writes output to a new directory (default: 'src-reorganized'). " +
      "Use reorganize_analyze first to preview changes.",
    schema: {
      src: z.string().optional().describe("Source directory (default: 'src')"),
      output: z.string().optional().describe("Output directory (default: 'src-reorganized')"),
      verify: z.boolean().optional().describe("Run tsc/eslint/vitest after apply (default: false)"),
    },
    handler: async ({ src, output, verify }) => {
      const outputDir = path.resolve(process.cwd(), output ?? "src-reorganized");
      const { project, plans, aliasMap, srcDir } = await runPipeline(src);

      // Clean and create output directory
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(outputDir, { recursive: true });

      // Build path mapping
      const pathMapping = new Map<string, string>();
      for (const p of plans) {
        const absNewPath = path.resolve(outputDir, p.targetRelPath);
        pathMapping.set(p.fileNode.absPath, absNewPath);
      }

      // Write reversible mapping
      const reversibleMapping: Record<string, string> = {};
      for (const [oldAbs, newAbs] of pathMapping.entries()) {
        reversibleMapping[path.relative(process.cwd(), oldAbs)] = path.relative(outputDir, newAbs);
      }
      await fs.writeFile(
        path.join(outputDir, ".mapping.json"),
        JSON.stringify(reversibleMapping, null, 2),
      );

      // Rewrite and write files
      let filesWritten = 0;
      for (const p of plans) {
        const absNewPath = path.resolve(outputDir, p.targetRelPath);
        await fs.mkdir(path.dirname(absNewPath), { recursive: true });

        const newContent = rewriteImports(
          project,
          p.fileNode.absPath,
          absNewPath,
          pathMapping,
          aliasMap,
          p.fileNode.packageName,
        );
        await fs.writeFile(absNewPath, newContent, "utf-8");
        filesWritten++;
      }

      // Post-processing
      await copyAssets(srcDir, outputDir, pathMapping);
      await generateBarrels(outputDir, plans);
      await updateTsConfigPaths(pathMapping, srcDir);
      await updatePackagesConfigs(pathMapping, srcDir);
      await updatePackageJsonWorkspaces(outputDir);
      await generateManifests(plans, outputDir);

      // Optional verification
      let verifyResult: string | undefined;
      if (verify) {
        try {
          execSync("npx tsc --noEmit", { stdio: "pipe" });
          execSync(`npx eslint ${output ?? "src-reorganized"}`, { stdio: "pipe" });
          verifyResult = "passed";
        } catch (e) {
          verifyResult = `failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      return jsonResult({
        filesWritten,
        outputDir,
        mappingFile: path.join(outputDir, ".mapping.json"),
        verifyResult,
      });
    },
  });
}
