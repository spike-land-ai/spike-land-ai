import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { initializeWasm } from "../wasm-api.js";
import { tryCatch, errorResult } from "../errors.js";

const InitializeSchema = {
  wasmURL: z.string().optional().describe("URL to fetch the esbuild WASM binary from"),
  wasmModule: z
    .string()
    .optional()
    .describe("File path to a local .wasm file (will be compiled via WebAssembly.compile)"),
  worker: z.boolean().optional().describe("Run esbuild in a Web Worker (default: false)"),
};

export function registerInitializeTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_initialize",
    "Initialize (or re-initialize) the esbuild-wasm engine with custom options: wasmURL, wasmModule file path, or worker mode",
    InitializeSchema,
    async (args) => {
      const result = await tryCatch(initializeWasm(args));
      if (!result.ok) return errorResult("INIT_FAILED", result.error.message, true);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );
}
