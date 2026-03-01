/**
 * Bootstrap Protocol Tools (Server-Side)
 *
 * One-session workspace onboarding — agents can create workspaces,
 * store integration credentials, and deploy apps in a single session.
 *
 * Codespace creation uses SessionService directly instead of HTTP calls
 * to the Cloudflare Worker.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { encryptSecret } from "../crypto/vault";
import { SPIKE_LAND_BASE_URL } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerBootstrapTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("bootstrap_workspace", "Create or update a workspace configuration for the user. "
                + "A workspace is the container for secrets, tools, and apps.", {
                name: z.string().min(1).max(100),
                settings: z.record(z.string(), z.unknown()).optional().default({}),
            })
            .meta({ category: "bootstrap", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    name,
                    settings,
                } = input;

                try {

                    const workspace = await ctx.prisma.workspaceConfig.upsert({
                        where: { userId },
                        update: { name, settings: settings as object },
                        create: {
                            userId,
                            name,
                            settings: settings as object,
                        },
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text: `**Workspace Ready!**\n\n`
                                    + `**ID:** ${workspace.id}\n`
                                    + `**Name:** ${workspace.name}\n\n`
                                    + `Next steps:\n`
                                    + `- Use \`bootstrap_connect_integration\` to add API credentials\n`
                                    + `- Use \`bootstrap_create_app\` to deploy a live app`,
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error creating workspace: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("bootstrap_connect_integration", "Connect an integration by storing its credentials in the encrypted vault. "
                + "Each credential key/value pair is encrypted separately. "
                + "Secrets start in PENDING status until approved.", {
                integration_name: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
                credentials: z.record(z.string(), z.string()),
                allowed_urls: z.array(z.string().url()).max(20).optional().default([]),
            })
            .meta({ category: "bootstrap", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    integration_name,
                    credentials,
                    allowed_urls,
                } = input;

                try {

                    const storedSecrets: Array<{ name: string; id: string; }> = [];

                    for (const [key, value] of Object.entries(credentials)) {
                        const secretName = `${integration_name}_${key}`;
                        const { encryptedValue, iv, tag } = encryptSecret(userId, value);

                        const secret = await ctx.prisma.vaultSecret.upsert({
                            where: { userId_name: { userId, name: secretName } },
                            update: {
                                encryptedValue,
                                iv,
                                tag,
                                status: "PENDING",
                                allowedUrls: allowed_urls,
                            },
                            create: {
                                userId,
                                name: secretName,
                                encryptedValue,
                                iv,
                                tag,
                                status: "PENDING",
                                allowedUrls: allowed_urls,
                            },
                        });

                        storedSecrets.push({ name: secretName, id: secret.id });
                    }

                    // Update workspace config with integration metadata
                    const workspace = await ctx.prisma.workspaceConfig.findUnique({
                        where: { userId },
                    });

                    if (workspace) {
                        const integrations = (workspace.integrations as Record<string, unknown>) || {};
                        integrations[integration_name] = {
                            connectedAt: new Date().toISOString(),
                            secretNames: storedSecrets.map(s => s.name),
                            allowedUrls: allowed_urls,
                        };
                        await ctx.prisma.workspaceConfig.update({
                            where: { userId },
                            data: { integrations: integrations as object },
                        });
                    }

                    let text = `**Integration Connected: ${integration_name}**\n\n`;
                    text += `**Secrets Stored (PENDING approval):**\n`;
                    for (const s of storedSecrets) {
                        text += `- ${s.name} (ID: ${s.id})\n`;
                    }
                    text +=
                        `\nApprove each secret in the dashboard (Settings → Vault). Secrets cannot be approved via MCP tools.`;

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error connecting integration: ${msg}`,
                            },
                        ],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("bootstrap_create_app", "Create a live app: optionally create/update a codespace, then link it to apps on spike.land.", {
                app_name: z.string().min(3).max(50),
                description: z.string().min(10).max(500).optional(),
                code: z.string().min(1).optional(),
                codespace_id: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-zA-Z0-9_.-]+$/)
                    .optional(),
            })
            .meta({ category: "bootstrap", tier: "free" })
            .handler(async ({ input, _ctx }) => {
                const {
                    app_name,
                    description,
                    code,
                    codespace_id,
                } = input;

                try {
                    const serviceToken = process.env.SPIKE_LAND_SERVICE_TOKEN
                        || process.env.SPIKE_LAND_API_KEY
                        || "";

                    const effectiveCodespaceId = codespace_id
                        || app_name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "");

                    // Step 1: Create/update codespace via SessionService if code is provided
                    if (code) {
                        const { getOrCreateSession, upsertSession } = await import(
                            "@/lib/codespace/session-service"
                        );
                        const { transpileCode } = await import(
                            "@/lib/codespace/transpile"
                        );

                        const session = await getOrCreateSession(effectiveCodespaceId);
                        const transpiled = await transpileCode(code, SPIKE_LAND_BASE_URL);
                        await upsertSession({
                            ...session,
                            codeSpace: effectiveCodespaceId,
                            code,
                            transpiled,
                            messages: session.messages ?? [],
                        });
                    }

                    // Step 2: Link to apps
                    const appResponse = await fetch(`${SPIKE_LAND_BASE_URL}/api/apps`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${serviceToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: app_name,
                            description: description
                                || `App from codespace ${effectiveCodespaceId}`,
                            requirements: "Bootstrap-created app",
                            monetizationModel: "free",
                            codespaceId: effectiveCodespaceId,
                        }),
                    });

                    if (!appResponse.ok) {
                        const appError = await appResponse
                            .text()
                            .catch(() => "Unknown error");
                        return {
                            content: [
                                { type: "text", text: `Error creating app: ${appError}` },
                            ],
                            isError: true,
                        };
                    }

                    const appData = (await appResponse.json()) as {
                        id: string;
                        name: string;
                    };

                    const liveUrl = `${SPIKE_LAND_BASE_URL}/api/codespace/${effectiveCodespaceId}/embed`;
                    const dashboardUrl = `${SPIKE_LAND_BASE_URL}/create`;

                    return {
                        content: [
                            {
                                type: "text",
                                text: `**App Created!**\n\n`
                                    + `**App:** ${appData.name} (ID: ${appData.id})\n`
                                    + `**Codespace:** ${effectiveCodespaceId}\n`
                                    + `**Live URL:** ${liveUrl}\n`
                                    + `**Dashboard:** ${dashboardUrl}`,
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error creating app: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("bootstrap_status", "Get the current workspace setup status: workspace config, secrets, tools, and apps.", {})
            .meta({ category: "bootstrap", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {
                try {

                    const [workspace, secretCount, toolCount, apps] = await Promise.all([
                        ctx.prisma.workspaceConfig.findUnique({ where: { userId } }),
                        ctx.prisma.vaultSecret.count({
                            where: { userId, status: { not: "REVOKED" } },
                        }),
                        ctx.prisma.registeredTool.count({
                            where: { userId, status: { not: "DISABLED" } },
                        }),
                        ctx.prisma.app.findMany({
                            where: { userId, deletedAt: null },
                            select: {
                                id: true,
                                name: true,
                                status: true,
                                codespaceId: true,
                            },
                            take: 20,
                        }),
                    ]);

                    let text = `**Workspace Status**\n\n`;

                    if (workspace) {
                        const integrations = workspace.integrations as Record<
                            string,
                            unknown
                        >;
                        const integrationCount = Object.keys(integrations || {}).length;
                        text += `**Workspace:** ${workspace.name}\n`;
                        text += `**Integrations:** ${integrationCount}\n`;
                    } else {
                        text += `**Workspace:** Not configured\n`;
                    }

                    text += `**Vault Secrets:** ${secretCount}\n`;
                    text += `**Registered Tools:** ${toolCount}\n`;
                    text += `**Apps:** ${apps.length}\n`;

                    if (apps.length > 0) {
                        text += `\n**Apps:**\n`;
                        for (const app of apps) {
                            text += `- ${app.name} (${app.status})`;
                            if (app.codespaceId) {
                                text += ` — ${SPIKE_LAND_BASE_URL}/api/codespace/${app.codespaceId}/embed`;
                            }
                            text += `\n`;
                        }
                    }

                    if (!workspace) {
                        text += `\nUse \`bootstrap_workspace\` to get started.`;
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error getting status: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );
}
