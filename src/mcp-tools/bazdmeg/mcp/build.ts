/**
 * Build & Typecheck Tools
 *
 * MCP tools for running esbuild bundling and TypeScript type checking
 * against packages defined in packages.yaml.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import { BuildSchema, TypecheckSchema } from "../core-logic/types.js";
import { getManifestPackage, readManifest } from "../node-sys/manifest.js";
import { hasScript, runCommand } from "../node-sys/shell.js";

export function registerBuildTools(server: McpServer): void {
  // ── bazdmeg_build ─────────────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_build",
    description:
      "Run esbuild bundling for a package. Reads packages.yaml to determine build profile.",
    schema: BuildSchema.shape,
    handler: async ({ packageName, kind: kindOverride }) => {

      const repoRoot = process.cwd();
      const pkgDir = `${repoRoot}/src/${packageName}`;

      // Read manifest to get build profile
      const pkg = await getManifestPackage(packageName, repoRoot);
      const kind = kindOverride ?? pkg?.kind ?? "library";

      let report = `## Build Report — ${packageName}\n\n`;
      report += `**Kind**: ${kind}\n`;
      report += `**Entry**: ${pkg?.entry ?? "src/index.ts"}\n\n`;

      const start = Date.now();

      // Check if package has its own build script first
      const hasBuildScript = await hasScript(pkgDir, "build");
      let result;

      if (hasBuildScript) {
        report += "Using package `build` script.\n\n";
        result = await runCommand("npm", ["run", "build"], pkgDir);
      } else {
        report += "Using esbuild config: `npx tsx esbuild.config.ts`\n\n";
        result = await runCommand("npx", ["tsx", "esbuild.config.ts", packageName], repoRoot);
      }

      const durationMs = Date.now() - start;
      report += `**Duration**: ${(durationMs / 1000).toFixed(1)}s\n`;

      if (result.ok) {
        report += `**Status**: SUCCESS\n`;
        if (result.stdout.trim()) {
          report += `\n\`\`\`\n${result.stdout.trim().slice(0, 2000)}\n\`\`\``;
        }
      } else {
        report += `**Status**: FAILED\n`;
        const output = (result.stderr || result.stdout).trim();
        report += `\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``;
      }

      return textResult(report);
    },
  });

  // ── bazdmeg_typecheck ─────────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_typecheck",
    description:
      "Run tsc --noEmit with per-package filtering. Omit packageName to typecheck all packages.",
    schema: TypecheckSchema.shape,
    handler: async ({ packageName }) => {
      const repoRoot = process.cwd();

      if (!packageName) {
        // Typecheck all packages
        const manifest = await readManifest(repoRoot);
        const packages = Object.keys(manifest.packages);
        let report = `## Typecheck Report — All Packages\n\n`;
        report += `| Package | Status | Duration |\n`;
        report += `|---------|--------|----------|\n`;

        let allPassed = true;
        for (const name of packages) {
          const pkgDir = `${repoRoot}/packages/${name}`;
          const has = await hasScript(pkgDir, "typecheck");
          if (!has) {
            report += `| ${name} | skip | — |\n`;
            continue;
          }

          const start = Date.now();
          const result = await runCommand("npm", ["run", "typecheck"], pkgDir);
          const dur = ((Date.now() - start) / 1000).toFixed(1);

          if (result.ok) {
            report += `| ${name} | pass | ${dur}s |\n`;
          } else {
            allPassed = false;
            report += `| ${name} | FAIL | ${dur}s |\n`;
          }
        }

        report += `\n**Overall**: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`;
        return textResult(report);
      }

      // Single package typecheck
      const pkgDir = `${repoRoot}/src/${packageName}`;
      const has = await hasScript(pkgDir, "typecheck");

      let report = `## Typecheck Report — ${packageName}\n\n`;

      if (has) {
        const start = Date.now();
        const result = await runCommand("npm", ["run", "typecheck"], pkgDir);
        const dur = ((Date.now() - start) / 1000).toFixed(1);

        report += `**Duration**: ${dur}s\n`;
        if (result.ok) {
          report += `**Status**: PASS\n`;
        } else {
          report += `**Status**: FAIL\n`;
          const output = (result.stderr || result.stdout).trim();
          report += `\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``;
        }
      } else {
        // Fallback: run tsc directly
        const start = Date.now();
        const result = await runCommand("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], pkgDir);
        const dur = ((Date.now() - start) / 1000).toFixed(1);

        report += `**Duration**: ${dur}s\n`;
        if (result.ok) {
          report += `**Status**: PASS (direct tsc)\n`;
        } else {
          report += `**Status**: FAIL (direct tsc)\n`;
          const output = (result.stderr || result.stdout).trim();
          report += `\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``;
        }
      }

      return textResult(report);
    },
  });
}
