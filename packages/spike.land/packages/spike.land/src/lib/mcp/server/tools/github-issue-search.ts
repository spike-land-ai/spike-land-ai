/**
 * GitHub Issue Search MCP Tool
 *
 * Search GitHub issues by keyword in the spike.land repo.
 * Use before creating new issues to check for duplicates.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

interface GitHubSearchItem {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string; }>;
  created_at: string;
  html_url: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubSearchItem[];
}

const GitHubIssueSearchSchema = z.object({
  query: z.string().describe("Search keywords to find matching issues"),
  state: z.enum(["open", "closed", "all"]).optional().describe(
    "Filter by issue state. Default: all",
  ),
  limit: z.number().optional().describe("Max results to return. Default: 10"),
});

export function registerGitHubIssueSearchTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "github_issue_search",
    description:
      "Search GitHub issues by keyword in spike.land repo. Use before creating new issues to check for duplicates.",
    category: "github-admin",
    tier: "workspace",
    inputSchema: GitHubIssueSearchSchema.shape,
    handler: async ({
      query,
      state,
      limit,
    }: z.infer<typeof GitHubIssueSearchSchema>): Promise<CallToolResult> =>
      safeToolCall("github_issue_search", async () => {
        if (!process.env.GH_PAT_TOKEN) {
          return textResult("GitHub not configured (GH_PAT_TOKEN missing).");
        }

        const maxResults = limit ?? 10;
        const stateFilter = state && state !== "all" ? `+state:${state}` : "";
        const searchQuery = `${
          encodeURIComponent(query)
        }+repo:spike-land-ai/spike.land+is:issue${stateFilter}`;
        const url = `https://api.github.com/search/issues?q=${searchQuery}&per_page=${maxResults}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.GH_PAT_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "Unknown error");
          throw new Error(`GitHub API error (${response.status}): ${body}`);
        }

        const data = (await response.json()) as GitHubSearchResponse;

        if (data.total_count === 0 || data.items.length === 0) {
          return textResult(`No issues found matching "${query}".`);
        }

        const items = data.items.slice(0, maxResults);
        let text = `**Found ${data.total_count} issue(s) matching "${query}":**\n\n`;

        for (const item of items) {
          const labels = item.labels.length > 0
            ? ` [${item.labels.map(l => l.name).join(", ")}]`
            : "";
          const created = item.created_at.split("T")[0];
          text += `- #${item.number} **${item.title}** (${item.state})${labels} - ${created}\n`;
          text += `  ${item.html_url}\n`;
        }

        return textResult(text);
      }),
  });
}
