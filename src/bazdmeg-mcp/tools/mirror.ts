/**
 * Mirror Tool
 *
 * MCP tool for syncing a package to its mirror GitHub repository.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, formatError } from "@spike-land-ai/mcp-server-base";
import { SyncMirrorSchema } from "../types.js";
import { getManifestPackage } from "../manifest.js";
import { runCommand } from "../shell.js";

export function registerMirrorTools(server: McpServer): void {
  // ── bazdmeg_sync_mirror ───────────────────────────────────────────────────
  (server as unknown as {
    tool: (name: string, desc: string, schema: Record<string, unknown>, handler: (args: Record<string, unknown>) => Promise<unknown>) => void;
  }).tool(
    "bazdmeg_sync_mirror",
    "Sync a package to its mirror GitHub repo. Reads mirror field from packages.yaml.",
    SyncMirrorSchema.shape,
    async (args) => {
      try {
        const { packageName, dryRun = true } = args as {
          packageName: string;
          dryRun?: boolean;
        };

        const repoRoot = process.cwd();
        const pkg = await getManifestPackage(packageName, repoRoot);

        if (!pkg) {
          return textResult(
            `**ERROR**: Package \`${packageName}\` not found in packages.yaml.`,
          );
        }

        if (!pkg.mirror) {
          return textResult(
            `**ERROR**: Package \`${packageName}\` does not have a \`mirror\` field in packages.yaml.`,
          );
        }

        const mirrorRepo = pkg.mirror;
        const pkgDir = `${repoRoot}/packages/${packageName}`;

        let report = `## Mirror Sync — ${packageName}\n\n`;
        report += `**Source**: \`packages/${packageName}/\`\n`;
        report += `**Mirror**: \`${mirrorRepo}\`\n`;
        report += `**Dry Run**: ${dryRun}\n\n`;

        if (dryRun) {
          report += `### Steps (dry run)\n`;
          report += `1. Check if mirror remote exists in \`${pkgDir}\`\n`;
          report += `2. Add remote \`mirror\` pointing to \`${mirrorRepo}\` if needed\n`;
          report += `3. Push subtree to mirror: \`git subtree push --prefix=packages/${packageName} mirror main\`\n`;
          report += `\nNo changes made.`;
          return textResult(report);
        }

        // Check if the package is a git submodule or needs subtree push
        report += `### Syncing...\n\n`;

        // Check if mirror remote exists
        const remoteCheck = await runCommand(
          "git",
          ["remote", "get-url", "mirror"],
          pkgDir,
        );

        if (!remoteCheck.ok) {
          // Add mirror remote
          report += `Adding remote \`mirror\` -> \`${mirrorRepo}\`\n`;
          const addRemote = await runCommand(
            "git",
            ["remote", "add", "mirror", mirrorRepo],
            pkgDir,
          );
          if (!addRemote.ok) {
            report += `**FAILED** to add remote: ${addRemote.stderr.trim()}\n`;
            return textResult(report);
          }
        } else {
          report += `Remote \`mirror\` already configured: ${remoteCheck.stdout.trim()}\n`;
        }

        // Use subtree push from monorepo root
        const pushStart = Date.now();
        const pushResult = await runCommand(
          "git",
          ["subtree", "push", `--prefix=packages/${packageName}`, "mirror", "main"],
          repoRoot,
        );
        const pushDur = ((Date.now() - pushStart) / 1000).toFixed(1);

        if (pushResult.ok) {
          report += `**SYNCED** (${pushDur}s)\n`;
          if (pushResult.stdout.trim()) {
            report += `\`\`\`\n${pushResult.stdout.trim().slice(0, 1000)}\n\`\`\``;
          }
        } else {
          report += `**FAILED** (${pushDur}s)\n`;
          report += `\`\`\`\n${(pushResult.stderr || pushResult.stdout).trim().slice(0, 1000)}\n\`\`\``;
        }

        return textResult(report);
      } catch (err: unknown) {
        return formatError(err);
      }
    },
  );
}
