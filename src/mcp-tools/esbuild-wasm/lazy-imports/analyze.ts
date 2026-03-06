import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Metafile } from "esbuild-wasm";
import { z } from "zod";
import { getEsbuildWasm } from "../node-sys/wasm-api.js";
import { errorResult, formatEsbuildError, tryCatch } from "../mcp/errors.js";

const AnalyzeSchema = {
  metafile: z
    .string()
    .describe("JSON metafile string from esbuild_wasm_build (with metafile: true)"),
  verbose: z.boolean().optional().describe("Show all imports, not just top-level"),
};

export function registerAnalyzeTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_analyze_metafile",
    "Parse and display a bundle analysis metafile as human-readable text",
    AnalyzeSchema,
    async (args) => {
      const esbuild = await getEsbuildWasm();

      let metafile: Metafile;
      try {
        metafile = JSON.parse(args.metafile) as Metafile;
      } catch {
        return errorResult("INVALID_INPUT", "Invalid JSON in metafile");
      }

      const result = await tryCatch(esbuild.analyzeMetafile(metafile, { ...(args.verbose !== undefined && { verbose: args.verbose }) }));
      if (!result.ok) return formatEsbuildError(result.error);

      return {
        content: [
          {
            type: "text",
            text: result.data,
          },
        ],
      };
    },
  );
}
