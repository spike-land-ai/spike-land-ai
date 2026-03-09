import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult, formatError } from "@spike-land-ai/mcp-server-base";
import { runPipeline } from "./pipeline.js";

export function registerDiscoverTool(server: McpServer): void {
  createZodTool(server, {
    name: "reorganize_discover",
    description:
      "Parse all TypeScript files in src/, extract imports, build dependency graph, and compute package categories. " +
      "Returns file count, package list with categories and dependency info.",
    schema: {
      src: z.string().optional().describe("Source directory (default: 'src')"),
      incremental: z.boolean().optional().describe("Only process git-changed files (default: false)"),
    },
    handler: async ({ src, incremental }) => {
      const { nodes, packageCategories } = await runPipeline(src, incremental ?? false);

      const byPackage = new Map<string, { fileCount: number; externalDeps: Set<string> }>();
      for (const n of nodes) {
        let entry = byPackage.get(n.packageName);
        if (!entry) {
          entry = { fileCount: 0, externalDeps: new Set() };
          byPackage.set(n.packageName, entry);
        }
        entry.fileCount++;
        for (const dep of n.externalDeps) {
          entry.externalDeps.add(dep);
        }
      }

      const packages = [...byPackage.entries()].map(([name, info]) => ({
        name,
        category: packageCategories.get(name) ?? "unknown",
        fileCount: info.fileCount,
        externalDeps: [...info.externalDeps].sort(),
      }));

      return jsonResult({
        fileCount: nodes.length,
        packageCount: packages.length,
        packages: packages.sort((a, b) => b.fileCount - a.fileCount),
      });
    },
  });
}
