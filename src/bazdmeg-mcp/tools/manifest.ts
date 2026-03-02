/**
 * Manifest Tools
 *
 * MCP tools for querying and validating the packages.yaml manifest.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, formatError } from "@spike-land-ai/mcp-server-base";
import { ManifestQuerySchema, ManifestValidateSchema } from "../types.js";
import { readManifest } from "../manifest.js";

export function registerManifestTools(server: McpServer): void {
  // ── bazdmeg_manifest_query ────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_manifest_query",
    "Query packages.yaml for package info. Filter by name, kind, or extract specific fields.",
    ManifestQuerySchema.shape,
    async (args) => {
      try {
        const { packageName, kind, field } = args as {
          packageName?: string;
          kind?: string;
          field?: string;
        };

        const repoRoot = process.cwd();
        const manifest = await readManifest(repoRoot);

        // Filter packages
        let entries = Object.entries(manifest.packages);

        if (packageName) {
          entries = entries.filter(([name]) => name === packageName);
        }

        if (kind) {
          entries = entries.filter(([, pkg]) => pkg.kind === kind);
        }

        if (entries.length === 0) {
          const filters: string[] = [];
          if (packageName) filters.push(`name=${packageName}`);
          if (kind) filters.push(`kind=${kind}`);
          return textResult(
            `**No packages found** matching: ${filters.join(", ")}`,
          );
        }

        // If a specific field is requested
        if (field) {
          let report = `## Manifest Query — field: \`${field}\`\n\n`;
          report += `| Package | ${field} |\n`;
          report += `|---------|${"-".repeat(field.length + 2)}|\n`;

          for (const [name, pkg] of entries) {
            const value = (pkg as Record<string, unknown>)[field];
            const display = value === undefined ? "—" : JSON.stringify(value);
            report += `| ${name} | ${display} |\n`;
          }

          return textResult(report);
        }

        // Full info
        let report = `## Manifest Query\n\n`;
        report += `**Defaults**: scope=\`${manifest.defaults.scope}\`, registry=\`${manifest.defaults.registry}\`, license=\`${manifest.defaults.license}\`\n\n`;
        report += `**Matching packages**: ${entries.length}\n\n`;

        for (const [name, pkg] of entries) {
          report += `### ${name}\n`;
          report += `- **kind**: ${pkg.kind}\n`;
          report += `- **version**: ${pkg.version}\n`;
          report += `- **description**: ${pkg.description}\n`;
          report += `- **entry**: ${pkg.entry}\n`;
          if (pkg.deps && pkg.deps.length > 0) {
            report += `- **deps**: ${pkg.deps.join(", ")}\n`;
          }
          if (pkg.mirror) {
            report += `- **mirror**: ${pkg.mirror}\n`;
          }
          if (pkg.worker) {
            report += `- **worker**: ${pkg.worker.name}\n`;
          }
          if (pkg.bin) {
            report += `- **bin**: ${pkg.bin}\n`;
          }
          report += "\n";
        }

        return textResult(report);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );

  // ── bazdmeg_manifest_validate ─────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_manifest_validate",
    "Validate manifest integrity: deps exist, no circular deps, required fields present, worker packages have worker section.",
    ManifestValidateSchema.shape,
    async () => {
      try {
        const repoRoot = process.cwd();
        const manifest = await readManifest(repoRoot);

        const errors: string[] = [];
        const warnings: string[] = [];
        const allNames = new Set(Object.keys(manifest.packages));

        for (const [name, pkg] of Object.entries(manifest.packages)) {
          // Required fields
          if (!pkg.kind) errors.push(`\`${name}\`: missing \`kind\``);
          if (!pkg.version) errors.push(`\`${name}\`: missing \`version\``);
          if (!pkg.description) errors.push(`\`${name}\`: missing \`description\``);
          if (!pkg.entry) errors.push(`\`${name}\`: missing \`entry\``);

          // Deps reference existing packages
          if (pkg.deps) {
            for (const dep of pkg.deps) {
              if (!allNames.has(dep)) {
                errors.push(`\`${name}\`: dep \`${dep}\` not found in manifest`);
              }
            }
          }

          // Worker packages must have worker section
          if (pkg.kind === "worker" && !pkg.worker) {
            errors.push(`\`${name}\`: kind=worker but no \`worker\` section`);
          }

          // Non-worker packages with worker section
          if (pkg.kind !== "worker" && pkg.worker) {
            warnings.push(`\`${name}\`: has \`worker\` section but kind=${pkg.kind}`);
          }

          // CLI packages should have bin
          if (pkg.kind === "cli" && !pkg.bin) {
            warnings.push(`\`${name}\`: kind=cli but no \`bin\` field`);
          }
        }

        // Check for circular deps
        try {
          const visited = new Set<string>();
          const visiting = new Set<string>();

          function checkCycle(name: string): void {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
              errors.push(`Circular dependency detected involving: \`${name}\``);
              return;
            }
            visiting.add(name);
            const pkg = manifest.packages[name];
            if (pkg?.deps) {
              for (const dep of pkg.deps) {
                if (allNames.has(dep)) checkCycle(dep);
              }
            }
            visiting.delete(name);
            visited.add(name);
          }

          for (const name of allNames) {
            checkCycle(name);
          }
        } catch {
          // Cycle detection already added to errors
        }

        // Check defaults
        if (!manifest.defaults.scope) errors.push("defaults: missing `scope`");
        if (!manifest.defaults.registry) errors.push("defaults: missing `registry`");
        if (!manifest.defaults.license) errors.push("defaults: missing `license`");

        let report = `## Manifest Validation\n\n`;
        report += `**Packages**: ${allNames.size}\n\n`;

        if (errors.length === 0 && warnings.length === 0) {
          report += `**VALID** — No errors or warnings found.\n`;
        } else {
          if (errors.length > 0) {
            report += `### Errors (${errors.length})\n`;
            for (const e of errors) report += `- ${e}\n`;
            report += "\n";
          }
          if (warnings.length > 0) {
            report += `### Warnings (${warnings.length})\n`;
            for (const w of warnings) report += `- ${w}\n`;
            report += "\n";
          }
          report += errors.length > 0 ? `**INVALID** — ${errors.length} error(s) found.` : `**VALID** — ${warnings.length} warning(s).`;
        }

        return textResult(report);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
