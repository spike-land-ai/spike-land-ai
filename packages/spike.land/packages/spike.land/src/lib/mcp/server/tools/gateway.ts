/**
 * Gateway MCP Tools (Server-Side)
 *
 * GitHub Projects and Bolt orchestration.
 * Uses existing server-side clients directly instead of HTTP.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { isGitHubProjectsAvailable } from "@/lib/sync/clients/github-projects-client";
import { createGitHubProjectsClient } from "@/lib/sync/create-sync-clients";

// ========================================
// Availability
// ========================================

export function isGatewayAvailable(): boolean {
  return isGitHubProjectsAvailable();
}

// ========================================
// Bolt State
// ========================================

let boltPaused = false;

export function isBoltPaused(): boolean {
  return boltPaused;
}

/** @internal — exposed for testing */
export function resetBoltState(): void {
  boltPaused = false;
}

// ========================================
// Schemas
// ========================================

const GitHubListIssuesSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by project item status"),
  first: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Number of items to return"),
});

const GitHubCreateIssueSchema = z.object({
  title: z.string().min(1).max(200).describe("Issue title"),
  body: z.string().min(1).describe("Issue body in markdown"),
  labels: z.array(z.string()).optional().describe("Labels to apply"),
});

const GitHubUpdateProjectItemSchema = z.object({
  item_id: z.string().min(1).describe("Project item ID"),
  field_id: z.string().min(1).describe("Field ID to update"),
  value: z.string().min(1).describe("New value for the field"),
});

const GitHubGetPRStatusSchema = z.object({
  issue_number: z.number().min(1).describe("GitHub issue number"),
});

// ========================================
// Helpers
// ========================================

function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

// ========================================
// Registration
// ========================================

export function registerGatewayTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ---- GitHub Projects tools (4) ----
  if (isGitHubProjectsAvailable()) {
    registry.register({
      name: "github_list_issues",
      description: "List issues from GitHub Projects V2.",
      category: "gateway",
      tier: "workspace",
      inputSchema: GitHubListIssuesSchema.shape,
      handler: async ({ first }) => {
        const params = GitHubListIssuesSchema.parse({ first });
        const client = createGitHubProjectsClient();
        const result = await client.listItems({ first: params.first });

        if (result.error) return err(`Error: ${result.error}`);

        const items = result.data?.items ?? [];
        let text = `**GitHub Project Items (${items.length}):**\n\n`;
        for (const item of items) {
          text += `- **${item.title}** [${item.status}]`;
          if (item.issueNumber) text += ` #${item.issueNumber}`;
          text += "\n";
          if (item.labels.length) {
            text += `  Labels: ${item.labels.join(", ")}\n`;
          }
          text += "\n";
        }
        return ok(text);
      },
    });

    registry.register({
      name: "github_create_issue",
      description: "Create a new GitHub issue.",
      category: "gateway",
      tier: "workspace",
      inputSchema: GitHubCreateIssueSchema.shape,
      handler: async ({ title, body, labels }) => {
        const params = GitHubCreateIssueSchema.parse({ title, body, labels });
        const client = createGitHubProjectsClient();
        const result = await client.createIssue({
          title: params.title,
          body: params.body,
          labels: params.labels,
        });

        if (result.error) return err(`Error: ${result.error}`);

        return ok(
          `**Issue Created!**\n\n**Number:** #${result.data?.number}\n**URL:** ${result.data?.url}`,
        );
      },
    });

    registry.register({
      name: "github_update_project_item",
      description: "Update a field value on a GitHub Projects V2 item.",
      category: "gateway",
      tier: "workspace",
      inputSchema: GitHubUpdateProjectItemSchema.shape,
      handler: async ({ item_id, field_id, value }) => {
        const params = GitHubUpdateProjectItemSchema.parse({
          item_id,
          field_id,
          value,
        });
        const client = createGitHubProjectsClient();
        const result = await client.updateItemField(
          params.item_id,
          params.field_id,
          { text: params.value },
        );

        if (result.error) return err(`Error: ${result.error}`);

        return ok("**Project item updated successfully!**");
      },
    });

    registry.register({
      name: "github_get_pr_status",
      description: "Get PR and CI status for a GitHub issue.",
      category: "gateway",
      tier: "workspace",
      inputSchema: GitHubGetPRStatusSchema.shape,
      handler: async ({ issue_number }) => {
        const params = GitHubGetPRStatusSchema.parse({ issue_number });
        const client = createGitHubProjectsClient();
        const result = await client.getPRStatus(params.issue_number);

        if (result.error) return err(`Error: ${result.error}`);

        const pr = result.data;
        let text = `**PR Status for Issue #${params.issue_number}:**\n\n`;
        if (!pr?.prNumber) {
          text += "No linked PR found.";
        } else {
          text += `**PR:** #${pr.prNumber}\n`;
          text += `**State:** ${pr.prState}\n`;
          text += `**CI:** ${pr.ciStatus ?? "unknown"}\n`;
          text += `**Review:** ${pr.reviewDecision ?? "none"}\n`;
          if (pr.mergedAt) text += `**Merged:** ${pr.mergedAt}\n`;
        }
        return ok(text);
      },
    });
  }

  // ---- Bolt tools (3, always registered) ----
  registry.register({
    name: "bolt_status",
    description: "Get the current Bolt orchestrator status, including active tasks and health.",
    category: "gateway",
    tier: "workspace",
    inputSchema: {},
    handler: async () => {
      const services: string[] = [];
      services.push(
        `**Orchestrator:** ${boltPaused ? "PAUSED" : "RUNNING"}`,
      );

      if (isGitHubProjectsAvailable()) {
        services.push("**GitHub Projects:** configured");
      } else {
        services.push("**GitHub Projects:** not configured");
      }

      return ok(
        `**Bolt Status:**\n\n${
          services.join("\n")
        }\n\nUse \`/bolt sync\`, \`/bolt plan\`, \`/bolt check\`, or \`/bolt merge\` for operations.`,
      );
    },
  });

  registry.register({
    name: "bolt_pause",
    description: "Pause the Bolt orchestrator. Active tasks continue but no new ones are started.",
    category: "gateway",
    tier: "workspace",
    inputSchema: {},
    handler: async () => {
      boltPaused = true;
      return ok(
        "**Bolt paused.** Active tasks continue but no new tasks will be started.",
      );
    },
  });

  registry.register({
    name: "bolt_resume",
    description: "Resume the Bolt orchestrator after a pause.",
    category: "gateway",
    tier: "workspace",
    inputSchema: {},
    handler: async () => {
      boltPaused = false;
      return ok("**Bolt resumed.** New tasks will be started again.");
    },
  });
}
