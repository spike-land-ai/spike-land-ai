/**
 * Dependency Graph Tool
 *
 * MCP tool for visualizing and querying the dependency graph
 * from packages.yaml.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, formatError } from "@spike-land-ai/mcp-server-base";
import { DepGraphSchema } from "../types.js";
import { readManifest, topologicalSort } from "../manifest.js";
import type { ManifestPackage } from "../manifest.js";

function buildTree(
  name: string,
  packages: Record<string, ManifestPackage>,
  indent: string,
  visited: Set<string>,
): string {
  if (visited.has(name)) return `${indent}${name} (circular)\n`;
  visited.add(name);

  let output = `${indent}${name}\n`;
  const pkg = packages[name];

  if (pkg?.deps) {
    for (let i = 0; i < pkg.deps.length; i++) {
      const dep = pkg.deps[i];
      const isLast = i === pkg.deps.length - 1;
      const prefix = isLast ? "  └── " : "  ├── ";
      const childIndent = indent + (isLast ? "      " : "  │   ");

      if (packages[dep]) {
        if (visited.has(dep)) {
          output += `${indent}${prefix}${dep} (circular)\n`;
        } else {
          output += `${indent}${prefix}${dep}\n`;
          const childPkg = packages[dep];
          if (childPkg?.deps) {
            for (let j = 0; j < childPkg.deps.length; j++) {
              const childDep = childPkg.deps[j];
              const childIsLast = j === childPkg.deps.length - 1;
              const childPrefix = childIsLast ? "  └── " : "  ├── ";
              output += `${childIndent}${childPrefix}${childDep}${visited.has(childDep) ? " (circular)" : ""}\n`;
            }
          }
        }
      } else {
        output += `${indent}${prefix}${dep} (external)\n`;
      }
    }
  }

  return output;
}

function buildMermaid(
  packages: Record<string, ManifestPackage>,
  rootPackage?: string,
): string {
  const lines: string[] = ["graph TD"];
  const seen = new Set<string>();

  const entries = rootPackage
    ? [[rootPackage, packages[rootPackage]] as const]
    : Object.entries(packages);

  for (const [name, pkg] of entries) {
    if (!pkg) continue;
    if (pkg.deps) {
      for (const dep of pkg.deps) {
        const edge = `${name} --> ${dep}`;
        if (!seen.has(edge)) {
          seen.add(edge);
          lines.push(`  ${name} --> ${dep}`);
        }
      }
    }
    // If filtering by root, also include transitive deps
    if (rootPackage && pkg.deps) {
      for (const dep of pkg.deps) {
        const depPkg = packages[dep];
        if (depPkg?.deps) {
          for (const transitiveDep of depPkg.deps) {
            const edge = `${dep} --> ${transitiveDep}`;
            if (!seen.has(edge)) {
              seen.add(edge);
              lines.push(`  ${dep} --> ${transitiveDep}`);
            }
          }
        }
      }
    }
  }

  // Add nodes without deps
  for (const [name, pkg] of entries) {
    if (!pkg) continue;
    const hasDeps = pkg.deps && pkg.deps.length > 0;
    const isDep = [...seen].some((e) => e.includes(` --> ${name}`));
    if (!hasDeps && !isDep) {
      lines.push(`  ${name}`);
    }
  }

  return lines.join("\n");
}

function buildList(
  packages: Record<string, ManifestPackage>,
  rootPackage?: string,
): string {
  try {
    const order = topologicalSort(packages);
    const filtered = rootPackage
      ? order.filter((name) => {
          if (name === rootPackage) return true;
          // Include if it's a direct or transitive dep
          const visited = new Set<string>();
          function isDep(target: string): boolean {
            if (visited.has(target)) return false;
            visited.add(target);
            const pkg = packages[target];
            if (!pkg?.deps) return false;
            if (pkg.deps.includes(name)) return true;
            return pkg.deps.some((d) => isDep(d));
          }
          return isDep(rootPackage);
        })
      : order;

    let output = "## Topological Order (build order)\n\n";
    for (let i = 0; i < filtered.length; i++) {
      const name = filtered[i];
      const pkg = packages[name];
      const deps = pkg?.deps?.length ?? 0;
      output += `${i + 1}. \`${name}\` (${pkg?.kind ?? "?"}, ${deps} deps)\n`;
    }
    return output;
  } catch (err: unknown) {
    return `**ERROR**: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export function registerDepGraphTools(server: McpServer): void {
  // ── bazdmeg_dep_graph ─────────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_dep_graph",
    "Show dependency graph and topological sort. Supports tree, list, and mermaid formats.",
    DepGraphSchema.shape,
    async (args) => {
      try {
        const { packageName, format = "tree" } = args as {
          packageName?: string;
          format?: string;
        };

        const repoRoot = process.cwd();
        const manifest = await readManifest(repoRoot);

        if (packageName && !manifest.packages[packageName]) {
          return textResult(
            `**ERROR**: Package \`${packageName}\` not found in packages.yaml.`,
          );
        }

        let report: string;

        switch (format) {
          case "mermaid": {
            const mermaid = buildMermaid(manifest.packages, packageName);
            report = `## Dependency Graph — ${packageName ?? "All Packages"}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``;
            break;
          }
          case "list": {
            report = buildList(manifest.packages, packageName);
            break;
          }
          case "tree":
          default: {
            if (packageName) {
              const tree = buildTree(packageName, manifest.packages, "", new Set());
              report = `## Dependency Tree — ${packageName}\n\n\`\`\`\n${tree}\`\`\``;
            } else {
              // Show all root packages (those not depended on by others)
              const allDeps = new Set<string>();
              for (const pkg of Object.values(manifest.packages)) {
                if (pkg.deps) {
                  for (const d of pkg.deps) allDeps.add(d);
                }
              }

              const roots = Object.keys(manifest.packages).filter(
                (n) => !allDeps.has(n),
              );

              let tree = "";
              for (const root of roots) {
                tree += buildTree(root, manifest.packages, "", new Set());
                tree += "\n";
              }

              report = `## Dependency Tree — All Packages\n\n**Roots**: ${roots.length} | **Total**: ${Object.keys(manifest.packages).length}\n\n\`\`\`\n${tree}\`\`\``;
            }
            break;
          }
        }

        return textResult(report);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
