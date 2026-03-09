import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult } from "@spike-land-ai/mcp-server-base";
import { runPipeline } from "./pipeline.js";

export function registerLintTool(server: McpServer): void {
  createZodTool(server, {
    name: "reorganize_lint",
    description:
      "Validate category constraints on the monorepo. " +
      "Currently checks that 'core' packages do not import react/react-dom. " +
      "Returns pass/fail with violation details.",
    schema: {
      src: z.string().optional().describe("Source directory (default: 'src')"),
    },
    handler: async ({ src }) => {
      const { nodes, packageCategories } = await runPipeline(src);

      const violations: Array<{ package: string; file: string; reason: string }> = [];

      for (const n of nodes) {
        const category = packageCategories.get(n.packageName);
        if (category === "core") {
          const frontendDeps = [...n.externalDeps].filter(
            (d) => d === "react" || d === "react-dom",
          );
          if (frontendDeps.length > 0) {
            violations.push({
              package: n.packageName,
              file: n.relPath,
              reason: `Core package imports frontend dependencies: ${frontendDeps.join(", ")}`,
            });
          }
        }
      }

      return jsonResult({
        passed: violations.length === 0,
        violationCount: violations.length,
        violations,
      });
    },
  });
}
