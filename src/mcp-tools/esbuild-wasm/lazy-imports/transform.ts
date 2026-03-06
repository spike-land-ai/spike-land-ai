import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TransformOptions } from "esbuild-wasm";
import { getEsbuildWasm } from "../node-sys/wasm-api.js";
import { formatEsbuildError, tryCatch } from "../mcp/errors.js";
import { CommonSchema, prepareBuildOptions, TransformOnlySchema } from "../core-logic/schemas.js";

const TransformSchema = { ...TransformOnlySchema, ...CommonSchema };

export function registerTransformTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_transform",
    "Transform source code (TypeScript, JSX, CSS, etc.) to JavaScript or CSS using esbuild-wasm",
    TransformSchema,
    async (args) => {
      const esbuild = await getEsbuildWasm();

      const { code, ...rest } = prepareBuildOptions(args);
      const transformOpts: TransformOptions = {
        loader: "ts",
        ...(rest as TransformOptions),
      };

      const result = await tryCatch(esbuild.transform(code, transformOpts));
      if (!result.ok) return formatEsbuildError(result.error);

      const output: Record<string, unknown> = {
        code: result.data.code,
        warnings: result.data.warnings,
      };
      if (result.data.map) output.map = result.data.map;
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
