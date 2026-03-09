import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult } from "@spike-land-ai/mcp-server-base";
import { runPipeline } from "./pipeline.js";

export function registerAnalyzeTool(server: McpServer): void {
  createZodTool(server, {
    name: "reorganize_analyze",
    description:
      "Compute move plans for file reorganization. " +
      "In 'summary' mode, returns category breakdown and top directories. " +
      "In 'diff' mode, returns the full old-path → new-path mapping.",
    schema: {
      src: z.string().optional().describe("Source directory (default: 'src')"),
      mode: z
        .enum(["summary", "diff"])
        .optional()
        .describe("Output mode: 'summary' (default) or 'diff' for full path mapping"),
    },
    handler: async ({ src, mode }) => {
      const { plans } = await runPipeline(src);
      const outputMode = mode ?? "summary";

      if (outputMode === "diff") {
        const mappings = plans.map((p) => ({
          oldPath: p.fileNode.relPath,
          newPath: p.targetRelPath,
        }));
        return jsonResult({ total: plans.length, plans: mappings });
      }

      // Summary mode
      const catStats = new Map<string, number>();
      const dirStats = new Map<string, number>();

      for (const p of plans) {
        const cat = p.targetDir.split(path.sep)[0];
        catStats.set(cat!, (catStats.get(cat!) || 0) + 1);
        dirStats.set(p.targetDir, (dirStats.get(p.targetDir) || 0) + 1);
      }

      const categories = [...catStats.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          pct: Number(((count / plans.length) * 100).toFixed(1)),
        }));

      const topDirs = [...dirStats.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([dir, count]) => ({ dir, count }));

      return jsonResult({
        totalFiles: plans.length,
        categories,
        topDirs,
      });
    },
  });
}
