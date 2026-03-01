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
import { workspaceTool } from "../tool-builder/procedures.js";

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
        registry.registerBuilt(
            workspaceTool(_userId)
                .tool("github_list_issues", "List issues from GitHub Projects V2.", {
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
                })
                .meta({ category: "gateway", tier: "workspace" })
                .handler(async ({ input, ctx: _ctx }) => {
                    const client = createGitHubProjectsClient();
                    const result = await client.listItems({ first: input.first });

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
                })
        );

        registry.registerBuilt(
            workspaceTool(_userId)
                .tool("github_create_issue", "Create a new GitHub issue.", {
                    title: z.string().min(1).max(200).describe("Issue title"),
                    body: z.string().min(1).describe("Issue body in markdown"),
                    labels: z.array(z.string()).optional().describe("Labels to apply"),
                })
                .meta({ category: "gateway", tier: "workspace" })
                .handler(async ({ input, ctx: _ctx }) => {
                    const client = createGitHubProjectsClient();
                    const result = await client.createIssue({
                        title: input.title,
                        body: input.body,
                        ...(input.labels !== undefined ? { labels: input.labels } : {}),
                    });

                    if (result.error) return err(`Error: ${result.error}`);

                    return ok(
                        `**Issue Created!**\n\n**Number:** #${result.data?.number}\n**URL:** ${result.data?.url}`,
                    );
                })
        );

        registry.registerBuilt(
            workspaceTool(_userId)
                .tool("github_update_project_item", "Update a field value on a GitHub Projects V2 item.", {
                    item_id: z.string().min(1).describe("Project item ID"),
                    field_id: z.string().min(1).describe("Field ID to update"),
                    value: z.string().min(1).describe("New value for the field"),
                })
                .meta({ category: "gateway", tier: "workspace" })
                .handler(async ({ input, ctx: _ctx }) => {
                    const client = createGitHubProjectsClient();
                    const result = await client.updateItemField(
                        input.item_id,
                        input.field_id,
                        { text: input.value },
                    );

                    if (result.error) return err(`Error: ${result.error}`);

                    return ok("**Project item updated successfully!**");
                })
        );

        registry.registerBuilt(
            workspaceTool(_userId)
                .tool("github_get_pr_status", "Get PR and CI status for a GitHub issue.", {
                    issue_number: z.number().min(1).describe("GitHub issue number"),
                })
                .meta({ category: "gateway", tier: "workspace" })
                .handler(async ({ input, ctx: _ctx }) => {
                    const client = createGitHubProjectsClient();
                    const result = await client.getPRStatus(input.issue_number);

                    if (result.error) return err(`Error: ${result.error}`);

                    const pr = result.data;
                    let text = `**PR Status for Issue #${input.issue_number}:**\n\n`;
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
                })
        );
    }

    // ---- Bolt tools (3, always registered) ----
    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("bolt_status", "Get the current Bolt orchestrator status, including active tasks and health.", {})
            .meta({ category: "gateway", tier: "workspace" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
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
                    `**Bolt Status:**\n\n${services.join("\n")
                    }\n\nUse \`/bolt sync\`, \`/bolt plan\`, \`/bolt check\`, or \`/bolt merge\` for operations.`,
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("bolt_pause", "Pause the Bolt orchestrator. Active tasks continue but no new ones are started.", {})
            .meta({ category: "gateway", tier: "workspace" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                boltPaused = true;
                return ok(
                    "**Bolt paused.** Active tasks continue but no new tasks will be started.",
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(_userId)
            .tool("bolt_resume", "Resume the Bolt orchestrator after a pause.", {})
            .meta({ category: "gateway", tier: "workspace" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                boltPaused = false;
                return ok("**Bolt resumed.** New tasks will be started again.");
            })
    );
}
