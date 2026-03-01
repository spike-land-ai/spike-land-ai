/**
 * Creative MCP Tools
 *
 * Manage creative sets, variants, fatigue detection, and performance tracking.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

export function registerCreativeTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("creative_generate_variants", "Create a creative set with variants from original content. Variants are created with PENDING status for async generation.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                name: z.string().min(1).describe("Creative set name."),
                content: z.string().min(1).describe("Original creative content."),
                variant_count: z.number().optional().default(3).describe(
                    "Number of variants to generate (default 3).",
                ),
            })
            .meta({ category: "creative", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("creative_generate_variants", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    await resolveWorkspace(userId, args.workspace_slug);

                    const creativeSet = await prisma.creativeSet.create({
                        data: {
                            name: args.name,
                            generatedById: userId,
                            modelVersion: "v1",
                            generationPrompt: args.content,
                            seedContent: args.content,
                        },
                    });

                    const variantIds: string[] = [];
                    for (let i = 0; i < args.variant_count; i++) {
                        const variant = await prisma.creativeVariant.create({
                            data: {
                                setId: creativeSet.id,
                                variantType: "TEXT_ONLY",
                                variantNumber: i,
                                status: "PENDING",
                            },
                        });
                        variantIds.push(variant.id);
                    }

                    let text = `**Creative Set Created**\n\n`;
                    text += `**Set ID:** \`${creativeSet.id}\`\n`;
                    text += `**Name:** ${args.name}\n`;
                    text += `**Variants:** ${variantIds.length}\n\n`;
                    text += `| # | Variant ID | Status |\n`;
                    text += `|---|-----------|--------|\n`;
                    for (let i = 0; i < variantIds.length; i++) {
                        text += `| ${i + 1} | \`${variantIds[i]}\` | PENDING |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("creative_detect_fatigue", "Detect creative fatigue alerts for a workspace. Returns unresolved fatigue alerts ordered by detection time.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                limit: z.number().optional().default(10).describe(
                    "Max number of alerts to return (default 10).",
                ),
            })
            .meta({ category: "creative", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("creative_detect_fatigue", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    await resolveWorkspace(userId, args.workspace_slug);

                    const alerts = await prisma.creativeFatigueAlert.findMany({
                        where: { isResolved: false },
                        orderBy: { detectedAt: "desc" },
                        take: args.limit,
                    });

                    if (alerts.length === 0) {
                        return textResult(
                            "**Creative Fatigue**\n\nNo active fatigue alerts found.",
                        );
                    }

                    let text = `**Creative Fatigue Alerts** (${alerts.length})\n\n`;
                    text += `| Variant ID | CTR Decay | Days Active | Recommendation |\n`;
                    text += `|-----------|-----------|-------------|----------------|\n`;
                    for (const a of alerts) {
                        text +=
                            `| \`${a.variantId}\` | ${a.ctrDecayPercent}% | ${a.daysActive} | ${a.recommendedAction} |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("creative_get_performance", "Get performance metrics for a creative set and its variants, including impressions, clicks, CTR, and conversions.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                creative_set_id: z.string().min(1).describe("Creative set ID."),
            })
            .meta({ category: "creative", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("creative_get_performance", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    await resolveWorkspace(userId, args.workspace_slug);

                    const creativeSet = await prisma.creativeSet.findFirst({
                        where: { id: args.creative_set_id },
                        include: {
                            variants: {
                                include: { performanceHistory: true },
                            },
                        },
                    });

                    if (!creativeSet) {
                        return textResult(
                            "**Error: NOT_FOUND**\nCreative set not found.\n**Retryable:** false",
                        );
                    }

                    let text = `**Creative Performance**\n\n`;
                    text += `**Set ID:** \`${creativeSet.id}\`\n`;
                    text += `**Variants:** ${creativeSet.variants.length}\n\n`;
                    text += `| Variant | Impressions | Clicks | CTR | Conversions |\n`;
                    text += `|---------|------------|--------|-----|-------------|\n`;

                    for (const v of creativeSet.variants) {
                        const ctr = v.impressions > 0
                            ? ((v.clicks / v.impressions) * 100).toFixed(2)
                            : "0.00";
                        text += `| \`${v.id}\` | ${v.impressions} | ${v.clicks} | ${ctr}% | ${v.conversions} |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("creative_list_sets", "List creative sets with variant counts, ordered by creation date.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                limit: z.number().optional().default(20).describe(
                    "Max number of sets to return (default 20).",
                ),
            })
            .meta({ category: "creative", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("creative_list_sets", async () => {
                    const prisma = (await import("@/lib/prisma")).default;
                    await resolveWorkspace(userId, args.workspace_slug);

                    const sets = await prisma.creativeSet.findMany({
                        where: { generatedById: userId },
                        include: { _count: { select: { variants: true } } },
                        orderBy: { createdAt: "desc" },
                        take: args.limit,
                    });

                    if (sets.length === 0) {
                        return textResult("**Creative Sets**\n\nNo creative sets found.");
                    }

                    let text = `**Creative Sets** (${sets.length})\n\n`;
                    text += `| Set ID | Name | Variants | Status | Created |\n`;
                    text += `|--------|------|---------|--------|---------|\n`;
                    for (const s of sets) {
                        text +=
                            `| \`${s.id}\` | ${s.name} | ${s._count.variants} | ${s.status} | ${s.createdAt.toISOString()} |\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );
}
