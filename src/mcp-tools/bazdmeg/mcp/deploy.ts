/**
 * Deploy Tools
 *
 * MCP tools for generating wrangler.toml and deploying Cloudflare Workers.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import { DeployWorkerSchema, GenerateWranglerTomlSchema } from "../core-logic/types.js";
import type { z } from "zod";
import { getManifestPackage } from "../node-sys/manifest.js";
import { runCommand } from "../node-sys/shell.js";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ManifestWorkerConfig } from "../node-sys/manifest.js";

function generateToml(_packageName: string, worker: ManifestWorkerConfig, entry?: string): string {
  const lines: string[] = [];

  lines.push(`name = "${worker.name}"`);
  lines.push(`main = "${worker.entry ?? entry ?? "src/index.ts"}"`);
  lines.push(`compatibility_date = "${worker.compatibility_date}"`);

  if (worker.compatibility_flags && worker.compatibility_flags.length > 0) {
    const flags = worker.compatibility_flags.map((f) => `"${f}"`).join(", ");
    lines.push(`compatibility_flags = [${flags}]`);
  }

  lines.push("");

  // KV namespaces
  if (worker.kv_namespaces && worker.kv_namespaces.length > 0) {
    for (const kv of worker.kv_namespaces) {
      lines.push(`[[kv_namespaces]]`);
      lines.push(`binding = "${kv.binding}"`);
      lines.push(`id = "${kv.id}"`);
      lines.push("");
    }
  }

  // D1 databases
  if (worker.d1_databases && worker.d1_databases.length > 0) {
    for (const d1 of worker.d1_databases) {
      lines.push(`[[d1_databases]]`);
      lines.push(`binding = "${d1.binding}"`);
      lines.push(`database_name = "${d1.database_name}"`);
      lines.push(`database_id = "${d1.database_id}"`);
      lines.push("");
    }
  }

  // R2 buckets
  if (worker.r2_buckets && worker.r2_buckets.length > 0) {
    for (const r2 of worker.r2_buckets) {
      lines.push(`[[r2_buckets]]`);
      lines.push(`binding = "${r2.binding}"`);
      lines.push(`bucket_name = "${r2.bucket_name}"`);
      lines.push("");
    }
  }

  // Durable Objects
  if (worker.durable_objects && worker.durable_objects.length > 0) {
    lines.push(`[durable_objects]`);
    lines.push(`bindings = [`);
    for (const dobj of worker.durable_objects) {
      const sqliteStr = dobj.sqlite ? `, sqlite = true` : "";
      lines.push(`  { name = "${dobj.name}", class_name = "${dobj.class_name}"${sqliteStr} },`);
    }
    lines.push(`]`);
    lines.push("");
  }

  // Routes
  if (worker.routes && worker.routes.length > 0) {
    for (const route of worker.routes) {
      lines.push(`[[routes]]`);
      lines.push(`pattern = "${route.pattern}"`);
      if (route.custom_domain) lines.push(`custom_domain = true`);
      if (route.zone_name) lines.push(`zone_name = "${route.zone_name}"`);
      lines.push("");
    }
  }

  // Rules
  if (worker.rules && worker.rules.length > 0) {
    for (const rule of worker.rules) {
      lines.push(`[[rules]]`);
      lines.push(`type = "${rule.type}"`);
      const globs = rule.globs.map((g) => `"${g}"`).join(", ");
      lines.push(`globs = [${globs}]`);
      lines.push("");
    }
  }

  // Assets
  if (worker.assets) {
    lines.push(`[assets]`);
    lines.push(`directory = "${worker.assets.directory}"`);
    if (worker.assets.not_found_handling) {
      lines.push(`not_found_handling = "${worker.assets.not_found_handling}"`);
    }
    lines.push("");
  }

  // Site
  if (worker.site) {
    lines.push(`[site]`);
    lines.push(`bucket = "${worker.site.bucket}"`);
    lines.push("");
  }

  return lines.join("\n");
}

export function registerDeployTools(server: McpServer): void {
  // ── bazdmeg_generate_wrangler_toml ────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_generate_wrangler_toml",
    description: "Generate wrangler.toml from packages.yaml worker section.",
    schema: GenerateWranglerTomlSchema.shape,
    handler: async ({ packageName, dryRun = true }: z.infer<typeof GenerateWranglerTomlSchema>) => {
      const repoRoot = process.cwd();
      const pkg = await getManifestPackage(packageName, repoRoot);

      if (!pkg) {
        return textResult(`**ERROR**: Package \`${packageName}\` not found in packages.yaml.`);
      }

      if (!pkg.worker) {
        return textResult(
          `**ERROR**: Package \`${packageName}\` does not have a \`worker\` section in packages.yaml.`,
        );
      }

      const toml = generateToml(packageName, pkg.worker, pkg.entry);

      if (!dryRun) {
        const outDir = existsSync(join(repoRoot, "src", packageName))
          ? join(repoRoot, "src", packageName)
          : join(repoRoot, "packages", packageName);
        const outPath = join(outDir, "wrangler.toml");
        await writeFile(outPath, toml + "\n", "utf-8");
        return textResult(
          `## Generated wrangler.toml — ${packageName}\n\nWritten to \`${outPath}\`\n\n\`\`\`toml\n${toml}\n\`\`\``,
        );
      }

      return textResult(
        `## Generated wrangler.toml — ${packageName} (dry run)\n\n\`\`\`toml\n${toml}\n\`\`\``,
      );
    },
  });

  // ── bazdmeg_deploy_worker ─────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_deploy_worker",
    description:
      "Build + generate wrangler.toml + wrangler deploy. Full deploy pipeline for workers.",
    schema: DeployWorkerSchema.shape,
    handler: async ({ packageName, env, dryRun = true }: z.infer<typeof DeployWorkerSchema>) => {

      const repoRoot = process.cwd();
      const pkg = await getManifestPackage(packageName, repoRoot);

      if (!pkg) {
        return textResult(`**ERROR**: Package \`${packageName}\` not found in packages.yaml.`);
      }

      if (!pkg.worker) {
        return textResult(
          `**ERROR**: Package \`${packageName}\` does not have a \`worker\` section. Cannot deploy.`,
        );
      }

      const pkgDir = existsSync(join(repoRoot, "src", packageName))
        ? join(repoRoot, "src", packageName)
        : join(repoRoot, "packages", packageName);
      let report = `## Deploy Pipeline — ${packageName}\n\n`;
      report += `**Worker Name**: ${pkg.worker.name}\n`;
      report += `**Package Dir**: ${pkgDir}\n`;
      report += `**Environment**: ${env ?? "default"}\n`;
      report += `**Dry Run**: ${dryRun}\n\n`;

      // Step 1: Build (skip for src/ packages that don't have package.json with build script)
      const hasBuildScript = existsSync(join(pkgDir, "package.json"));
      if (hasBuildScript) {
        report += `### 1. Build\n`;
        const buildStart = Date.now();
        const buildResult = await runCommand("npm", ["run", "build"], pkgDir);
        const buildDur = ((Date.now() - buildStart) / 1000).toFixed(1);

        if (!buildResult.ok) {
          report += `**FAILED** (${buildDur}s)\n`;
          report += `\`\`\`\n${(buildResult.stderr || buildResult.stdout)
            .trim()
            .slice(0, 1000)}\n\`\`\`\n`;
          report += `\n**BLOCKED** at build step.`;
          return textResult(report);
        }
        report += `PASS (${buildDur}s)\n\n`;
      } else {
        report += `### 1. Build (skipped — no package.json)\n\n`;
      }

      // Step 1.5: Frontend build (if assets directory references frontend/)
      if (pkg.worker.assets?.directory?.includes("frontend/")) {
        const frontendDir = join(pkgDir, "frontend");
        if (existsSync(frontendDir)) {
          report += `### 1.5. Frontend Build\n`;
          // Install frontend deps if needed
          if (!existsSync(join(frontendDir, "node_modules"))) {
            const installResult = await runCommand("npm", ["install"], frontendDir);
            if (!installResult.ok) {
              report += `**npm install FAILED**\n`;
              report += `\`\`\`\n${(installResult.stderr || installResult.stdout)
                .trim()
                .slice(0, 1000)}\n\`\`\`\n`;
              report += `\n**BLOCKED** at frontend install step.`;
              return textResult(report);
            }
          }
          const viteBuildStart = Date.now();
          const viteBuild = await runCommand("npx", ["vite", "build"], frontendDir);
          const viteDur = ((Date.now() - viteBuildStart) / 1000).toFixed(1);

          if (!viteBuild.ok) {
            report += `**FAILED** (${viteDur}s)\n`;
            report += `\`\`\`\n${(viteBuild.stderr || viteBuild.stdout)
              .trim()
              .slice(0, 1000)}\n\`\`\`\n`;
            report += `\n**BLOCKED** at frontend build step.`;
            return textResult(report);
          }
          report += `PASS (${viteDur}s)\n\n`;
        }
      }

      // Step 2: Generate wrangler.toml
      report += `### 2. Generate wrangler.toml\n`;
      const toml = generateToml(packageName, pkg.worker, pkg.entry);
      const tomlPath = join(pkgDir, "wrangler.toml");
      await writeFile(tomlPath, toml + "\n", "utf-8");
      report += `Written to \`${tomlPath}\`\n\n`;

      if (dryRun) {
        report += `### 3. Deploy (skipped — dry run)\n`;
        const deployArgs = ["wrangler", "deploy"];
        if (env) deployArgs.push("--env", env);
        report += `Would run: \`npx ${deployArgs.join(" ")}\`\n`;
        return textResult(report);
      }

      // Step 3: Deploy
      report += `### 3. Deploy\n`;
      const deployArgs = ["wrangler", "deploy"];
      if (env) deployArgs.push("--env", env);

      const deployStart = Date.now();
      const deployResult = await runCommand("npx", deployArgs, pkgDir);
      const deployDur = ((Date.now() - deployStart) / 1000).toFixed(1);

      if (deployResult.ok) {
        report += `**DEPLOYED** (${deployDur}s)\n`;
        if (deployResult.stdout.trim()) {
          report += `\`\`\`\n${deployResult.stdout.trim().slice(0, 1000)}\n\`\`\``;
        }
      } else {
        report += `**FAILED** (${deployDur}s)\n`;
        report += `\`\`\`\n${(deployResult.stderr || deployResult.stdout)
          .trim()
          .slice(0, 1000)}\n\`\`\``;
      }

      return textResult(report);
    },
  });
}
