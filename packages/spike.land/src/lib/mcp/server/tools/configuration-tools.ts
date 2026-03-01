/**
 * Configuration MCP Tools
 *
 * Combined: API key management (settings) and environment management.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import {
    apiRequest,
    requireAdminRole,
    textResult,
} from "./tool-helpers";
import { freeTool, workspaceTool } from "../tool-builder/procedures";

// ── Environment helpers ──

// ── Settings schemas ──
// ── Environment schemas ──
// ── Registration functions ──

export function registerSettingsTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("settings_list_api_keys", "List your API keys (keys are masked for security).", {})
            .meta({ category: "settings", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {
                const keys = await ctx.prisma.apiKey.findMany({
                    where: { userId },
                    select: {
                        id: true,
                        name: true,
                        keyPrefix: true,
                        isActive: true,
                        lastUsedAt: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                });
                if (keys.length === 0) return textResult("No API keys found.");
                let text = `**API Keys (${keys.length}):**\n\n`;
                for (const k of keys) {
                    const status = k.isActive ? "Active" : "Revoked";
                    text += `- **${k.name}** [${status}] — ${k.keyPrefix}\n  Last used: ${k.lastUsedAt?.toISOString() || "never"
                        }\n  Created: ${k.createdAt.toISOString()}\n  ID: ${k.id}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("settings_create_api_key", "Create a new API key. The full key is shown ONLY once.", {
                name: z.string().min(1).max(50).describe("Name for the API key."),
            })
            .meta({ category: "settings", tier: "free" })
            .handler(async ({ input, _ctx }) => {
                const { name } = input;

                const { createApiKey } = await import("@/lib/mcp/api-key-manager");
                const result = await createApiKey(userId, name.trim());
                return textResult(
                    `**API Key Created!**\n\n`
                    + `**ID:** ${result.id}\n`
                    + `**Name:** ${result.name}\n`
                    + `**Key:** ${result.key}\n`
                    + `**Prefix:** ${result.keyPrefix}\n\n`
                    + `**IMPORTANT:** Copy this key now. It will not be shown again.`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("settings_revoke_api_key", "Revoke (deactivate) an API key.", {
                key_id: z.string().min(1).describe("API key ID to revoke."),
            })
            .meta({ category: "settings", tier: "free" })
            .handler(async ({ input, _ctx }) => {
                const { key_id } = input;

                const { revokeApiKey } = await import("@/lib/mcp/api-key-manager");
                const result = await revokeApiKey(userId, key_id);
                if (!result.success) {
                    return textResult(
                        `**Error: NOT_FOUND**\n${result.error || "API key not found."}\n**Retryable:** false`,
                    );
                }
                return textResult(`**API Key Revoked!** ID: ${key_id}`);
            })
    );

    const McpHistorySchema = z.object({
        type: z.enum(["GENERATE", "MODIFY"]).optional().describe(
            "Filter by job type.",
        ),
        limit: z.number().int().min(1).max(50).optional().default(12).describe(
            "Max jobs to return (default 12).",
        ),
        offset: z.number().int().min(0).optional().default(0).describe(
            "Offset for pagination (default 0).",
        ),
    });

    registry.registerBuilt(
        freeTool(userId)
            .tool("settings_mcp_history", "List MCP job history with pagination and optional type filter.", McpHistorySchema.shape)
            .meta({ category: "settings", tier: "free" })
            .handler(async ({ input, _ctx }) => {
                const { type, limit, offset } = input;

                const params = new URLSearchParams({
                    limit: String(limit ?? 12),
                    offset: String(offset ?? 0),
                });
                if (type) params.append("type", type);
                const data = await apiRequest<
                    {
                        jobs: Array<
                            {
                                id: string;
                                type: string;
                                status: string;
                                prompt: string;
                                tokensCost: number;
                                createdAt: string;
                            }
                        >;
                        total: number;
                        hasMore: boolean;
                    }
                >(
                    `/api/mcp/history?${params}`,
                );
                if (data.jobs.length === 0) {
                    return textResult("**MCP History**\n\nNo jobs found.");
                }
                let text = `**MCP History** (${data.jobs.length} of ${data.total})\n\n`;
                for (const job of data.jobs) {
                    text += `- **${job.type}** [${job.status}] — ${job.tokensCost} tokens\n`;
                    text += `  Prompt: ${job.prompt.slice(0, 100)}${job.prompt.length > 100 ? "..." : ""}\n`;
                    text += `  ID: \`${job.id}\` | ${job.createdAt}\n\n`;
                }
                if (data.hasMore) {
                    text += `_More results available. Use offset=${(offset ?? 0) + (limit ?? 12)}._`;
                }
                return textResult(text);
            })
    );

    const McpJobDetailSchema = z.object({
        job_id: z.string().min(1).describe("MCP job ID."),
    });

    registry.registerBuilt(
        freeTool(userId)
            .tool("settings_mcp_job_detail", "Get full detail for a single MCP job including images and processing time.", McpJobDetailSchema.shape)
            .meta({ category: "settings", tier: "free" })
            .handler(async ({ input, _ctx }) => {
                const { job_id } = input;

                const job = await apiRequest<
                    {
                        id: string;
                        type: string;
                        status: string;
                        prompt: string;
                        tokensCost: number;
                        tier: string;
                        createdAt: string;
                        processingCompletedAt?: string;
                        outputImageUrl?: string;
                        outputWidth?: number;
                        outputHeight?: number;
                        apiKeyName?: string;
                    }
                >(
                    `/api/mcp/history/${encodeURIComponent(job_id)}`,
                );
                let text = `**MCP Job Detail**\n\n`;
                text += `**ID:** \`${job.id}\`\n`;
                text += `**Type:** ${job.type}\n**Status:** ${job.status}\n`;
                text += `**Tier:** ${job.tier}\n**Tokens:** ${job.tokensCost}\n`;
                text += `**Prompt:** ${job.prompt}\n`;
                if (job.outputImageUrl) text += `**Output:** ${job.outputImageUrl}\n`;
                if (job.outputWidth) {
                    text += `**Dimensions:** ${job.outputWidth}x${job.outputHeight}\n`;
                }
                text += `**Created:** ${job.createdAt}\n`;
                if (job.processingCompletedAt) {
                    text += `**Completed:** ${job.processingCompletedAt}\n`;
                }
                if (job.apiKeyName) text += `**API Key:** ${job.apiKeyName}\n`;
                return textResult(text);
            })
    );
}

export function registerEnvironmentTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("env_list", "List all registered environments with their URLs and health endpoints.", {})
            .meta({ category: "env", tier: "workspace" })
            .handler(async ({ input: _input, _ctx }) => {
                await requireAdminRole(userId);
                const { getAllEnvironmentConfigs } = await import(
                    "@/lib/dashboard/environments"
                );
                const configs = getAllEnvironmentConfigs();

                let text = `**Environments (${configs.length}):**\n\n`;
                for (const env of configs) {
                    text += `- **${env.name}**\n  URL: ${env.url}\n  Health: ${env.healthEndpoint}\n\n`;
                }
                return textResult(text);
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("env_status", "Check the health status of a specific environment.", {
                name: z.enum(["dev", "preview", "prod"]).describe("Environment name."),
            })
            .meta({ category: "env", tier: "workspace" })
            .handler(async ({ input, _ctx }) => {
                const { name } = input;

                await requireAdminRole(userId);
                const { getEnvironmentConfig, checkEnvironmentHealth } = await import(
                    "@/lib/dashboard/environments"
                );
                const config = getEnvironmentConfig(name);
                if (!config) return textResult(`Environment "${name}" not found.`);

                const info = await checkEnvironmentHealth(config);
                return textResult(
                    `**Environment: ${info.name}**\n\n`
                    + `- Status: ${info.status}\n`
                    + `- URL: ${info.url}\n`
                    + `- Version: ${info.version || "unknown"}\n`
                    + `- Commit: ${info.commitSha || "unknown"}\n`
                    + `- Last Deployed: ${info.lastDeployedAt?.toISOString() || "unknown"}`,
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("env_compare", "Compare two environments side by side (health, version, commit).", {
                env_a: z.enum(["dev", "preview", "prod"]).describe("First environment."),
                env_b: z.enum(["dev", "preview", "prod"]).describe("Second environment."),
            })
            .meta({ category: "env", tier: "workspace" })
            .handler(async ({ input, _ctx }) => {
                const { env_a, env_b } = input;

                await requireAdminRole(userId);
                const { getEnvironmentConfig, checkEnvironmentHealth } = await import(
                    "@/lib/dashboard/environments"
                );

                const configA = getEnvironmentConfig(env_a);
                const configB = getEnvironmentConfig(env_b);
                if (!configA) return textResult(`Environment "${env_a}" not found.`);
                if (!configB) return textResult(`Environment "${env_b}" not found.`);

                const [infoA, infoB] = await Promise.all([
                    checkEnvironmentHealth(configA),
                    checkEnvironmentHealth(configB),
                ]);

                const versionMatch = infoA.version && infoB.version
                    && infoA.version === infoB.version;
                const commitMatch = infoA.commitSha && infoB.commitSha
                    && infoA.commitSha === infoB.commitSha;

                return textResult(
                    `**Environment Comparison: ${env_a} vs ${env_b}**\n\n`
                    + `| Field | ${env_a} | ${env_b} |\n`
                    + `|-------|---------|--------|\n`
                    + `| Status | ${infoA.status} | ${infoB.status} |\n`
                    + `| Version | ${infoA.version || "?"} | ${infoB.version || "?"} |\n`
                    + `| Commit | ${infoA.commitSha?.slice(0, 7) || "?"} | ${infoB.commitSha?.slice(0, 7) || "?"
                    } |\n`
                    + `| Deployed | ${infoA.lastDeployedAt?.toISOString() || "?"} | ${infoB.lastDeployedAt?.toISOString() || "?"
                    } |\n\n`
                    + `Version match: ${versionMatch ? "YES" : "NO"}\n`
                    + `Commit match: ${commitMatch ? "YES" : "NO"}`,
                );
            })
    );
}
