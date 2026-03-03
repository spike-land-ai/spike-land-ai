/**
 * esbuild / esbuild-wasm MCP Tools
 *
 * Transpile, bundle, validate, and parse errors for TSX/JSX/TS/JS code
 * using the platform's esbuild-wasm integration.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { jsonResult, safeToolCall, textResult } from "./tool-helpers";

const LOADER_ENUM = ["tsx", "ts", "jsx", "js"] as const;

const TranspileSchema = z.object({
  code: z.string().min(1).describe("Source code to transpile."),
  loader: z.enum(LOADER_ENUM).optional().default("tsx").describe(
    "Source language loader.",
  ),
  minify: z.boolean().optional().default(false).describe(
    "Whether to minify the output.",
  ),
  jsx_import_source: z.string().optional().default("@emotion/react").describe(
    "JSX import source for automatic JSX runtime.",
  ),
  target: z.string().optional().default("es2024").describe(
    "JavaScript target version.",
  ),
});

const BundleSchema = z.object({
  codespace_id: z.string().min(1).describe("Codespace identifier to bundle."),
});

const ValidateSchema = z.object({
  code: z.string().min(1).describe("Source code to syntax-check."),
  loader: z.enum(LOADER_ENUM).optional().default("tsx").describe(
    "Source language loader.",
  ),
});

const ParseErrorsSchema = z.object({
  error_text: z.string().min(1).describe("Raw esbuild error text to parse."),
});

export function registerEsbuildTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // --- esbuild_transpile ---
  registry.register({
    name: "esbuild_transpile",
    description: "Transpile TSX/JSX/TS/JS code to browser-ready ESM JavaScript using esbuild-wasm.",
    category: "esbuild",
    tier: "free",
    inputSchema: TranspileSchema.shape,
    handler: async ({
      code,
      loader = "tsx",
      minify = false,
      jsx_import_source = "@emotion/react",
      target = "es2024",
    }: z.infer<typeof TranspileSchema>): Promise<CallToolResult> =>
      safeToolCall("esbuild_transpile", async () => {
        const { ensureEsbuildReady } = await import(
          "@/lib/codespace/esbuild-init"
        );
        await ensureEsbuildReady();
        const { transform } = await import("@spike-land-ai/esbuild-wasm");

        const result = await transform(code, {
          loader,
          format: "esm",
          treeShaking: true,
          platform: "browser",
          minify,
          charset: "utf8",
          keepNames: true,
          tsconfigRaw: {
            compilerOptions: {
              jsx: "react-jsx",
              jsxFragmentFactory: "Fragment",
              jsxImportSource: jsx_import_source,
            },
          },
          target,
        });

        const warnings = result.warnings.length > 0
          ? `\n\n**Warnings (${result.warnings.length}):**\n${
            result.warnings.map(w => `- ${w.text}`).join("\n")
          }`
          : "";

        return textResult(
          `**Transpiled** (${loader} → esm, target=${target}, minify=${minify})${warnings}\n\n\`\`\`js\n${result.code}\`\`\``,
        );
      }, { userId }),
  });

  // --- esbuild_bundle ---
  registry.register({
    name: "esbuild_bundle",
    description:
      "Bundle a codespace's transpiled code into a self-contained IIFE with all dependencies resolved.",
    category: "esbuild",
    tier: "free",
    inputSchema: BundleSchema.shape,
    handler: async ({
      codespace_id,
    }: z.infer<typeof BundleSchema>): Promise<CallToolResult> =>
      safeToolCall("esbuild_bundle", async () => {
        const { bundleCodespace } = await import("@/lib/codespace/bundler");

        const result = await bundleCodespace({
          transpiled: "",
          codeSpace: codespace_id,
        });

        const jsSize = new Blob([result.js]).size;
        const cssSize = new Blob([result.css]).size;

        return jsonResult(
          `**Bundled** codespace \`${codespace_id}\`\n- JS: ${
            (jsSize / 1024).toFixed(1)
          } KB\n- CSS: ${(cssSize / 1024).toFixed(1)} KB`,
          {
            js_size: jsSize,
            css_size: cssSize,
            has_css: result.css.length > 0,
          },
        );
      }, { userId }),
  });

  // --- esbuild_validate ---
  registry.register({
    name: "esbuild_validate",
    description: "Syntax-check TSX/JSX/TS/JS code without producing output — fast validation.",
    category: "esbuild",
    tier: "free",
    inputSchema: ValidateSchema.shape,
    handler: async ({
      code,
      loader = "tsx",
    }: z.infer<typeof ValidateSchema>): Promise<CallToolResult> =>
      safeToolCall("esbuild_validate", async () => {
        const { ensureEsbuildReady } = await import(
          "@/lib/codespace/esbuild-init"
        );
        await ensureEsbuildReady();
        const { transform } = await import("@spike-land-ai/esbuild-wasm");

        try {
          await transform(code, { loader });
          return textResult("**Valid** — no syntax errors found.");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const { parseTranspileErrors } = await import(
            "@/lib/codespace/transpile"
          );
          const errors = parseTranspileErrors(message);
          return jsonResult(
            `**Invalid** — ${errors.length} error(s) found.`,
            errors,
          );
        }
      }, { userId }),
  });

  // --- esbuild_parse_errors ---
  registry.register({
    name: "esbuild_parse_errors",
    description: "Parse raw esbuild error text into structured line/column/message objects.",
    category: "esbuild",
    tier: "free",
    inputSchema: ParseErrorsSchema.shape,
    handler: async ({
      error_text,
    }: z.infer<typeof ParseErrorsSchema>): Promise<CallToolResult> =>
      safeToolCall("esbuild_parse_errors", async () => {
        const { parseTranspileErrors } = await import(
          "@/lib/codespace/transpile"
        );
        const errors = parseTranspileErrors(error_text);

        return jsonResult(
          `**Parsed** ${errors.length} error(s) from esbuild output.`,
          errors,
        );
      }, { userId }),
  });

  // --- esbuild_info ---
  registry.register({
    name: "esbuild_info",
    description: "Return esbuild-wasm version and initialization status.",
    category: "esbuild",
    tier: "free",
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("esbuild_info", async () => {
        const esbuild = await import("@spike-land-ai/esbuild-wasm");
        const { ensureEsbuildReady } = await import(
          "@/lib/codespace/esbuild-init"
        );

        let initStatus = "not_initialized";
        try {
          await ensureEsbuildReady();
          initStatus = "ready";
        } catch {
          initStatus = "init_failed";
        }

        return jsonResult(
          `**esbuild-wasm** v${esbuild.version} — status: ${initStatus}`,
          {
            version: esbuild.version,
            status: initStatus,
            supported_loaders: ["tsx", "ts", "jsx", "js", "css", "json"],
            supported_targets: ["es2020", "es2022", "es2024", "esnext"],
          },
        );
      }, { userId }),
  });
}
