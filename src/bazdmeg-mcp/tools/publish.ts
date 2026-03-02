/**
 * Publish Tools
 *
 * MCP tools for generating package.json and publishing packages to npm registries.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, formatError } from "@spike-land-ai/mcp-server-base";
import { GeneratePackageJsonSchema, PublishNpmSchema } from "../types.js";
import { getManifestPackage, readManifest } from "../manifest.js";
import { runCommand } from "../shell.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

interface GeneratedPackageJson {
  name: string;
  version: string;
  description: string;
  type: string;
  license: string;
  main?: string;
  types?: string;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  publishConfig?: { registry: string };
}

function buildPackageJson(
  packageName: string,
  pkg: { kind: string; version: string; description: string; entry: string; deps?: string[]; bin?: string; binName?: string; exports?: Record<string, string>; type?: string; private?: boolean },
  defaults: { scope: string; registry: string; license: string; type: string },
): GeneratedPackageJson {
  const fullName = `${defaults.scope}/${packageName}`;
  const result: GeneratedPackageJson = {
    name: fullName,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type ?? defaults.type,
    license: defaults.license,
  };

  // Set main/types based on kind
  switch (pkg.kind) {
    case "library":
      result.main = "./dist/index.js";
      result.types = "./dist/index.d.ts";
      result.exports = {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      };
      break;
    case "mcp-server":
    case "cli":
      result.main = "./dist/index.js";
      result.types = "./dist/index.d.ts";
      if (pkg.bin) {
        const binName = pkg.binName ?? packageName;
        result.bin = { [binName]: pkg.bin };
      }
      break;
    case "worker":
      result.main = "./dist/index.js";
      break;
    case "browser":
      result.main = "./dist/index.js";
      result.types = "./dist/index.d.ts";
      break;
  }

  // Override exports if specified in manifest
  if (pkg.exports) {
    result.exports = {};
    for (const [key, value] of Object.entries(pkg.exports)) {
      result.exports[key] = {
        import: value,
        types: value.replace(/\.js$/, ".d.ts"),
      };
    }
  }

  // Map internal deps
  if (pkg.deps && pkg.deps.length > 0) {
    result.dependencies = {};
    for (const dep of pkg.deps) {
      result.dependencies[`${defaults.scope}/${dep}`] = "workspace:*";
    }
  }

  result.publishConfig = {
    registry: `https://${defaults.registry}`,
  };

  return result;
}

export function registerPublishTools(server: McpServer): void {
  // ── bazdmeg_generate_package_json ─────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_generate_package_json",
    "Generate a valid package.json from packages.yaml entry for npm publishing.",
    GeneratePackageJsonSchema.shape,
    async (args) => {
      try {
        const { packageName, dryRun = true } = args as {
          packageName: string;
          dryRun?: boolean;
        };

        const repoRoot = process.cwd();
        const manifest = await readManifest(repoRoot);
        const pkg = manifest.packages[packageName];

        if (!pkg) {
          return textResult(
            `**ERROR**: Package \`${packageName}\` not found in packages.yaml.`,
          );
        }

        const generated = buildPackageJson(packageName, pkg, manifest.defaults);
        const json = JSON.stringify(generated, null, 2);

        if (!dryRun) {
          const outPath = join(repoRoot, "packages", packageName, "package.json");
          await writeFile(outPath, json + "\n", "utf-8");
          return textResult(
            `## Generated package.json — ${packageName}\n\nWritten to \`${outPath}\`\n\n\`\`\`json\n${json}\n\`\`\``,
          );
        }

        return textResult(
          `## Generated package.json — ${packageName} (dry run)\n\n\`\`\`json\n${json}\n\`\`\``,
        );
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_publish_npm ───────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_publish_npm",
    "Build + generate package.json + npm publish. Full publishing pipeline.",
    PublishNpmSchema.shape,
    async (args) => {
      try {
        const {
          packageName,
          registry = "github",
          dryRun = true,
        } = args as {
          packageName: string;
          registry?: string;
          dryRun?: boolean;
        };

        const repoRoot = process.cwd();
        const manifest = await readManifest(repoRoot);
        const pkg = manifest.packages[packageName];

        if (!pkg) {
          return textResult(
            `**ERROR**: Package \`${packageName}\` not found in packages.yaml.`,
          );
        }

        let report = `## Publish Pipeline — ${packageName}\n\n`;
        report += `**Registry**: ${registry}\n`;
        report += `**Version**: ${pkg.version}\n`;
        report += `**Dry Run**: ${dryRun}\n\n`;

        const pkgDir = `${repoRoot}/packages/${packageName}`;

        // Step 1: Build
        report += `### 1. Build\n`;
        const buildStart = Date.now();
        const buildResult = await runCommand("npm", ["run", "build"], pkgDir);
        const buildDur = ((Date.now() - buildStart) / 1000).toFixed(1);

        if (!buildResult.ok) {
          report += `**FAILED** (${buildDur}s)\n`;
          report += `\`\`\`\n${(buildResult.stderr || buildResult.stdout).trim().slice(0, 1000)}\n\`\`\`\n`;
          report += `\n**BLOCKED** at build step.`;
          return textResult(report);
        }
        report += `PASS (${buildDur}s)\n\n`;

        // Step 2: Generate package.json
        report += `### 2. Generate package.json\n`;
        const generated = buildPackageJson(packageName, pkg, manifest.defaults);
        const json = JSON.stringify(generated, null, 2);
        report += `\`\`\`json\n${json}\n\`\`\`\n\n`;

        if (dryRun) {
          report += `### 3. Publish (skipped — dry run)\n`;
          report += `Would run: \`npm publish --registry https://${registry === "github" ? "npm.pkg.github.com" : "registry.npmjs.org"}\`\n`;
          return textResult(report);
        }

        // Write package.json
        const outPath = join(pkgDir, "package.json");
        await writeFile(outPath, json + "\n", "utf-8");

        // Step 3: Publish
        report += `### 3. Publish\n`;
        const registryUrl = registry === "github" ? "https://npm.pkg.github.com" : "https://registry.npmjs.org";
        const publishStart = Date.now();
        const publishResult = await runCommand(
          "npm",
          ["publish", "--registry", registryUrl],
          pkgDir,
        );
        const publishDur = ((Date.now() - publishStart) / 1000).toFixed(1);

        if (publishResult.ok) {
          report += `**PUBLISHED** (${publishDur}s)\n`;
        } else {
          report += `**FAILED** (${publishDur}s)\n`;
          report += `\`\`\`\n${(publishResult.stderr || publishResult.stdout).trim().slice(0, 1000)}\n\`\`\``;
        }

        return textResult(report);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
