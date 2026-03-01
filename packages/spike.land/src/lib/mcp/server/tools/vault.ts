/**
 * Vault Tools (Server-Side)
 *
 * Sealed Secret Vault — agents can store encrypted secrets
 * but NEVER read them back in plaintext. Secrets are consumed
 * only when referenced inside tool handler templates.
 *
 * SECURITY: Do NOT add a vault_approve_secret tool here.
 * Secret approval MUST go through the dashboard (human-in-the-loop).
 * An MCP-accessible approve tool would let AI agents bypass human approval.
 * See: GitHub issue #1539
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { encryptSecret } from "../crypto/vault";
import { freeTool } from "../tool-builder/procedures";

type PrismaClient = Awaited<typeof import("@/lib/prisma")>["default"];

const FREE_SECRET_LIMIT = 25;
const PREMIUM_SECRET_LIMIT = 500;

async function getSecretCount(
    prisma: PrismaClient,
    userId: string,
): Promise<number> {
    return prisma.vaultSecret.count({
        where: { userId, status: { not: "REVOKED" } },
    });
}

async function getSecretLimit(
    prisma: PrismaClient,
    userId: string,
): Promise<number> {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { tier: true },
    });
    if (
        subscription?.tier
        && subscription.tier !== "FREE"
    ) {
        return PREMIUM_SECRET_LIMIT;
    }
    return FREE_SECRET_LIMIT;
}

export function registerVaultTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("vault_store_secret", "Store an encrypted secret (API key, OAuth token, etc.) in the vault. "
                + "The secret is encrypted at rest and NEVER readable in plaintext. "
                + "Secrets start in PENDING status until approved by the user.", {
                name: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(
                        /^[a-zA-Z][a-zA-Z0-9_]*$/,
                        "Name must start with a letter and contain only letters, numbers, and underscores",
                    ),
                value: z.string().min(1).max(10000),
                allowed_urls: z
                    .array(z.string().url())
                    .max(20)
                    .optional()
                    .default([]),
            })
            .meta({ category: "vault", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    name,
                    value,
                    allowed_urls,
                } = input;

                try {

                    // Check quota
                    const [count, limit] = await Promise.all([
                        getSecretCount(ctx.prisma, userId),
                        getSecretLimit(ctx.prisma, userId),
                    ]);

                    if (count >= limit) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text:
                                        `Secret limit reached (${count}/${limit}). Upgrade to Premium for up to ${PREMIUM_SECRET_LIMIT} secrets.`,
                                },
                            ],
                            isError: true,
                        };
                    }

                    // Encrypt the secret
                    const { encryptedValue, iv, tag } = encryptSecret(userId, value);

                    // Store in database
                    const secret = await ctx.prisma.vaultSecret.upsert({
                        where: { userId_name: { userId, name } },
                        update: {
                            encryptedValue,
                            iv,
                            tag,
                            status: "PENDING",
                            allowedUrls: allowed_urls,
                        },
                        create: {
                            userId,
                            name,
                            encryptedValue,
                            iv,
                            tag,
                            status: "PENDING",
                            allowedUrls: allowed_urls,
                        },
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text: `**Secret Stored!**\n\n`
                                    + `**ID:** ${secret.id}\n`
                                    + `**Name:** ${secret.name}\n`
                                    + `**Status:** PENDING (awaiting user approval)\n`
                                    + `**Allowed URLs:** ${allowed_urls.length > 0 ? allowed_urls.join(", ") : "any"
                                    }\n\n`
                                    + `The secret is encrypted and cannot be read back. `
                                    + `It will be available for use in tool handlers after approval.`,
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error storing secret: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("vault_list_secrets", "List all secrets in the vault. Returns names and status only — NEVER returns secret values.", {})
            .meta({ category: "vault", tier: "free" })
            .handler(async ({ input: _input, ctx }) => {
                try {

                    const secrets = await ctx.prisma.vaultSecret.findMany({
                        where: { userId },
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            allowedUrls: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                    });

                    const [count, limit] = await Promise.all([
                        getSecretCount(ctx.prisma, userId),
                        getSecretLimit(ctx.prisma, userId),
                    ]);

                    if (secrets.length === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text:
                                        `**Vault (${count}/${limit} secrets)**\n\nNo secrets stored. Use \`vault_store_secret\` to add one.`,
                                },
                            ],
                        };
                    }

                    let text = `**Vault (${count}/${limit} secrets)**\n\n`;
                    for (const s of secrets) {
                        const urls = s.allowedUrls.length > 0
                            ? `URLs: ${s.allowedUrls.join(", ")}`
                            : "URLs: any";
                        text +=
                            `- **${s.name}** (${s.status}) — ID: ${s.id}\n  ${urls} | Created: ${s.createdAt.toISOString()}\n`;
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error listing secrets: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("vault_delete_secret", "Revoke and soft-delete a secret from the vault.", {
                secret_id: z.string().min(1),
            })
            .meta({ category: "vault", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const {
                    secret_id,
                } = input;

                try {

                    const secret = await ctx.prisma.vaultSecret.findFirst({
                        where: { id: secret_id, userId },
                    });

                    if (!secret) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Secret not found or you don't have access.`,
                                },
                            ],
                            isError: true,
                        };
                    }

                    if (secret.status === "REVOKED") {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Secret "${secret.name}" is already revoked.`,
                                },
                            ],
                        };
                    }

                    await ctx.prisma.vaultSecret.update({
                        where: { id: secret_id },
                        data: { status: "REVOKED" },
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `**Secret Revoked!**\n\n**Name:** ${secret.name}\n**Status:** REVOKED\n\nThe secret can no longer be used in tool handlers.`,
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [{ type: "text", text: `Error deleting secret: ${msg}` }],
                        isError: true,
                    };
                }
            })
    );
}
