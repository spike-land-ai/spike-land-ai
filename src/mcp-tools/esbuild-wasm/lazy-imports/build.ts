import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BuildOptions } from "esbuild-wasm";

import { getEsbuildWasm } from "../node-sys/wasm-api.js";
import { formatEsbuildError, tryCatch } from "../mcp/errors.js";
import { BuildOnlySchema, CommonSchema, prepareBuildOptions } from "../core-logic/schemas.js";

const BuildSchema = { ...BuildOnlySchema, ...CommonSchema };

export function registerBuildTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_build",
    "Bundle entry point files using esbuild-wasm. Returns output contents in memory (does not write to disk by default).",
    BuildSchema,
    async (args) => {
      const esbuild = await getEsbuildWasm();

      const options: BuildOptions = {
        ...(prepareBuildOptions(args) as BuildOptions),
        bundle: args.bundle ?? true,
        write: args.write ?? false,
      };

      const result = await tryCatch(esbuild.build(options));
      if (!result.ok) return formatEsbuildError(result.error);

      const output: Record<string, unknown> = {
        outputFiles: (result.data.outputFiles ?? []).map((f) => ({
          path: f.path,
          text: f.text,
        })),
        warnings: result.data.warnings,
        errors: result.data.errors,
      };
      if (result.data.metafile) output.metafile = result.data.metafile;
      if (result.data.mangleCache) output.mangleCache = result.data.mangleCache;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    },
  );
}
