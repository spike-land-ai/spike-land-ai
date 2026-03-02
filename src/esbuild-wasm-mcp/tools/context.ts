import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BuildOptions } from "@spike-land-ai/esbuild-wasm";

import { getEsbuildWasm } from "../wasm-api.js";
import { tryCatch, formatEsbuildError } from "../errors.js";
import { BuildOnlySchema, CommonSchema, prepareBuildOptions } from "./schemas.js";

const ContextSchema = { ...BuildOnlySchema, ...CommonSchema };

export function registerContextTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_context",
    "Create an esbuild-wasm context for incremental builds. Returns the build result. The context is disposed after use.",
    ContextSchema,
    async (args) => {
      const esbuild = await getEsbuildWasm();

      const options: BuildOptions = {
        ...(prepareBuildOptions(args) as BuildOptions),
        bundle: args.bundle ?? true,
        write: args.write ?? false,
      };

      const ctxResult = await tryCatch(esbuild.context(options));
      if (!ctxResult.ok) return formatEsbuildError(ctxResult.error);

      const ctx = ctxResult.data;
      try {
        const rebuildResult = await tryCatch(ctx.rebuild());
        if (!rebuildResult.ok) return formatEsbuildError(rebuildResult.error);

        const output: Record<string, unknown> = {
          outputFiles: (rebuildResult.data.outputFiles ?? []).map((f) => ({
            path: f.path,
            text: f.text,
          })),
          warnings: rebuildResult.data.warnings,
          errors: rebuildResult.data.errors,
        };
        if (rebuildResult.data.mangleCache) output.mangleCache = rebuildResult.data.mangleCache;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      } finally {
        await ctx.dispose();
      }
    },
  );
}
