/**
 * esbuild / esbuild-wasm MCP Tools (CF Workers)
 *
 * Transpile, bundle, validate, and parse errors for TSX/JSX/TS/JS code.
 * Delegates to spike.land API for actual esbuild operations since
 * esbuild-wasm requires browser/Node init that doesn't run in CF Workers.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, jsonResult, safeToolCall, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

const LOADER_ENUM = ["tsx", "ts", "jsx", "js"] as const;

export function registerEsbuildTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // --- esbuild_transpile ---
  registry.registerBuilt(
    t
      .tool(
        "esbuild_transpile",
        "Transpile TSX/JSX/TS/JS code to browser-ready ESM JavaScript via spike.land esbuild-wasm.",
        {
          code: z.string().min(1).describe("Source code to transpile."),
          loader: z.enum(LOADER_ENUM).optional().default("tsx").describe("Source language loader."),
          minify: z.boolean().optional().default(false).describe("Whether to minify the output."),
          jsx_import_source: z
            .string()
            .optional()
            .default("@emotion/react")
            .describe("JSX import source for automatic JSX runtime."),
          target: z.string().optional().default("es2024").describe("JavaScript target version."),
        },
      )
      .meta({ category: "esbuild", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("esbuild_transpile", async () => {
          const result = await apiRequest<{
            code: string;
            warnings: Array<{ text: string }>;
          }>("/api/esbuild/transpile", {
            method: "POST",
            body: JSON.stringify({
              code: input.code,
              loader: input.loader,
              minify: input.minify,
              jsx_import_source: input.jsx_import_source,
              target: input.target,
            }),
          });

          const warnings =
            result.warnings.length > 0
              ? `\n\n**Warnings (${result.warnings.length}):**\n${result.warnings
                  .map((w) => `- ${w.text}`)
                  .join("\n")}`
              : "";

          return textResult(
            `**Transpiled** (${input.loader} → esm, target=${input.target}, minify=${input.minify})${warnings}\n\n\`\`\`js\n${result.code}\`\`\``,
          );
        });
      }),
  );

  // --- esbuild_validate ---
  registry.registerBuilt(
    t
      .tool(
        "esbuild_validate",
        "Syntax-check TSX/JSX/TS/JS code without producing output — fast validation.",
        {
          code: z.string().min(1).describe("Source code to syntax-check."),
          loader: z.enum(LOADER_ENUM).optional().default("tsx").describe("Source language loader."),
        },
      )
      .meta({ category: "esbuild", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("esbuild_validate", async () => {
          const result = await apiRequest<{
            valid: boolean;
            errors?: Array<{ text: string; line?: number; column?: number }>;
          }>("/api/esbuild/validate", {
            method: "POST",
            body: JSON.stringify({
              code: input.code,
              loader: input.loader,
            }),
          });

          if (result.valid) {
            return textResult("**Valid** — no syntax errors found.");
          }

          return jsonResult(
            `**Invalid** — ${(result.errors ?? []).length} error(s) found.`,
            result.errors ?? [],
          );
        });
      }),
  );

  // --- esbuild_parse_errors ---
  registry.registerBuilt(
    t
      .tool(
        "esbuild_parse_errors",
        "Parse raw esbuild error text into structured line/column/message objects.",
        {
          error_text: z.string().min(1).describe("Raw esbuild error text to parse."),
        },
      )
      .meta({ category: "esbuild", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("esbuild_parse_errors", async () => {
          // Simple error text parser for esbuild output
          const lines = input.error_text.split("\n");
          const errors: Array<{ line?: number; column?: number; text: string }> = [];
          const errorPattern = /^.*:(\d+):(\d+):\s*error:\s*(.+)$/;

          for (const line of lines) {
            const match = line.match(errorPattern);
            if (match) {
              errors.push({
                line: parseInt(match[1]!, 10),
                column: parseInt(match[2]!, 10),
                text: match[3]!,
              });
            } else if (line.startsWith("error:") || line.includes("ERROR:")) {
              errors.push({ text: line.trim() });
            }
          }

          if (errors.length === 0) {
            errors.push({ text: input.error_text.trim() });
          }

          return jsonResult(`**Parsed** ${errors.length} error(s) from esbuild output.`, errors);
        });
      }),
  );

  // --- esbuild_info ---
  registry.registerBuilt(
    t
      .tool("esbuild_info", "Return esbuild-wasm version and runtime info.", {})
      .meta({ category: "esbuild", tier: "free" })
      .handler(async () => {
        return safeToolCall("esbuild_info", async () => {
          return jsonResult("**esbuild-wasm** — available via spike.land API", {
            runtime: "cloudflare-workers-proxy",
            supported_loaders: ["tsx", "ts", "jsx", "js", "css", "json"],
            supported_targets: ["es2020", "es2022", "es2024", "esnext"],
            note: "Transpilation is proxied through spike.land API",
          });
        });
      }),
  );
}
