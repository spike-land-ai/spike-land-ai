/**
 * GitHub Admin MCP Tools
 *
 * Tools for querying GitHub Projects V2 roadmap, issue summaries, and PR status.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerGitHubAdminTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "github_admin_roadmap",
    description: "Get roadmap items from GitHub Projects V2. Requires GH_PAT_TOKEN.",
    category: "github-admin",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("github_admin_roadmap", async () => {
        if (!process.env.GH_PAT_TOKEN) {
          return textResult("GitHub not configured (GH_PAT_TOKEN missing).");
        }
        const { getRoadmapItems } = await import(
          "@/lib/bridges/github-projects"
        );
        const items = await getRoadmapItems();
        if (!items || items.length === 0) {
          return textResult("No roadmap items found.");
        }
        let text = `**Roadmap Items (${items.length}):**\n\n`;
        for (const item of items) {
          const labels = item.labels.length > 0
            ? ` [${item.labels.join(", ")}]`
            : "";
          const assignees = item.assignees.length > 0
            ? ` -> ${item.assignees.join(", ")}`
            : "";
          text += `- **${item.title}** (${item.type}) [${item.status}]${labels}${assignees}\n`;
          if (item.url) text += `  ${item.url}\n`;
          text += `\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "github_admin_issues_summary",
    description: "Summarize open/closed issues with label breakdown and recent activity.",
    category: "github-admin",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("github_admin_issues_summary", async () => {
        if (!process.env.GH_PAT_TOKEN) {
          return textResult("GitHub not configured.");
        }
        const { getIssuesSummary } = await import(
          "@/lib/bridges/github-projects"
        );
        const summary = await getIssuesSummary();
        if (!summary) return textResult("Could not fetch issues summary.");
        let text = `**Issues Summary:**\n\n`
          + `- Open: ${summary.open}\n- Closed: ${summary.closed}\n`;
        const labelEntries = Object.entries(summary.byLabel);
        if (labelEntries.length > 0) {
          text += `\n**By Label:**\n`;
          for (const [label, count] of labelEntries) {
            text += `- ${label}: ${count}\n`;
          }
        }
        if (summary.recentlyUpdated.length > 0) {
          text += `\n**Recently Updated:**\n`;
          for (const issue of summary.recentlyUpdated) {
            text += `- #${issue.number} ${issue.title} [${issue.state}] (${issue.updatedAt})\n`;
          }
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "github_admin_pr_status",
    description: "Get PR status overview: open, merged, and pending PRs with CI status.",
    category: "github-admin",
    tier: "workspace",
    inputSchema: {},
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("github_admin_pr_status", async () => {
        if (!process.env.GH_PAT_TOKEN) {
          return textResult("GitHub not configured.");
        }
        const { getPRStatus } = await import("@/lib/bridges/github-projects");
        const status = await getPRStatus();
        if (!status) return textResult("Could not fetch PR status.");
        let text = `**PR Status:**\n\n`
          + `- Open: ${status.open}\n- Merged: ${status.merged}\n`;
        if (status.pending.length > 0) {
          text += `\n**Pending PRs:**\n`;
          for (const pr of status.pending) {
            text +=
              `- #${pr.number} ${pr.title} by ${pr.author} [CI: ${pr.checksStatus}] (${pr.updatedAt})\n`;
          }
        }
        return textResult(text);
      }),
  });
}
